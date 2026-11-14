import { handler, ok } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const GET = handler(async (request: Request) => {
  const user = await requireApiUser();
  const { searchParams } = new URL(request.url);
  const since = searchParams.get("since");

  // Rule: Admin does NOT receive push/sound notifications when users raise queries
  const isStaff =
    user.role === "MENTOR" ||
    user.role === "ADMIN" ||
    user.role === "SUPER_ADMIN";

  if (isStaff) {
    return ok({ unreadCount: 0, newReplies: [] });
  }

  // Find unread messages from staff on student's tickets
  const unreadCount = await prisma.ticketMessage.count({
    where: {
      ticket: { userId: user.id },
      senderId: { not: user.id },
      isInternalNote: false,
      readAt: null,
    },
  });

  let newReplies: Array<{
    id: string;
    ticketId: string;
    ticketNumber: string;
    subject: string;
    senderName: string;
    message: string;
    createdAt: Date;
  }> = [];

  if (since) {
    const sinceDate = new Date(since);
    const messages = await prisma.ticketMessage.findMany({
      where: {
        ticket: { userId: user.id },
        senderId: { not: user.id },
        isInternalNote: false,
        readAt: null,
        createdAt: { gt: sinceDate },
      },
      include: {
        ticket: {
          select: {
            id: true,
            ticketNumber: true,
            subject: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    });

    newReplies = messages.map((m) => ({
      id: m.id,
      ticketId: m.ticket.id,
      ticketNumber: m.ticket.ticketNumber,
      subject: m.ticket.subject,
      senderName: m.senderName,
      message: m.message,
      createdAt: m.createdAt,
    }));
  }

  return ok({ unreadCount, newReplies });
});

