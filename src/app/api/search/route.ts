import { handler, ok } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canOpenConsole, isAdminLike, isStaff, type PermissionSubject } from "@/lib/permissions";

/**
 * Unified portal search endpoint powering desktop ⌘K and mobile Gmail-style search.
 * Searches across people, tasks, leaves, worklogs, support tickets, and notices.
 */
export const GET = handler(async (request: Request) => {
  const user = await requireApiUser();
  const subject = user as PermissionSubject;
  const url = new URL(request.url);
  const query = url.searchParams.get("q")?.trim() ?? "";
  const category = url.searchParams.get("category")?.trim().toLowerCase() ?? "all";

  if (query.length < 1) {
    return ok({
      people: [],
      tasks: [],
      leaves: [],
      worklogs: [],
      tickets: [],
      notices: [],
    });
  }

  const isStaffUser = isStaff(subject) || isAdminLike(subject) || canOpenConsole(subject);

  const [people, tasks, leaves, worklogs, tickets, notices] = await Promise.all([
    // People: Staff can search anyone; students can search roster/peers
    category === "all" || category === "students" || category === "people"
      ? prisma.user.findMany({
          where: {
            OR: [
              { name: { contains: query } },
              { rollNo: { contains: query.toUpperCase() } },
              { email: { contains: query.toLowerCase() } },
              { domain: { contains: query } },
              { department: { contains: query } },
            ],
          },
          select: { id: true, name: true, rollNo: true, domain: true, role: true, department: true, year: true },
          orderBy: { name: "asc" },
          take: 8,
        })
      : Promise.resolve([]),

    // Tasks
    category === "all" || category === "tasks"
      ? prisma.task.findMany({
          where: {
            AND: [
              !isStaffUser ? { assigneeId: user.id } : {},
              {
                OR: [
                  { title: { contains: query } },
                  { description: { contains: query } },
                ],
              },
            ],
          },
          select: { id: true, title: true, status: true, priority: true, dueDate: true },
          orderBy: { createdAt: "desc" },
          take: 6,
        })
      : Promise.resolve([]),

    // Leaves
    category === "all" || category === "leaves"
      ? prisma.leaveRequest.findMany({
          where: {
            AND: [
              !isStaffUser ? { userId: user.id } : {},
              {
                OR: [
                  { leaveType: { contains: query } },
                  { reason: { contains: query } },
                  { name: { contains: query } },
                ],
              },
            ],
          },
          select: { id: true, leaveType: true, fromDate: true, toDate: true, status: true, name: true, reason: true },
          orderBy: { createdAt: "desc" },
          take: 6,
        })
      : Promise.resolve([]),

    // Worklogs
    category === "all" || category === "worklogs"
      ? prisma.worklog.findMany({
          where: {
            AND: [
              !isStaffUser ? { userId: user.id } : {},
              {
                OR: [
                  { s1: { contains: query } },
                  { s2: { contains: query } },
                  { name: { contains: query } },
                ],
              },
            ],
          },
          select: { id: true, s1: true, date: true, status: true, name: true },
          orderBy: { date: "desc" },
          take: 6,
        })
      : Promise.resolve([]),

    // Support Tickets
    category === "all" || category === "tickets" || category === "support"
      ? prisma.supportTicket.findMany({
          where: {
            AND: [
              !isStaffUser ? { userId: user.id } : {},
              {
                OR: [
                  { ticketNumber: { contains: query.toUpperCase() } },
                  { subject: { contains: query } },
                  { category: { contains: query } },
                ],
              },
            ],
          },
          select: { id: true, ticketNumber: true, subject: true, status: true, category: true, priority: true },
          orderBy: { createdAt: "desc" },
          take: 6,
        })
      : Promise.resolve([]),

    // Notices / Announcements
    category === "all" || category === "notices" || category === "announcements"
      ? prisma.notification.findMany({
          where: {
            OR: [
              { title: { contains: query } },
              { body: { contains: query } },
            ],
          },
          select: { id: true, title: true, createdAt: true, category: true },
          orderBy: { createdAt: "desc" },
          take: 5,
        })
      : Promise.resolve([]),
  ]);

  return ok({ people, tasks, leaves, worklogs, tickets, notices });
});
