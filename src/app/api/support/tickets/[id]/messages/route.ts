import { z } from "zod";
import { fail, handler, ok } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdminLike } from "@/lib/permissions";

const createMessageSchema = z.object({
  message: z.string().trim().min(1, "Message cannot be empty").max(4000),
  isInternalNote: z.boolean().default(false),
});

export const POST = handler(async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireApiUser();
  const { id: ticketId } = await params;
  const body = await request.json();
  const data = createMessageSchema.parse(body);

  const isStaff = isAdminLike(user) || user.role === "MENTOR" || user.role === "ADMIN" || user.role === "SUPER_ADMIN" || user.role === "STUDENT_ADMIN";

  const ticket = await prisma.supportTicket.findUnique({
    where: { id: ticketId },
  });

  if (!ticket) {
    return fail("Support ticket not found", 404);
  }

  // Access check
  if (!isStaff && ticket.userId !== user.id) {
    return fail("Unauthorized", 403);
  }

  // Enforce: Students CANNOT create internal notes
  const isInternalNote = isStaff ? data.isInternalNote : false;

  const message = await prisma.ticketMessage.create({
    data: {
      ticketId,
      senderId: user.id,
      senderName: user.name,
      senderRole: user.role,
      message: data.message,
      isInternalNote,
    },
  });

  // Ticket updates on message
  const ticketUpdates: any = {
    updatedAt: new Date(),
  };

  if (isStaff) {
    // Record first response time if this is the first staff response
    if (!ticket.firstResponseAt && !isInternalNote) {
      ticketUpdates.firstResponseAt = new Date();
    }

    // If staff sent a public response, move status to WAITING_STUDENT or IN_PROGRESS
    if (!isInternalNote) {
      if (ticket.status === "NEW" || ticket.status === "OPEN" || ticket.status === "ASSIGNED") {
        ticketUpdates.status = "IN_PROGRESS";
      }

      // Notify only the specific student who created the ticket
      try {
        await prisma.notification.create({
          data: {
            title: `Reply on ${ticket.ticketNumber}`,
            body: `${user.name} responded to your ticket "${ticket.subject}": ${data.message.slice(0, 120)}`,
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
    }
  } else {
    // Student replied: if it was WAITING_STUDENT, move back to IN_PROGRESS
    if (ticket.status === "WAITING_STUDENT") {
      ticketUpdates.status = "IN_PROGRESS";
    }
  }

  await prisma.supportTicket.update({
    where: { id: ticketId },
    data: ticketUpdates,
  });

  // Activity log
  await prisma.ticketActivity.create({
    data: {
      ticketId,
      actorId: user.id,
      actorName: user.name,
      action: isInternalNote ? "NOTE_ADDED" : "MESSAGE_SENT",
      meta: isInternalNote ? "Internal staff note added" : `Message sent by ${user.name}`,
    },
  });

  return ok({ message });
});
