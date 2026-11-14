import { AppShell } from "@/components/shell/AppShell";
import { requireUser } from "@/lib/auth";
import { consoleNavFor, studentNavFor } from "@/lib/nav";
import type { PermissionSubject } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { unreadNotificationCount } from "@/lib/queries";
import { toDayKey } from "@/lib/dates";
import { can, isAdminLike } from "@/lib/permissions";
import { matchesMentor } from "@/lib/leaves";
import { getSectionViewTimes } from "@/lib/badge-tracking";

/**
 * The authenticated shell. Everything under (portal) is guarded here, so no
 * page below has to repeat the session check.
 *
 * Badge counts reflect real unread/new actionable items for each user.
 * Once a user reads or visits a section, its badge is cleared ("if user read apdi naa katakudatu").
 */
export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const subject = user as PermissionSubject;

  const consoleNav = consoleNavFor(subject);
  const studentNav = studentNavFor(user.portalNavDisabled);

  const isGlobalAdmin = isAdminLike(subject);
  const viewTimes = await getSectionViewTimes(user.id);

  // Fallback timestamp for sections not viewed yet (uses last login or account creation date)
  const defaultThreshold = user.lastLoginAt ? new Date(user.lastLoginAt) : user.createdAt;

  const tasksThreshold = viewTimes["tasks"] ?? defaultThreshold;
  const leavesThreshold = viewTimes["leaves"] ?? defaultThreshold;
  const worklogThreshold = viewTimes["worklog"] ?? defaultThreshold;
  const passesThreshold = viewTimes["passes"] ?? defaultThreshold;
  const consoleLeavesThreshold = viewTimes["console_leaves"] ?? defaultThreshold;
  const consoleTasksThreshold = viewTimes["console_tasks"] ?? defaultThreshold;
  const consoleWorklogsThreshold = viewTimes["console_worklogs"] ?? defaultThreshold;
  const consolePassesThreshold = viewTimes["console_passes"] ?? defaultThreshold;

  const [
    unreadAnnouncements,
    unreadTasks,
    unreadMyLeaves,
    flaggedWorklogs,
    unreadMyPasses,
    pendingLeaves,
    pendingConsoleTasks,
    pendingConsoleWorklogs,
    pendingConsolePasses,
    unreadSupportMessages,
    unassignedSupportTickets,
  ] = await Promise.all([
    // Announcements: Unread visible notifications
    unreadNotificationCount(user),

    // Student Tasks: Only new/actionable tasks assigned to this user created after they last opened tasks
    prisma.task.count({
      where: {
        assigneeId: user.id,
        status: { in: ["TODO", "IN_PROGRESS", "BLOCKED"] },
        createdAt: { gt: tasksThreshold },
      },
    }),

    // Student My Leave: Leaves decided (Approved/Rejected) since user last opened My Leave
    prisma.leaveRequest.count({
      where: {
        userId: user.id,
        status: { in: ["APPROVED", "REJECTED"] },
        reviewedAt: { gt: leavesThreshold },
      },
    }),

    // Student Worklogs: Flagged worklog revisions since user last opened worklog
    prisma.worklog.count({
      where: {
        userId: user.id,
        status: "FLAGGED",
        updatedAt: { gt: worklogThreshold },
      },
    }),

    // Student Passes: Passes decided since user last opened passes
    prisma.activityPass.count({
      where: {
        userId: user.id,
        status: { in: ["APPROVED", "REJECTED"] },
        updatedAt: { gt: passesThreshold },
      },
    }),

    // Console Leave Requests: Pending leaves submitted since mentor/admin last opened console leaves
    can(subject, "permLeaveRequests")
      ? isGlobalAdmin
        ? prisma.leaveRequest.count({
            where: {
              status: "PENDING",
              createdAt: { gt: consoleLeavesThreshold },
            },
          })
        : prisma.leaveRequest
            .findMany({
              where: {
                status: "PENDING",
                createdAt: { gt: consoleLeavesThreshold },
              },
              select: { user: { select: { mentorName: true } } },
            })
            .then((list) => list.filter((l) => matchesMentor(l.user?.mentorName, user.name)).length)
      : Promise.resolve(0),

    // Console Tasks: Tasks submitted by students awaiting sign-off since mentor/admin last opened console tasks
    can(subject, "permMentorTasks")
      ? prisma.task.count({
          where: {
            status: "SUBMITTED",
            updatedAt: { gt: consoleTasksThreshold },
          },
        })
      : Promise.resolve(0),

    // Console Worklogs: Worklogs submitted since staff last opened console worklogs
    can(subject, "permWorklogs")
      ? prisma.worklog.count({
          where: {
            status: "SUBMITTED",
            createdAt: { gt: consoleWorklogsThreshold },
          },
        })
      : Promise.resolve(0),

    // Console Passes: Passes pending approval submitted since staff last opened console passes
    can(subject, "permActivityApproval")
      ? prisma.activityPass.count({
          where: {
            status: "PENDING",
            createdAt: { gt: consolePassesThreshold },
          },
        })
      : Promise.resolve(0),

    // Student Support: Unread messages sent by staff on student's tickets
    prisma.ticketMessage
      ? prisma.ticketMessage.count({
          where: {
            ticket: { userId: user.id },
            senderId: { not: user.id },
            isInternalNote: false,
            readAt: null,
          },
        })
      : Promise.resolve(0),

    // Console Support: New / unassigned tickets waiting for staff
    (isGlobalAdmin || can(subject, "permUserManagement")) && prisma.supportTicket
      ? prisma.supportTicket.count({
          where: {
            assignedToId: null,
            status: { in: ["NEW", "OPEN"] },
          },
        })
      : Promise.resolve(0),
  ]);

  const badges: Record<string, number> = {
    "/announcements": unreadAnnouncements,
    "/tasks": unreadTasks,
    "/leaves": unreadMyLeaves,
    "/worklog": flaggedWorklogs,
    "/passes": unreadMyPasses,
    "/support": unreadSupportMessages,
    "/console/leaves": pendingLeaves,
    "/console/tasks": pendingConsoleTasks,
    "/console/worklogs": pendingConsoleWorklogs,
    "/console/passes": pendingConsolePasses,
    "/console/support": unassignedSupportTickets,
  };

  return (
    <AppShell
      user={{
        id: user.id,
        name: user.name,
        email: user.email,
        rollNo: user.rollNo,
        role: user.role,
        domain: user.domain,
        year: user.year,
        rewardPoints: user.rewardPoints,
        mustChangePassword: user.mustChangePassword,
      }}
      studentNav={studentNav}
      consoleNav={consoleNav}
      badges={badges}
      today={toDayKey()}
    >
      {children}
    </AppShell>
  );
}
