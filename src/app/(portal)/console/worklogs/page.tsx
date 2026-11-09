import type { Metadata } from "next";

import { PageHeader } from "@/components/shell/PageHeader";
import { LinkButton } from "@/components/ui/Button";
import { StatTile } from "@/components/ui/StatTile";
import { requirePermission, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { filterOptions } from "@/lib/queries";
import { toDayKey, startOfMonth, endOfMonth } from "@/lib/dates";
import { markSectionViewed } from "@/lib/badge-tracking";

import { WorklogReview, type ReviewRow } from "./WorklogReview";
import { WorklogConsoleShell } from "./WorklogConsoleShell";
import type { GridRow } from "./WorklogMonthlyGrid";

export const metadata: Metadata = { title: "Worklog review" };
export const dynamic = "force-dynamic";

export default async function ConsoleWorklogsPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    domain?: string;
    year?: string;
    date?: string;
    view?: string;
    month?: string;
  }>;
}) {
  await requirePermission("permWorklogs");
  const user = await requireUser();
  await markSectionViewed(user.id, "console_worklogs");
  const params = await searchParams;

  const status = params.status ?? "SUBMITTED";
  const domain = params.domain ?? "ALL";
  const year = params.year ?? "ALL";
  const date = params.date ?? "";
  const view = params.view ?? "list";
  const today = toDayKey();
  const month = params.month ?? today.slice(0, 7);

  // ── List view data ──────────────────────────────────────────────────────
  const where = {
    ...(status !== "ALL" ? { status } : {}),
    ...(date ? { date } : {}),
    ...(domain !== "ALL" || year !== "ALL"
      ? {
          user: {
            ...(domain !== "ALL" ? { domain } : {}),
            ...(year !== "ALL" ? { year } : {}),
          },
        }
      : {}),
  };

  const [logs, options, counts] = await Promise.all([
    prisma.worklog.findMany({
      where,
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: 120,
      select: {
        id: true, date: true, s1: true, s2: true, s3: true, s4: true, s5: true,
        status: true, mentorRemark: true,
        task: { select: { title: true } },
        user: { select: { id: true, name: true, rollNo: true, domain: true, year: true } },
      },
    }),
    filterOptions(),
    Promise.all([
      prisma.worklog.count({ where: { status: "SUBMITTED" } }),
      prisma.worklog.count({ where: { status: "FLAGGED" } }),
      prisma.worklog.count({ where: { status: "REVIEWED" } }),
      prisma.worklog.count({ where: { date: today } }),
    ]),
  ]);

  const [awaiting, flagged, reviewed, todayCount] = counts;

  const rows: ReviewRow[] = logs.map((log) => ({
    id: log.id,
    date: log.date,
    s1: log.s1,
    s2: log.s2,
    s3: log.s3,
    s4: log.s4,
    s5: log.s5,
    status: log.status,
    mentorRemark: log.mentorRemark,
    taskTitle: log.task?.title ?? null,
    student: log.user,
  }));

  // ── Monthly grid data ───────────────────────────────────────────────────
  const monthFrom = `${month}-01`;
  const monthTo = endOfMonth(monthFrom);

  const [monthlyLogs, allStudents] = await Promise.all([
    prisma.worklog.findMany({
      where: {
        date: { gte: monthFrom, lte: monthTo },
        user: { role: { in: ["STUDENT", "STUDENT_ADMIN", "ADMIN"] } },
      },
      select: {
        id: true, date: true, s1: true, s2: true, s3: true, s4: true, s5: true,
        status: true, mentorRemark: true,
        user: { select: { id: true, name: true, rollNo: true, role: true, domain: true, year: true } },
      },
      orderBy: { date: "asc" },
    }),
    prisma.user.findMany({
      where: { role: { in: ["STUDENT", "STUDENT_ADMIN", "ADMIN"] }, systemStatus: "ACTIVE" },
      select: { id: true, name: true, rollNo: true, role: true, domain: true, year: true, department: true },
      orderBy: { name: "asc" },
    }),
  ]);

  // Build grid rows — one per student
  const gridRows: GridRow[] = allStudents.map((student) => {
    const studentLogs = monthlyLogs.filter((l) => l.user.id === student.id);
    const logsMap: GridRow["logs"] = {};
    for (const l of studentLogs) {
      logsMap[l.date] = {
        id: l.id,
        status: l.status,
        s1: l.s1,
        s2: l.s2,
        s3: l.s3,
        s4: l.s4,
        s5: l.s5,
        mentorRemark: l.mentorRemark,
      };
    }
    return {
      studentId: student.id,
      name: student.name,
      rollNo: student.rollNo ?? "",
      role: student.role,
      domain: student.domain ?? "",
      year: student.year ?? "",
      department: student.department ?? "",
      logs: logsMap,
    };
  });

  return (
    <div>
      <PageHeader
        title="Worklog review"
        description="Read what students actually did and sign it off. A flag sends the log back with your remark attached, and the student can revise and resubmit."
        actions={
          <LinkButton href="/api/export?table=worklogs" variant="secondary" icon="download" size="sm">
            Export CSV
          </LinkButton>
        }
      />

      <div className="stagger mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Awaiting review"
          value={awaiting}
          icon="clock"
          tone={awaiting > 20 ? "red" : awaiting > 0 ? "amber" : "green"}
          caption={awaiting === 0 ? "Queue is clear" : "Sitting with you"}
        />
        <StatTile
          label="Flagged"
          value={flagged}
          icon="flag"
          tone={flagged > 0 ? "red" : "slate"}
          caption="Sent back for revision"
        />
        <StatTile label="Signed off" value={reviewed} icon="check-circle" tone="green" caption="All time" />
        <StatTile label="Submitted today" value={todayCount} icon="calendar" tone="blue" />
      </div>

      <WorklogConsoleShell
        view={view as "list" | "grid"}
        month={month}
        reviewLogs={rows}
        gridRows={gridRows}
        options={{ domains: options.domains, years: options.years }}
        filters={{ status, domain, year, date }}
      />
    </div>
  );
}
