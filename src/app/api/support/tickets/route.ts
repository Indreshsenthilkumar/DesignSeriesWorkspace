import { z } from "zod";
import { fail, handler, ok } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdminLike } from "@/lib/permissions";
import { PRIORITY_CONFIG, type TicketPriority } from "@/lib/support";

const createTicketSchema = z.object({
  category: z.string().min(1, "Category is required"),
  subcategory: z.string().default(""),
  subject: z.string().trim().min(4, "Subject must be at least 4 characters").max(160),
  description: z.string().trim().min(15, "Please provide a detailed description (at least 15 characters)").max(4000),
  module: z.string().default("GENERAL"),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).default("MEDIUM"),
});

export const GET = handler(async (request: Request) => {
  const user = await requireApiUser();
  const { searchParams } = new URL(request.url);

  const status = searchParams.get("status") || "ALL";
  const category = searchParams.get("category") || "ALL";
  const priority = searchParams.get("priority") || "ALL";
  const query = (searchParams.get("q") || "").trim().toLowerCase();
  const assigned = searchParams.get("assigned") || "ALL"; // ALL | ME | UNASSIGNED

  const isStaff = isAdminLike(user) || user.role === "MENTOR" || user.role === "ADMIN" || user.role === "SUPER_ADMIN" || user.role === "STUDENT_ADMIN";

  // Filter conditions
  const where: any = {};

  if (!isStaff) {
    // Regular students only see their own tickets
    where.userId = user.id;
  } else {
    // Admin filtering
    if (assigned === "ME") {
      where.assignedToId = user.id;
    } else if (assigned === "UNASSIGNED") {
      where.assignedToId = null;
    }
  }

  if (status !== "ALL") {
    if (status === "OVERDUE") {
      where.slaDueAt = { lt: new Date() };
      where.status = { notIn: ["RESOLVED", "CLOSED"] };
    } else {
      where.status = status;
    }
  }

  if (category !== "ALL") {
    where.category = category;
  }

  if (priority !== "ALL") {
    where.priority = priority;
  }

  if (query) {
    where.OR = [
      { ticketNumber: { contains: query, mode: "insensitive" } },
      { subject: { contains: query, mode: "insensitive" } },
      { name: { contains: query, mode: "insensitive" } },
      { rollNo: { contains: query, mode: "insensitive" } },
    ];
  }

  const [tickets, stats] = await Promise.all([
    prisma.supportTicket.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      include: {
        assignedTo: { select: { id: true, name: true, role: true } },
        _count: { select: { messages: true } },
        messages: {
          take: 1,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            message: true,
            senderName: true,
            senderRole: true,
            createdAt: true,
            isInternalNote: true,
          },
        },
      },
      take: 100,
    }),
    Promise.all([
      prisma.supportTicket.count({ where: isStaff ? {} : { userId: user.id } }),
      prisma.supportTicket.count({ where: { ...(isStaff ? {} : { userId: user.id }), status: "NEW" } }),
      prisma.supportTicket.count({ where: { ...(isStaff ? {} : { userId: user.id }), status: "IN_PROGRESS" } }),
      prisma.supportTicket.count({ where: { ...(isStaff ? {} : { userId: user.id }), status: "WAITING_STUDENT" } }),
      prisma.supportTicket.count({ where: { ...(isStaff ? {} : { userId: user.id }), status: "RESOLVED" } }),
      prisma.supportTicket.count({ where: { ...(isStaff ? {} : { userId: user.id }), status: "CLOSED" } }),
      prisma.supportTicket.count({
        where: {
          ...(isStaff ? {} : { userId: user.id }),
          status: { notIn: ["RESOLVED", "CLOSED"] },
          slaDueAt: { lt: new Date() },
        },
      }),
      isStaff ? prisma.supportTicket.count({ where: { assignedToId: null, status: { notIn: ["RESOLVED", "CLOSED"] } } }) : 0,
    ]),
  ]);

  const [total, newCount, inProgress, waitingStudent, resolved, closed, overdue, unassigned] = stats;

  return ok({
    tickets,
    stats: {
      total,
      newCount,
      inProgress,
      waitingStudent,
      resolved,
      closed,
      overdue,
      unassigned,
    },
    isStaff,
  });
});

export const POST = handler(async (request: Request) => {
  const user = await requireApiUser();
  const body = await request.json();
  const data = createTicketSchema.parse(body);

  // Generate sequential/formatted ticket number e.g. TKT-2026-0042
  const count = await prisma.supportTicket.count();
  const year = new Date().getFullYear();
  const ticketNumber = `TKT-${year}-${String(count + 1).padStart(4, "0")}`;

  // Calculate SLA deadline
  const priorityConfig = PRIORITY_CONFIG[data.priority as TicketPriority] || PRIORITY_CONFIG.MEDIUM;
  const slaDueAt = new Date(Date.now() + priorityConfig.resolveHours * 60 * 60 * 1000);

  const ticket = await prisma.supportTicket.create({
    data: {
      ticketNumber,
      userId: user.id,
      name: user.name,
      rollNo: user.rollNo || "",
      email: user.email || "",
      department: user.department || "",
      year: user.year || "",
      category: data.category,
      subcategory: data.subcategory,
      subject: data.subject,
      description: data.description,
      module: data.module,
      priority: data.priority,
      status: "NEW",
      slaDueAt,
      // Create initial conversation message containing description
      messages: {
        create: {
          senderId: user.id,
          senderName: user.name,
          senderRole: user.role,
          message: data.description,
          isInternalNote: false,
        },
      },
      // Create initial audit activity
      activities: {
        create: {
          actorId: user.id,
          actorName: user.name,
          action: "CREATED",
          fromStatus: null,
          toStatus: "NEW",
          meta: `Ticket created with ${data.priority} priority under ${data.category}`,
        },
      },
    },
    include: {
      messages: true,
    },
  });

  return ok({ ticket });
});
