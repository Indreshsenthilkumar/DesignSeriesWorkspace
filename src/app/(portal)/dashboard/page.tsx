import type { Metadata } from "next";
import Link from "next/link";

import { CheckInPanel } from "@/components/features/CheckInPanel";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { Button, LinkButton } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/Icon";
import { AnalyticsChart } from "@/components/ui/AnalyticsChart";
import { ProgressRing } from "@/components/ui/Progress";
import { StatTile } from "@/components/ui/StatTile";
import { PersonCell } from "@/components/ui/Avatar";
import { requireUser } from "@/lib/auth";
import { ATTENDANCE_CUTOFF_MINUTES, ATTENDANCE_HOURS } from "@/lib/constants";
import { formatDay, greeting, minutesSinceMidnight, relativeTime, toDayKey, weekdayShort } from "@/lib/dates";
import { studentDashboard, visibleNotifications } from "@/lib/queries";
import { shortYear, truncate } from "@/lib/utils";
import { can, canOpenConsole, isAdminLike, type PermissionSubject } from "@/lib/permissions";
import { consoleNavFor, type NavItem } from "@/lib/nav";
import { prisma } from "@/lib/prisma";
import { matchesMentor } from "@/lib/leaves";

export const metadata: Metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireUser();
  const subject = user as PermissionSubject;

  // Mentors and non-student staff should not see student check-ins or attendance obligations.
  // Instead, their dashboard overview displays only the modules/access enabled for them.
  if (user.role === "MENTOR" || user.role === "ADMIN" || user.role === "SUPER_ADMIN") {
    return <MentorDashboard user={user} subject={subject} />;
  }

  return <StudentDashboard user={user} />;
}

// ---------------------------------------------------------------------------
// Mentor / Staff Dashboard Overview
// ---------------------------------------------------------------------------

