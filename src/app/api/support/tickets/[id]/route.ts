import { z } from "zod";
import { fail, handler, ok } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdminLike } from "@/lib/permissions";

const updateTicketSchema = z.object({
  status: z.enum(["NEW", "OPEN", "ASSIGNED", "IN_PROGRESS", "WAITING_STUDENT", "RESOLVED", "CLOSED"]).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
  assignedToId: z.string().nullable().optional(),
  reopenReason: z.string().optional(),
  rating: z.number().min(1).max(5).optional(),
  feedback: z.string().max(2000).optional(),
});

export const GET = handler(async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireApiUser();
  const { id } = await params;

  const isStaff = isAdminLike(user) || user.role === "MENTOR" || user.role === "ADMIN" || user.role === "SUPER_ADMIN" || user.role === "STUDENT_ADMIN";

  const ticket = await prisma.supportTicket.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          rollNo: true,
          email: true,
          department: true,
          year: true,
          domain: true,
          mentorName: true,
          mobile: true,
        },
      },
      assignedTo: { select: { id: true, name: true, role: true, email: true } },
      messages: {
        where: isStaff ? {} : { isInternalNote: false },
        orderBy: { createdAt: "asc" },
      },
      activities: {
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!ticket) {
    return fail("Support ticket not found", 404);
  }

  // Access validation: Only owner student or staff can view
  if (!isStaff && ticket.userId !== user.id) {
    return fail("Unauthorized access to ticket", 403);
  }

  // Auto-mark unread messages as read
  if (!isStaff) {
    await prisma.ticketMessage.updateMany({
      where: {
        ticketId: id,
        senderId: { not: user.id },
        readAt: null,
      },
      data: { readAt: new Date() },
    });
  }

  return ok({ ticket, isStaff });
});

export const PATCH = handler(async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireApiUser();
  const { id } = await params;
  const body = await request.json();
  const data = updateTicketSchema.parse(body);

  const isStaff = isAdminLike(user) || user.role === "MENTOR" || user.role === "ADMIN" || user.role === "SUPER_ADMIN" || user.role === "STUDENT_ADMIN";

  const ticket = await prisma.supportTicket.findUnique({
    where: { id },
  });

  if (!ticket) {
    return fail("Support ticket not found", 404);
  }

  // Student permissions check
  if (!isStaff) {
    if (ticket.userId !== user.id) {
      return fail("Unauthorized access to ticket", 403);
    }

    // Students can submit feedback on resolved ticket, or reopen
    if (data.rating !== undefined || data.feedback !== undefined) {
      const updated = await prisma.supportTicket.update({
        where: { id },
        data: {
          rating: data.rating,
          feedback: data.feedback,
          feedbackAt: new Date(),
        },
      });

      await prisma.ticketActivity.create({
        data: {
          ticketId: id,
          actorId: user.id,
          actorName: user.name,
          action: "FEEDBACK_SUBMITTED",
          meta: `Student rated ${data.rating} stars: "${data.feedback || "No comment"}"`,
        },
      });

      return ok({ ticket: updated });
    }

    // Student reopening request
    if (data.status === "OPEN" && (ticket.status === "RESOLVED" || ticket.status === "CLOSED")) {
      const updated = await prisma.supportTicket.update({
        where: { id },
        data: {
          status: "OPEN",
          reopenedAt: new Date(),
        },
      });

      await prisma.ticketActivity.create({
        data: {
          ticketId: id,
          actorId: user.id,
          actorName: user.name,
          action: "REOPENED",
          fromStatus: ticket.status,
          toStatus: "OPEN",
          meta: data.reopenReason || "Reopened by student",
        },
      });

      // Add message explaining reopening
      if (data.reopenReason) {
        await prisma.ticketMessage.create({
          data: {
            ticketId: id,
            senderId: user.id,
            senderName: user.name,
            senderRole: user.role,
            message: `[Request Reopened] ${data.reopenReason}`,
            isInternalNote: false,
          },
        });
      }

      return ok({ ticket: updated });
    }

    // Student cancelling an unassigned ticket
    if (data.status === "CLOSED" && (ticket.status === "NEW" || ticket.status === "OPEN")) {
      const updated = await prisma.supportTicket.update({
        where: { id },
        data: {
          status: "CLOSED",
          closedAt: new Date(),
        },
      });

      await prisma.ticketActivity.create({
        data: {
          ticketId: id,
          actorId: user.id,
          actorName: user.name,
          action: "CANCELLED",
          fromStatus: ticket.status,
          toStatus: "CLOSED",
          meta: "Student cancelled this request",
        },
      });

      return ok({ ticket: updated });
    }

    return fail("Unauthorized action on this ticket", 403);
  }

  // Administrator actions
  const updateData: any = {};
  const activities: Array<{ action: string; fromStatus?: string; toStatus?: string; meta: string }> = [];

  if (data.status && data.status !== ticket.status) {
    updateData.status = data.status;
    if (data.status === "RESOLVED") {
      updateData.resolvedAt = new Date();
      // Notify only the specific student that their ticket has been resolved
      try {
        await prisma.notification.create({
          data: {
            title: `Ticket Resolved: ${ticket.ticketNumber}`,
            body: `Your ticket regarding "${ticket.subject}" has been marked as resolved by ${user.name}.`,
            category: "GENERAL",
            audience: "USER",
            audienceValue: ticket.userId,
            authorId: user.id,
            link: `/support?ticket=${ticket.id}`,
          },
        });
      } catch {
        // Non-blocking
      }
    } else if (data.status === "CLOSED") {
      updateData.closedAt = new Date();
    }

    activities.push({
      action: "STATUS_CHANGE",
      fromStatus: ticket.status,
      toStatus: data.status,
      meta: `Status updated to ${data.status} by ${user.name}`,
    });
  }

  if (data.priority && data.priority !== ticket.priority) {
    updateData.priority = data.priority;
    activities.push({
      action: "PRIORITY_CHANGE",
      meta: `Priority changed from ${ticket.priority} to ${data.priority}`,
    });
  }

  if (data.assignedToId !== undefined && data.assignedToId !== ticket.assignedToId) {
    updateData.assignedToId = data.assignedToId;
    if (ticket.status === "NEW") {
      updateData.status = "ASSIGNED";
    }

    let assigneeName = "Unassigned";
    if (data.assignedToId) {
      const staffUser = await prisma.user.findUnique({ where: { id: data.assignedToId }, select: { name: true } });
      if (staffUser) assigneeName = staffUser.name;
    }

    activities.push({
      action: "ASSIGNED",
      meta: `Ticket assigned to ${assigneeName}`,
    });
  }

  const updated = await prisma.supportTicket.update({
    where: { id },
    data: updateData,
  });

  // Record activities in DB
  for (const act of activities) {
    await prisma.ticketActivity.create({
      data: {
        ticketId: id,
        actorId: user.id,
        actorName: user.name,
        action: act.action,
        fromStatus: act.fromStatus,
        toStatus: act.toStatus,
        meta: act.meta,
      },
    });
  }

  return ok({ ticket: updated });
});
