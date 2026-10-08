import { z } from "zod";

import { audit, fail, handler, ok } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { calculateDuration, getLeaveFieldGroup, LEAVE_TYPES } from "@/lib/leaves";

const createLeaveSchema = z
  .object({
    leaveType: z.string().min(1, "Please select a leave type."),
    fromDate: z.string().min(1, "Please provide the from date and time."),
    toDate: z.string().min(1, "Please provide the to date and time."),
    reason: z.string().default(""),
    remarks: z.string().default(""),
    venueDetails: z.string().default(""),
    companyDetails: z.string().default(""),
  })
  .superRefine((data, ctx) => {
    const from = new Date(data.fromDate);
    const to = new Date(data.toDate);

    if (isNaN(from.getTime())) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid From Date", path: ["fromDate"] });
    }
    if (isNaN(to.getTime())) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid To Date", path: ["toDate"] });
    }
    if (from.getTime() > to.getTime()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "To Date must be after From Date", path: ["toDate"] });
    }

    const group = getLeaveFieldGroup(data.leaveType);
    if (group === "REASON_ONLY") {
      const combined = (data.reason || data.remarks || "").trim();
      if (combined.length < 3) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Reason is required (at least 3 characters).", path: ["reason"] });
      }
    } else if (group === "REMARKS_VENUE") {
      if (!data.remarks.trim()) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Remarks are required.", path: ["remarks"] });
      }
      if (!data.venueDetails.trim()) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Venue details are required.", path: ["venueDetails"] });
      }
    } else if (group === "REMARKS_COMPANY") {
      if (!data.remarks.trim()) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Remarks are required.", path: ["remarks"] });
      }
      if (!data.companyDetails.trim()) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Company details are required.", path: ["companyDetails"] });
      }
    } else if (group === "REMARKS_VENUE_COMPANY") {
      if (!data.remarks.trim()) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Remarks are required.", path: ["remarks"] });
      }
      if (!data.venueDetails.trim()) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Venue details are required.", path: ["venueDetails"] });
      }
      if (!data.companyDetails.trim()) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Company details are required.", path: ["companyDetails"] });
      }
    }
  });

export const POST = handler(async (request: Request) => {
  const user = await requireApiUser();
  const data = createLeaveSchema.parse(await request.json());

  const duration = calculateDuration(data.fromDate, data.toDate);

  // Normalize reason / remarks
  const reason = data.reason.trim() || data.remarks.trim();
  const remarks = data.remarks.trim() || data.reason.trim();

  const leave = await prisma.leaveRequest.create({
    data: {
      userId: user.id,
      rollNo: user.rollNo || "",
      email: user.email || user.id,
      name: user.name || "",
      department: user.department || "",
      year: user.year || "",
      leaveType: data.leaveType,
      fromDate: data.fromDate,
      toDate: data.toDate,
      duration,
      reason,
      remarks,
      venueDetails: data.venueDetails.trim(),
      companyDetails: data.companyDetails.trim(),
      status: "PENDING",
    },
  });

  await audit(user.id, "LEAVE_REQUEST", "LeaveRequest", leave.id, {
    leaveType: data.leaveType,
    fromDate: data.fromDate,
    toDate: data.toDate,
  });

  return ok(leave, 201);
});

// ---------------------------------------------------------------------------

const reviewSchema = z.object({
  id: z.string().min(1),
  status: z.enum(["APPROVED", "REJECTED", "CANCELLED"]),
  reviewerRemark: z.string().trim().max(400).default(""),
});

export const PATCH = handler(async (request: Request) => {
  const user = await requireApiUser();
  const { id, status, reviewerRemark } = reviewSchema.parse(await request.json());

  const leave = await prisma.leaveRequest.findUnique({
    where: { id },
  });

  if (!leave) return fail("Leave request not found.", 404);

  // Student self-cancellation
  if (status === "CANCELLED") {
    if (leave.userId !== user.id && user.role === "STUDENT") {
      return fail("You can only cancel your own leave requests.", 403);
    }
    if (leave.status !== "PENDING") {
      return fail("Only pending leave requests can be cancelled.", 400);
    }
    const updated = await prisma.leaveRequest.update({
      where: { id },
      data: { status: "CANCELLED" },
    });
    await audit(user.id, "LEAVE_CANCEL", "LeaveRequest", leave.id);
    return ok(updated);
  }

  // Admin / Mentor review
  const isStaff = user.role === "ADMIN" || user.role === "SUPER_ADMIN" || user.role === "MENTOR" || user.permActivityApproval;
  if (!isStaff) {
    return fail("You do not have permission to approve or reject leave requests.", 403);
  }

  if (leave.status !== "PENDING") {
    return fail(`This leave request has already been ${leave.status.toLowerCase()}.`, 409);
  }

  const updated = await prisma.leaveRequest.update({
    where: { id },
    data: {
      status,
      reviewerId: user.id,
      reviewerRemark,
      reviewedAt: new Date(),
    },
  });

  await audit(user.id, `LEAVE_${status}`, "LeaveRequest", leave.id, {
    status,
    reviewerRemark,
  });

  return ok(updated);
});

// ---------------------------------------------------------------------------

export const GET = handler(async (request: Request) => {
  const user = await requireApiUser();
  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  const studentOnly = url.searchParams.get("self") === "true" || user.role === "STUDENT";

  const isStaff = user.role === "ADMIN" || user.role === "SUPER_ADMIN" || user.role === "MENTOR" || user.permActivityApproval;

  const where: any = {};
  if (studentOnly || !isStaff) {
    where.userId = user.id;
  }
  if (status && status !== "ALL") {
    where.status = status;
  }

  const leaves = await prisma.leaveRequest.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      user: {
        select: { id: true, name: true, rollNo: true, department: true, year: true, mentorName: true, mobile: true },
      },
      reviewer: {
        select: { id: true, name: true, role: true },
      },
    },
    take: 200,
  });

  return ok(leaves);
});