async function MentorDashboard({
  user,
  subject,
}: {
  user: Awaited<ReturnType<typeof requireUser>>;
  subject: PermissionSubject;
}) {
  const today = toDayKey();
  const isGlobalAdmin = isAdminLike(subject);

  const hasLeaveRequests = can(subject, "permLeaveRequests");
  const hasTasks = can(subject, "permMentorTasks");
  const hasWorklogs = can(subject, "permWorklogs");
  const hasAttendance = can(subject, "permAttendanceLogs");
  const hasPasses = can(subject, "permActivityApproval");
  const hasUsers = can(subject, "permUserManagement");

  const enabledModules = consoleNavFor(subject).filter((item) => item.href !== "/console");

  const [
    rawLeaves,
    tasksData,
    submittedWorklogs,
    pendingPasses,
    notifications,
    attendanceTodayCount,
    studentCount,
  ] = await Promise.all([
    hasLeaveRequests
      ? prisma.leaveRequest.findMany({
          orderBy: { createdAt: "desc" },
          include: {
            user: {
              select: { id: true, name: true, rollNo: true, department: true, year: true, mentorName: true, mobile: true },
            },
            reviewer: { select: { id: true, name: true, role: true } },
          },
          take: 50,
        })
      : Promise.resolve([]),
    hasTasks
      ? Promise.all([
          prisma.task.findMany({
            where: {
              OR: [{ authorId: user.id }, { assignee: { domain: user.domain } }],
            },
            orderBy: [{ status: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
            take: 6,
            select: {
              id: true,
              title: true,
              description: true,
              status: true,
              priority: true,
              dueDate: true,
              points: true,
              assignee: { select: { id: true, name: true, rollNo: true, domain: true } },
              author: { select: { name: true } },
            },
          }),
          prisma.task.count({
            where: {
              OR: [{ authorId: user.id }, { assignee: { domain: user.domain } }],
              status: { notIn: ["DONE"] },
            },
          }),
          prisma.task.count({
            where: {
              OR: [{ authorId: user.id }, { assignee: { domain: user.domain } }],
              status: "SUBMITTED",
            },
          }),
        ])
      : Promise.resolve([[], 0, 0] as const),
    hasWorklogs
      ? Promise.all([
          prisma.worklog.findMany({
            where: { status: "SUBMITTED" },
            orderBy: { date: "desc" },
            take: 5,
            select: {
              id: true,
              date: true,
              s1: true,
              user: { select: { id: true, name: true, rollNo: true, domain: true } },
            },
          }),
          prisma.worklog.count({ where: { status: "SUBMITTED" } }),
          prisma.worklog.count({ where: { status: "FLAGGED" } }),
        ])
      : Promise.resolve([[], 0, 0] as const),
    hasPasses
      ? Promise.all([
          prisma.activityPass.findMany({
            where: { status: "PENDING" },
            orderBy: { createdAt: "asc" },
            take: 5,
            select: {
              id: true,
              date: true,
              fromTime: true,
              toTime: true,
              destination: true,
              createdAt: true,
              user: { select: { id: true, name: true, rollNo: true } },
            },
          }),
          prisma.activityPass.count({ where: { status: "PENDING" } }),
        ])
      : Promise.resolve([[], 0] as const),
    visibleNotifications(user),
    hasAttendance
      ? prisma.attendance.count({ where: { date: today } })
      : Promise.resolve(0),
    hasUsers
      ? prisma.user.count({
          where: { role: { in: ["STUDENT", "STUDENT_ADMIN"] }, systemStatus: "ACTIVE" },
        })
      : Promise.resolve(0),
  ]);

  const menteeLeaves = isGlobalAdmin
    ? rawLeaves
    : rawLeaves.filter((l) => matchesMentor(l.user?.mentorName, user.name));

  const pendingLeaves = menteeLeaves.filter((l) => l.status === "PENDING");
  const approvedLeaves = menteeLeaves.filter((l) => l.status === "APPROVED");

  const [recentTasks, openTasksCount, submittedTasksCount] = tasksData;
  const [recentWorklogs, submittedWorklogsCount, flaggedWorklogsCount] = submittedWorklogs;
  const [recentPasses, pendingPassesCount] = pendingPasses;

  return (
    <div className="flex flex-col gap-4 sm:gap-5">
      {/* ------------------------------------------------------------------ */}
      {/* Mentor Hero                                                        */}
      {/* ------------------------------------------------------------------ */}
      <Card padded={false} thread className="animate-rise">
        <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="min-w-0">
            <p className="text-[12px] font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--text-faint)" }}>
              {formatDay(today, "long")}
            </p>
            <h1 className="mt-1.5 text-[24px] font-bold leading-tight sm:text-[28px]" style={{ letterSpacing: "-0.032em" }}>
              {greeting()}, {user.name.split(" ")[0]}
              <span style={{ color: "var(--color-brand-amber)" }}>.</span>
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <Badge tone="amber">{user.role === "MENTOR" ? "Mentor" : user.role === "SUPER_ADMIN" ? "Super Admin" : "Admin"}</Badge>
              {user.domain ? <Badge tone="blue">{user.domain}</Badge> : null}
              {user.rollNo ? <Badge tone="slate">{user.rollNo}</Badge> : null}
              <Badge tone="green">{enabledModules.length} console module{enabledModules.length === 1 ? "" : "s"} enabled</Badge>
            </div>
          </div>

          {/* Quick status chips for mentor obligations */}
          <div className="flex shrink-0 items-center gap-3">
            {hasLeaveRequests ? (
              <OverviewChip
                done={pendingLeaves.length === 0}
                label="Leaves"
                detail={pendingLeaves.length > 0 ? `${pendingLeaves.length} pending` : "All clear"}
                href="/console/leaves"
                icon="calendar"
              />
            ) : null}
            {hasTasks ? (
              <OverviewChip
                done={openTasksCount === 0}
                label="Tasks"
                detail={openTasksCount > 0 ? `${openTasksCount} active` : "0 active"}
                href="/console/tasks"
                icon="target"
              />
            ) : null}
            {hasWorklogs ? (
              <OverviewChip
                done={submittedWorklogsCount === 0}
                label="Worklogs"
                detail={submittedWorklogsCount > 0 ? `${submittedWorklogsCount} to review` : "All clear"}
                href="/console/worklogs"
                icon="clipboard"
              />
            ) : null}
            {hasPasses ? (
              <OverviewChip
                done={pendingPassesCount === 0}
                label="Passes"
                detail={pendingPassesCount > 0 ? `${pendingPassesCount} pending` : "All clear"}
                href="/console/passes"
                icon="ticket"
              />
            ) : null}
          </div>
        </div>

        {user.mustChangePassword ? (
          <div
            data-accent="amber"
            className="flex flex-wrap items-center gap-3 border-t px-5 py-3 sm:px-6"
            style={{ background: "var(--tone-soft)", borderColor: "var(--line-soft)" }}
          >
            <Icon name="lock" className="h-4 w-4 shrink-0" style={{ color: "var(--tone)" }} />
            <p className="min-w-0 flex-1 text-[12.5px] font-medium" style={{ color: "var(--tone)" }}>
              You are still on the default issued password. Set your own password to secure your mentor account.
            </p>
            <LinkButton href="/profile#security" size="sm" variant="secondary">
              Change password
            </LinkButton>
          </div>
        ) : null}
      </Card>

      {/* ------------------------------------------------------------------ */}
      {/* Stat Tiles: ONLY for enabled admin console features                 */}
      {/* ------------------------------------------------------------------ */}
      <div className="stagger grid grid-cols-2 gap-3 lg:grid-cols-4">
        {hasLeaveRequests ? (
          <StatTile
            label="Leave Requests"
            value={pendingLeaves.length}
            unit="pending"
            icon="calendar"
            tone={pendingLeaves.length > 0 ? "amber" : "green"}
            caption={
              pendingLeaves.length > 0
                ? `${pendingLeaves.length} awaiting review · ${menteeLeaves.length} total`
                : `${approvedLeaves.length} approved · ${menteeLeaves.length} total`
            }
            href="/console/leaves"
          />
        ) : null}

        {hasTasks ? (
          <StatTile
            label="Active Tasks"
            value={openTasksCount}
            unit="open"
            icon="target"
            tone={submittedTasksCount > 0 ? "amber" : "blue"}
            caption={
              submittedTasksCount > 0
                ? `${submittedTasksCount} awaiting sign-off`
                : "Sprint tasks in your domain"
            }
            href="/console/tasks"
          />
        ) : null}

        {hasWorklogs ? (
          <StatTile
            label="Worklogs to Review"
            value={submittedWorklogsCount}
            unit="submitted"
            icon="clipboard"
            tone={submittedWorklogsCount > 0 ? "amber" : "slate"}
            caption={
              flaggedWorklogsCount > 0
                ? `${flaggedWorklogsCount} flagged for revision`
                : "Daily student submissions"
            }
            href="/console/worklogs"
          />
        ) : null}

        {hasPasses ? (
          <StatTile
            label="Gate Passes"
            value={pendingPassesCount}
            unit="pending"
            icon="ticket"
            tone={pendingPassesCount > 0 ? "amber" : "slate"}
            caption={pendingPassesCount > 0 ? "Students awaiting approval" : "Queue is clear"}
            href="/console/passes"
          />
        ) : null}

        {hasAttendance ? (
          <StatTile
            label="Today's Attendance"
            value={attendanceTodayCount}
            unit="logged"
            icon="check-circle"
            tone="green"
            caption="Missed OTP attendance records"
            href="/console/attendance"
          />
        ) : null}

        {hasUsers ? (
          <StatTile
            label="Cohort Students"
            value={studentCount}
            icon="users"
            tone="slate"
            caption="Active student accounts"
            href="/console/people"
          />
        ) : null}

        {enabledModules.length === 0 ? (
          <StatTile
            label="Console Access"
            value="None"
            icon="alert"
            tone="slate"
            caption="No console permissions assigned"
          />
        ) : null}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Main Grid: Active Queues for Enabled Features + Navigation Hub     */}
      {/* ------------------------------------------------------------------ */}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] sm:gap-5">
        <div className="flex min-w-0 flex-col gap-4 sm:gap-5">
          {/* Leave Requests Queue (if enabled) */}
          {hasLeaveRequests ? (
            <Card className="animate-rise">
              <CardHeader
                icon="calendar"
                title="Student Leave Requests"
                subtitle="Requests submitted by your assigned students."
                action={
                  <LinkButton href="/console/leaves" size="sm" variant="ghost" iconRight="chevron-right">
                    Open console
                  </LinkButton>
                }
              />
              {pendingLeaves.length === 0 ? (
                <EmptyState
                  compact
                  tone="green"
                  icon="check-circle"
                  title="No pending leave requests"
                  description="All leave and OnDuty requests from your mentees have been decided."
                  action={
                    <LinkButton href="/console/leaves" size="sm" variant="secondary">
                      View all leaves ({menteeLeaves.length})
                    </LinkButton>
                  }
                />
              ) : (
                <ul className="flex flex-col gap-2">
                  {pendingLeaves.slice(0, 5).map((leave) => (
                    <li key={leave.id}>
                      <Link
                        href="/console/leaves"
                        className="inset-panel flex flex-col gap-2 p-3 transition-colors hover:border-[var(--accent)]"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <PersonCell
                            name={leave.name}
                            seed={leave.userId}
                            meta={`${leave.rollNo} · ${leave.department}${leave.year ? ` (${leave.year})` : ""}`}
                            size={32}
                          />
                          <Badge tone="blue">{leave.leaveType}</Badge>
                        </div>
                        <div
                          className="flex flex-wrap items-center justify-between gap-2 border-t pt-2 text-[12px]"
                          style={{ borderColor: "var(--line-soft)" }}
                        >
                          <span style={{ color: "var(--text-muted)" }}>
                            {formatDay(leave.fromDate, "short")} – {formatDay(leave.toDate, "short")}
                            {leave.duration ? ` · ${leave.duration}` : ""}
                          </span>
                          <span className="truncate max-w-[260px] font-medium" style={{ color: "var(--text-strong)" }}>
                            {leave.reason}
                          </span>
                          <StatusBadge status={leave.status} />
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          ) : null}

          {/* Tasks Queue (if enabled) */}
          {hasTasks ? (
            <Card className="animate-rise">
              <CardHeader
                icon="target"
                title="Sprint Deliverables & Tasks"
                subtitle="Tasks assigned to mentees in your domain."
                action={
                  <LinkButton href="/console/tasks" size="sm" variant="ghost" iconRight="chevron-right">
                    Manage tasks
                  </LinkButton>
                }
              />
              {recentTasks.length === 0 ? (
                <EmptyState
                  compact
                  tone="blue"
                  icon="target"
                  title="No active sprint tasks"
                  description="Create and assign sprint work to students in the task console."
                  action={
                    <LinkButton href="/console/tasks" size="sm" variant="secondary" icon="plus">
                      Create task
                    </LinkButton>
                  }
                />
              ) : (
                <ul className="flex flex-col gap-2">
                  {recentTasks.map((task) => (
                    <li key={task.id}>
                      <Link
                        href="/console/tasks"
                        className="inset-panel flex items-center gap-3 p-3 transition-colors hover:border-[var(--accent)]"
                      >
                        <span
                          data-accent={
                            task.priority === "CRITICAL" ? "red" : task.priority === "HIGH" ? "amber" : "blue"
                          }
                          className="h-8 w-[3px] shrink-0 rounded-full"
                          style={{ background: "var(--tone)" }}
                        />
                        <div className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-semibold" style={{ color: "var(--text-strong)" }}>
                            {task.title}
                          </span>
                          <span className="block text-[11.5px]" style={{ color: "var(--text-muted)" }}>
                            {task.assignee ? `${task.assignee.name} (${task.assignee.rollNo})` : "Unassigned"} · {task.points} pts
                            {task.dueDate ? ` · Due ${formatDay(task.dueDate, "short")}` : ""}
                          </span>
                        </div>
                        <StatusBadge status={task.status} />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          ) : null}

          {/* Worklogs Queue (if enabled) */}
          {hasWorklogs ? (
            <Card className="animate-rise">
              <CardHeader
                icon="clipboard"
                title="Student Worklogs"
                subtitle="Recent student submissions requiring mentor review."
                action={
                  <LinkButton href="/console/worklogs" size="sm" variant="ghost" iconRight="chevron-right">
                    Review all
                  </LinkButton>
                }
              />
              {recentWorklogs.length === 0 ? (
                <EmptyState
                  compact
                  tone="green"
                  icon="check-circle"
                  title="No worklogs to review"
                  description="All submitted student worklogs have been reviewed."
                />
              ) : (
                <ul className="flex flex-col gap-2">
                  {recentWorklogs.map((log) => (
                    <li key={log.id}>
                      <Link
                        href="/console/worklogs"
                        className="inset-panel flex items-center justify-between gap-3 p-3 transition-colors hover:border-[var(--accent)]"
                      >
                        <PersonCell
                          name={log.user.name}
                          seed={log.user.id}
                          meta={`${log.user.rollNo} · ${formatDay(log.date, "short")}`}
                          size={32}
                        />
                        <span className="truncate max-w-[280px] text-[12px]" style={{ color: "var(--text-muted)" }}>
                          {truncate(log.s1, 60)}
                        </span>
                        <Badge tone="amber">Submitted</Badge>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          ) : null}

          {/* Activity Passes (if enabled) */}
          {hasPasses ? (
            <Card className="animate-rise">
              <CardHeader
                icon="ticket"
                title="Gate Pass Approvals"
                subtitle="Passes waiting for approval."
                action={
                  <LinkButton href="/console/passes" size="sm" variant="ghost" iconRight="chevron-right">
                    Review all
                  </LinkButton>
                }
              />
              {recentPasses.length === 0 ? (
                <EmptyState
                  compact
                  tone="green"
                  icon="check-circle"
                  title="No pass requests waiting"
                  description="Every student pass application has been decided."
                />
              ) : (
                <ul className="flex flex-col gap-2">
                  {recentPasses.map((pass) => (
                    <li key={pass.id}>
                      <Link
                        href="/console/passes"
                        className="inset-panel flex items-center justify-between gap-3 p-3 transition-colors hover:border-[var(--accent)]"
                      >
                        <PersonCell
                          name={pass.user.name}
                          seed={pass.user.id}
                          meta={`${pass.user.rollNo} · ${formatDay(pass.date, "short")}`}
                          size={32}
                        />
                        <div className="text-right">
                          <span className="block text-[12.5px] font-semibold" style={{ color: "var(--text-strong)" }}>
                            {pass.destination}
                          </span>
                          <span className="block text-[11px]" style={{ color: "var(--text-muted)" }}>
                            {pass.fromTime}–{pass.toTime}
                          </span>
                        </div>
                        <Badge tone="amber">Pending</Badge>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          ) : null}

          {/* Empty state if mentor has no queue-based permissions */}
          {enabledModules.length === 0 ? (
            <Card className="animate-rise">
              <EmptyState
                icon="lock"
                title="No Admin Console Modules Enabled"
                description="Your account is assigned the Mentor role, but no console management permissions are currently active. Please contact an administrator to enable access to Leave Requests, Task Management, or Worklogs."
              />
            </Card>
          ) : null}
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Side Column: Enabled Admin Access Hub + Announcements             */}
        {/* ---------------------------------------------------------------- */}
        <div className="flex min-w-0 flex-col gap-4 sm:gap-5">
          {/* Enabled Console Access Modules List */}
          <Card className="animate-rise">
            <CardHeader
              icon="sparkle"
              title="Enabled Admin Access"
              subtitle="Management console features active for you."
            />
            {enabledModules.length === 0 ? (
              <p className="p-3 text-[12.5px]" style={{ color: "var(--text-muted)" }}>
                No console modules currently assigned.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {enabledModules.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="inset-panel flex items-center justify-between gap-3 p-3 transition-colors hover:border-[var(--accent)]"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className="grid h-8 w-8 shrink-0 place-items-center rounded-[9px]"
                        style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
                      >
                        <Icon name={item.icon} className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <span className="block truncate text-[13px] font-semibold" style={{ color: "var(--text-strong)" }}>
                          {item.label}
                        </span>
                        <span className="block truncate text-[11px]" style={{ color: "var(--text-muted)" }}>
                          {item.description}
                        </span>
                      </div>
                    </div>
                    <Icon name="chevron-right" className="h-4 w-4 shrink-0" style={{ color: "var(--text-faint)" }} />
                  </Link>
                ))}
              </div>
            )}
          </Card>

          {/* Announcements */}
          <Card className="animate-rise">
            <CardHeader
              icon="bell"
              title="Announcements"
              subtitle={notifications.length > 0 ? "Latest notices" : "You are up to date."}
              action={
                <LinkButton href="/announcements" size="sm" variant="ghost" iconRight="chevron-right">
                  All
                </LinkButton>
              }
            />
            {notifications.length === 0 ? (
              <EmptyState compact icon="bell" title="No announcements yet" />
            ) : (
              <ul className="flex flex-col gap-2.5">
                {notifications.slice(0, 4).map((item) => (
                  <li key={item.id}>
                    <Link href="/announcements" className="block rounded-[10px] p-2 -m-2 transition-colors hover:bg-[var(--surface-inset)]">
                      <span className="flex items-center gap-2">
                        {!item.read ? (
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: "var(--color-brand-blue)" }} />
                        ) : null}
                        <span
                          className="truncate text-[13px] font-semibold"
                          style={{ color: "var(--text-strong)", opacity: item.read ? 0.75 : 1 }}
                        >
                          {item.title}
                        </span>
                      </span>
                      <span className="mt-1 block text-[12px] leading-snug" style={{ color: "var(--text-muted)" }}>
                        {truncate(item.body, 96)}
                      </span>
                      <span className="mt-1.5 block text-[10.5px] font-medium" style={{ color: "var(--text-faint)" }}>
                        {relativeTime(item.createdAt)} · {item.author.name.split(" ")[0]}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* Quick Actions for Mentor */}
          <MentorQuickLinks enabledModules={enabledModules} />
        </div>
      </div>
    </div>
  );
}

function OverviewChip({
  done,
  label,
  detail,
  href,
  icon,
}: {
  done: boolean;
  label: string;
  detail: string;
  href: string;
  icon: "calendar" | "target" | "clipboard" | "ticket" | "check";
}) {
  return (
    <Link
      href={href}
      data-accent={done ? "green" : "amber"}
      className="flex flex-col items-center gap-1.5 rounded-[13px] border px-4 py-3 transition-transform hover:-translate-y-0.5"
      style={{ borderColor: "var(--tone)", background: "var(--tone-soft)" }}
    >
      <span
        className={
          done
            ? "grid h-8 w-8 place-items-center rounded-full"
            : "grid h-8 w-8 place-items-center rounded-full animate-pulse-ring"
        }
        style={{ background: "var(--tone)", color: "#fff" }}
      >
        <Icon name={done ? "check" : icon} className="h-[17px] w-[17px]" />
      </span>
      <span className="text-[11px] font-bold uppercase tracking-[0.07em]" style={{ color: "var(--tone)" }}>
        {label}
      </span>
      <span className="text-[10.5px] font-medium tabular-nums" style={{ color: "var(--text-muted)" }}>
        {detail}
      </span>
    </Link>
  );
}

function MentorQuickLinks({ enabledModules }: { enabledModules: NavItem[] }) {
  if (enabledModules.length === 0) return null;

  const tones: ("blue" | "amber" | "green" | "red")[] = ["blue", "amber", "green", "red"];

  return (
    <Card className="animate-rise">
      <CardHeader icon="sparkle" title="Quick actions" />
      <div className="grid grid-cols-2 gap-2">
        {enabledModules.slice(0, 4).map((mod, idx) => {
          const tone = tones[idx % tones.length];
          return (
            <Link
              key={mod.href}
              href={mod.href}
              data-accent={tone}
              className="inset-panel flex flex-col gap-2 p-3 transition-colors hover:border-[var(--tone)]"
            >
              <span
                className="grid h-8 w-8 place-items-center rounded-[9px]"
                style={{ background: "var(--tone-soft)", color: "var(--tone)" }}
              >
                <Icon name={mod.icon} className="h-[17px] w-[17px]" />
              </span>
              <span className="text-[12.5px] font-semibold leading-snug" style={{ color: "var(--text-strong)" }}>
                {mod.label}
              </span>
            </Link>
          );
        })}
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Student Dashboard (Students and Student+ Admins)
// ---------------------------------------------------------------------------

async function StudentDashboard({
  user,
}: {
  user: Awaited<ReturnType<typeof requireUser>>;
}) {
  const today = toDayKey();
  const data = await studentDashboard(user);

  const closed = minutesSinceMidnight() > ATTENDANCE_CUTOFF_MINUTES;
  const attendanceDelta =
    data.attendance.previousRate > 0
      ? data.attendance.rate - data.attendance.previousRate
      : null;

  const worklogDone = Boolean(data.worklog.todayLog);
  const attendanceDone = data.attendance.todayHours.length >= ATTENDANCE_HOURS.length;

  return (
    <div className="flex flex-col gap-4 sm:gap-5">
      {/* ------------------------------------------------------------------ */}
      {/* Hero                                                                */}
      {/* ------------------------------------------------------------------ */}
      <Card padded={false} thread className="animate-rise">
        <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="min-w-0">
            <p className="text-[12px] font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--text-faint)" }}>
              {formatDay(today, "long")}
            </p>
            <h1 className="mt-1.5 text-[24px] font-bold leading-tight sm:text-[28px]" style={{ letterSpacing: "-0.032em" }}>
              {greeting()}, {user.name.split(" ")[0]}
              <span style={{ color: "var(--color-brand-amber)" }}>.</span>
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <Badge tone="blue">{user.domain}</Badge>
              {user.year ? <Badge tone="slate">{shortYear(user.year)}</Badge> : null}
              {user.mentorName ? <Badge tone="slate">Mentor · {user.mentorName.split(" - ")[0]}</Badge> : null}
            </div>
          </div>

          {/* Today's two obligations, at a glance. */}
          <div className="flex shrink-0 items-center gap-3">
            <TodayChip
              done={attendanceDone}
              label="Check-in"
              detail={`${data.attendance.todayHours.length}/${ATTENDANCE_HOURS.length} hrs`}
              href="/attendance"
            />
            <TodayChip
              done={worklogDone}
              label="Worklog"
              detail={worklogDone ? "Submitted" : "Not yet"}
              href="/worklog"
            />
          </div>
        </div>

        {user.mustChangePassword ? (
          <div
            data-accent="amber"
            className="flex flex-wrap items-center gap-3 border-t px-5 py-3 sm:px-6"
            style={{ background: "var(--tone-soft)", borderColor: "var(--line-soft)" }}
          >
            <Icon name="lock" className="h-4 w-4 shrink-0" style={{ color: "var(--tone)" }} />
            <p className="min-w-0 flex-1 text-[12.5px] font-medium" style={{ color: "var(--tone)" }}>
              You are still on the password your mentor issued. Set your own before you use the portal further.
            </p>
            <LinkButton href="/profile#security" size="sm" variant="secondary">
              Change password
            </LinkButton>
          </div>
        ) : null}
      </Card>

      {/* ------------------------------------------------------------------ */}
      {/* KPI row                                                             */}
      {/* ------------------------------------------------------------------ */}
      <div className="stagger grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Missed OTP Attendance"
          value={`${data.attendance.rate}%`}
          icon="check-circle"
          tone={data.attendance.rate >= 85 ? "green" : data.attendance.rate >= 70 ? "amber" : "red"}
          delta={attendanceDelta}
          caption={`${data.attendance.hoursLogged} of ${data.attendance.hoursPossible} hrs · 30 days`}
          href="/attendance"
        />
        <StatTile
          label="Worklogs this week"
          value={data.worklog.thisWeek}
          unit="/ 6"
          icon="clipboard"
          tone={data.worklog.thisWeek >= 5 ? "green" : data.worklog.thisWeek >= 3 ? "amber" : "red"}
          caption={data.worklog.flagged > 0 ? `${data.worklog.flagged} flagged for revision` : `${data.worklog.thisMonth} this month`}
          href="/worklog"
        />
        <StatTile
          label="Reward points"
          value={user.rewardPoints}
          icon="trophy"
          tone="amber"
          caption={data.rank ? `Rank ${data.rank.position} of ${data.rank.total}` : "Not ranked"}
          href="/leaderboard"
        />
        <StatTile
          label="Open tasks"
          value={data.openTaskCount}
          icon="target"
          tone={data.openTaskCount === 0 ? "green" : data.openTaskCount > 3 ? "red" : "blue"}
          caption={data.openTaskCount === 0 ? "Nothing pending" : "Assigned by your mentor"}
          href="/tasks"
        />
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Main grid                                                           */}
      {/* ------------------------------------------------------------------ */}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] sm:gap-5">
        <div className="flex min-w-0 flex-col gap-4 sm:gap-5">
          {/* Check-in */}
          <Card className="animate-rise">
            <CardHeader
              icon="check-circle"
              title="Today's check-in"
              subtitle={
                attendanceDone
                  ? "All seven hours are in for today."
                  : "Tap each hour you were present for, then add one line about the work."
              }
              action={
                <LinkButton href="/attendance" size="sm" variant="ghost" iconRight="chevron-right">
                  History
                </LinkButton>
              }
            />
            <CheckInPanel
              date={today}
              loggedHours={data.attendance.todayHours}
              loggedReason={data.attendance.todayReason}
              closed={closed}
              compact
            />
          </Card>

          {/* Attendance trend */}
          <Card className="animate-rise">
            <CardHeader
              icon="chart"
              title="Last 30 days"
              subtitle={`${data.attendance.daysPresent} days present · ${data.attendance.fullDays} full days · ${data.attendance.streak}-day streak`}
            />
            <div className="flex items-center gap-5">
              <ProgressRing
                value={data.attendance.rate}
                size={104}
                tone={data.attendance.rate >= 85 ? "green" : data.attendance.rate >= 70 ? "amber" : "red"}
                sublabel="attended"
              />
              <div className="min-w-0 flex-1">
                <AnalyticsChart
                  data={data.attendance.byDay}
                  tone="blue"
                  height={150}
                  unit=" hrs"
                  target={ATTENDANCE_HOURS.length}
                  denominator={ATTENDANCE_HOURS.length}
                />
              </div>
            </div>
          </Card>

          {/* Tasks */}
          <Card className="animate-rise">
            <CardHeader
              icon="target"
              title="What's on your plate"
              subtitle="Sprint deliverables assigned by your mentor."
              action={
                <LinkButton href="/tasks" size="sm" variant="ghost" iconRight="chevron-right">
                  All tasks
                </LinkButton>
              }
            />
            {data.tasks.length === 0 ? (
              <EmptyState
                compact
                icon="check-circle"
                tone="green"
                title="Nothing outstanding"
                description="Every task assigned to you is done. Your mentor will add more as the sprint moves."
              />
            ) : (
              <ul className="flex flex-col gap-2">
                {data.tasks.map((task) => (
                  <li key={task.id}>
                    <Link
                      href="/tasks"
                      className="inset-panel flex items-center gap-3 p-3 transition-colors hover:border-[var(--accent)]"
                    >
                      <span
                        data-accent={
                          task.priority === "CRITICAL" ? "red" : task.priority === "HIGH" ? "amber" : "blue"
                        }
                        className="h-8 w-[3px] shrink-0 rounded-full"
                        style={{ background: "var(--tone)" }}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-semibold" style={{ color: "var(--text-strong)" }}>
                          {task.title}
                        </span>
                        <span className="block text-[11.5px]" style={{ color: "var(--text-muted)" }}>
                          {task.dueDate ? `Due ${formatDay(task.dueDate, "medium")}` : "No due date"} · {task.points} pts
                        </span>
                      </span>
                      <StatusBadge status={task.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Side column                                                       */}
        {/* ---------------------------------------------------------------- */}
        <div className="flex min-w-0 flex-col gap-4 sm:gap-5">
          <Card className="animate-rise">
            <CardHeader
              icon="bell"
              title="Announcements"
              subtitle={data.unread > 0 ? `${data.unread} unread` : "You are up to date."}
              action={
                <LinkButton href="/announcements" size="sm" variant="ghost" iconRight="chevron-right">
                  All
                </LinkButton>
              }
            />
            {data.notifications.length === 0 ? (
              <EmptyState compact icon="bell" title="No announcements yet" />
            ) : (
              <ul className="flex flex-col gap-2.5">
                {data.notifications.map((item) => (
                  <li key={item.id}>
                    <Link href="/announcements" className="block rounded-[10px] p-2 -m-2 transition-colors hover:bg-[var(--surface-inset)]">
                      <span className="flex items-center gap-2">
                        {!item.read ? (
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: "var(--color-brand-blue)" }} />
                        ) : null}
                        <span
                          className="truncate text-[13px] font-semibold"
                          style={{ color: "var(--text-strong)", opacity: item.read ? 0.75 : 1 }}
                        >
                          {item.title}
                        </span>
                      </span>
                      <span className="mt-1 block text-[12px] leading-snug" style={{ color: "var(--text-muted)" }}>
                        {truncate(item.body, 96)}
                      </span>
                      <span className="mt-1.5 block text-[10.5px] font-medium" style={{ color: "var(--text-faint)" }}>
                        {relativeTime(item.createdAt)} · {item.author.name.split(" ")[0]}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="animate-rise">
            <CardHeader
              icon="ticket"
              title="Activity passes"
              subtitle="Upcoming and pending requests."
              action={
                <LinkButton href="/passes" size="sm" variant="ghost" iconRight="chevron-right">
                  All
                </LinkButton>
              }
            />
            {data.passes.length === 0 ? (
              <EmptyState
                compact
                icon="ticket"
                title="No upcoming passes"
                description="Request one when you need to be off the floor during session hours."
                action={
                  <LinkButton href="/passes" size="sm" variant="secondary" icon="plus">
                    Request a pass
                  </LinkButton>
                }
              />
            ) : (
              <ul className="flex flex-col gap-2">
                {data.passes.map((pass) => (
                  <li key={pass.id} className="inset-panel p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-semibold" style={{ color: "var(--text-strong)" }}>
                          {pass.destination}
                        </p>
                        <p className="mt-0.5 text-[11.5px]" style={{ color: "var(--text-muted)" }}>
                          {formatDay(pass.date, "medium")} · {pass.fromTime}–{pass.toTime}
                        </p>
                      </div>
                      <StatusBadge status={pass.status} />
                    </div>
                    {pass.status === "APPROVED" ? (
                      <p className="mt-2 font-mono text-[11px]" style={{ color: "var(--color-brand-green)" }}>
                        {pass.passCode}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <StudentQuickLinks isStaff={canOpenConsole(user as PermissionSubject)} />
        </div>
      </div>
    </div>
  );
}

function TodayChip({
  done,
  label,
  detail,
  href,
}: {
  done: boolean;
  label: string;
  detail: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      data-accent={done ? "green" : "amber"}
      className="flex flex-col items-center gap-1.5 rounded-[13px] border px-4 py-3 transition-transform hover:-translate-y-0.5"
      style={{ borderColor: "var(--tone)", background: "var(--tone-soft)" }}
    >
      <span
        className={done ? "grid h-8 w-8 place-items-center rounded-full" : "grid h-8 w-8 place-items-center rounded-full animate-pulse-ring"}
        style={{ background: "var(--tone)", color: "#fff" }}
      >
        <Icon name={done ? "check" : "clock"} className="h-[17px] w-[17px]" />
      </span>
      <span className="text-[11px] font-bold uppercase tracking-[0.07em]" style={{ color: "var(--tone)" }}>
        {label}
      </span>
      <span className="text-[10.5px] font-medium tabular-nums" style={{ color: "var(--text-muted)" }}>
        {detail}
      </span>
    </Link>
  );
}

function StudentQuickLinks({ isStaff }: { isStaff: boolean }) {
  return (
    <Card className="animate-rise">
      <CardHeader icon="sparkle" title="Quick actions" />
      <div className="grid grid-cols-2 gap-2">
        <StudentQuickLink href="/worklog" icon="clipboard" label="Log today's work" tone="blue" />
        <StudentQuickLink href="/passes" icon="ticket" label="Request a pass" tone="amber" />
        <StudentQuickLink href="/profile#linkedin-tracker" icon="linkedin" label="Submit LinkedIn post" tone="green" />
        {isStaff ? (
          <StudentQuickLink href="/console" icon="chart" label="Admin console" tone="red" />
        ) : (
          <StudentQuickLink href="/leaderboard" icon="trophy" label="Leaderboard" tone="red" />
        )}
      </div>
    </Card>
  );
}

function StudentQuickLink({
  href,
  icon,
  label,
  tone,
}: {
  href: string;
  icon: "clipboard" | "ticket" | "note" | "chart" | "trophy" | "linkedin";
  label: string;
  tone: "blue" | "red" | "amber" | "green";
}) {
  return (
    <Link
      href={href}
      data-accent={tone}
      className="inset-panel flex flex-col gap-2 p-3 transition-colors hover:border-[var(--tone)]"
    >
      <span
        className="grid h-8 w-8 place-items-center rounded-[9px]"
        style={{ background: "var(--tone-soft)", color: "var(--tone)" }}
      >
        <Icon name={icon} className="h-[17px] w-[17px]" />
      </span>
      <span className="text-[12.5px] font-semibold leading-snug" style={{ color: "var(--text-strong)" }}>
        {label}
      </span>
    </Link>
  );
}
