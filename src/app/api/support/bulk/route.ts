import { z } from "zod";
import { fail, handler, ok } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdminLike } from "@/lib/permissions";

const bulkSchema = z.object({
  ticketIds: z.array(z.string()).min(1, "Select at least one ticket"),
  action: z.enum(["STATUS_UPDATE", "ASSIGN"]),
  status: z.enum(["OPEN", "ASSIGNED", "IN_PROGRESS", "WAITING_STUDENT", "RESOLVED", "CLOSED"]).optional(),
  assignedToId: z.string().nullable().optional(),
});

export const POST = handler(async (request: Request) => {
  const user = await requireApiUser();

  const isStaff = isAdminLike(user) || user.role === "MENTOR" || user.role === "ADMIN" || user.role === "SUPER_ADMIN" || user.role === "STUDENT_ADMIN";
  if (!isStaff) {
    return fail("Unauthorized", 403);
  }

  const body = await request.json();
  const data = bulkSchema.parse(body);

  if (data.action === "STATUS_UPDATE") {
    if (!data.status) return fail("Status is required for status update", 400);

    const updateData: any = { status: data.status };
    if (data.status === "RESOLVED") {
      updateData.resolvedAt = new Date();
      try {
        const resolvedTickets = await prisma.supportTicket.findMany({
          where: { id: { in: data.ticketIds } },
          select: { id: true, ticketNumber: true, subject: true, userId: true },
        });
        for (const t of resolvedTickets) {
          await prisma.notification.create({
            data: {
              title: `Ticket Resolved: ${t.ticketNumber}`,
              body: `Your ticket "${t.subject}" has been marked as resolved by ${user.name}.`,
              category: "GENERAL",
              audience: "USER",
              audienceValue: t.userId,
              authorId: user.id,
              link: `/support?ticket=${t.id}`,
            },
          });
        }
      } catch {
        // Non-blocking
      }
    }
    if (data.status === "CLOSED") updateData.closedAt = new Date();

    await prisma.supportTicket.updateMany({
      where: { id: { in: data.ticketIds } },
      data: updateData,
    });

    for (const ticketId of data.ticketIds) {
      await prisma.ticketActivity.create({
        data: {
          ticketId,
          actorId: user.id,
          actorName: user.name,
          action: "STATUS_CHANGE",
          toStatus: data.status,
          meta: `Bulk status update to ${data.status} by ${user.name}`,
        },
      });
    }

    return ok({ updated: data.ticketIds.length });
  }

  if (data.action === "ASSIGN") {
    let assigneeName = "Unassigned";
    if (data.assignedToId) {
      const staffUser = await prisma.user.findUnique({ where: { id: data.assignedToId }, select: { name: true } });
      if (staffUser) assigneeName = staffUser.name;
    }

    await prisma.supportTicket.updateMany({
      where: { id: { in: data.ticketIds } },
      data: {
        assignedToId: data.assignedToId,
        status: data.assignedToId ? "ASSIGNED" : undefined,
      },
    });

    for (const ticketId of data.ticketIds) {
      await prisma.ticketActivity.create({
        data: {
          ticketId,
          actorId: user.id,
          actorName: user.name,
          action: "ASSIGNED",
          meta: `Bulk assigned to ${assigneeName} by ${user.name}`,
        },
      });
    }

    return ok({ updated: data.ticketIds.length });
  }

  return fail("Invalid action", 400);
});
