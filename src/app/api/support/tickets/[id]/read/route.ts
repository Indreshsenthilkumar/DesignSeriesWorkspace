import { fail, handler, ok } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdminLike } from "@/lib/permissions";

/**
 * Marks unread messages in a support ticket as read for the current user.
 * Supports both student reading mentor replies and mentor/admin reading student replies.
 */
export const POST = handler(async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireApiUser();
  const { id } = await params;

  const isStaff =
    isAdminLike(user) ||
    user.role === "MENTOR" ||
    user.role === "ADMIN" ||
    user.role === "SUPER_ADMIN" ||
    user.role === "STUDENT_ADMIN";

  const ticket = await prisma.supportTicket.findUnique({
    where: { id },
    select: { id: true, userId: true },
  });

  if (!ticket) {
    return fail("Ticket not found", 404);
  }

  // Must be owner or staff
  if (!isStaff && ticket.userId !== user.id) {
    return fail("Unauthorized", 403);
  }

  // Mark all unread messages sent by the other party as read
  const updated = await prisma.ticketMessage.updateMany({
    where: {
      ticketId: id,
      senderId: { not: user.id },
      readAt: null,
    },
    data: {
      readAt: new Date(),
    },
  });

  return ok({ markedCount: updated.count });
});
