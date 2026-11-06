import type { Metadata } from "next";

import { PageHeader } from "@/components/shell/PageHeader";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader, DataRow } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { ProgressRing } from "@/components/ui/Progress";
import { requireUser } from "@/lib/auth";
import { PERMISSION_LABEL, ROLE_LABEL, type Permission, type Role } from "@/lib/constants";
import { formatDay, relativeTime, toDayKey } from "@/lib/dates";
import { grantedPermissions, type PermissionSubject } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { attendanceSummary, leaderboardRank } from "@/lib/queries";
import { StudentLinkedinSection } from "@/components/features/StudentLinkedinSection";
import { matchesMentor } from "@/lib/leaves";
import { cn, titleCase } from "@/lib/utils";

import { PasswordForm, ProfileLinksForm } from "./ProfileClient";

export const metadata: Metadata = { title: "Profile" };
export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const user = await requireUser();

  const [attendance, rank, worklogCount, taskCount, passCount, linkedinCount, linkedinPosts] = await Promise.all([
    attendanceSummary(user.id, { days: 30, joinedAt: user.createdAt }),
    leaderboardRank(user.id),
    prisma.worklog.count({ where: { userId: user.id } }),
    prisma.task.count({ where: { assigneeId: user.id, status: "DONE" } }),
    prisma.activityPass.count({ where: { userId: user.id, status: "APPROVED" } }),
    prisma.linkedinPost.count({ where: { userId: user.id, verified: true } }),
    prisma.linkedinPost.findMany({
      where: { userId: user.id },
      orderBy: { postedOn: "desc" },
      select: {
        id: true,
        url: true,
        caption: true,
        postedOn: true,
        reactions: true,
        comments: true,
        verified: true,
        createdAt: true,
      },
    }),
  ]);

  const permissions = grantedPermissions(user as PermissionSubject);

  let academicMentor: {
    name: string;
    rollNo: string;
    department: string;
    gender: string;
    legend: string;
    email: string;
    mobile: string;
    designation: string;
  } | null = null;

  const isStudentOrAdmin =
    user.role === "STUDENT" ||
    user.role === "STUDENT_ADMIN" ||
    user.role === "ADMIN" ||
    user.role === "SUPER_ADMIN";

  if (isStudentOrAdmin && user.mentorName && user.mentorName.trim()) {
    const rawMentorName = user.mentorName.trim();
    const potentialMentors = await prisma.user.findMany({
      where: {
        role: { in: ["MENTOR", "ADMIN", "SUPER_ADMIN"] },
      },
      select: {
        id: true,
        name: true,
        rollNo: true,
        department: true,
        gender: true,
        legend: true,
        email: true,
        mobile: true,
        designation: true,
      },
    });

    const found = potentialMentors.find(
      (m) =>
        m.name.toLowerCase() === rawMentorName.toLowerCase() ||
        m.rollNo.toLowerCase() === rawMentorName.toLowerCase() ||
        matchesMentor(rawMentorName, m.name) ||
        rawMentorName.toLowerCase().includes(m.name.toLowerCase()) ||
        m.name.toLowerCase().includes(rawMentorName.toLowerCase())
    );

    if (found) {
      academicMentor = {
        name: found.name,
        rollNo: found.rollNo,
        department: found.department,
        gender: found.gender,
        legend: found.legend,
        email: found.email,
        mobile: found.mobile,
        designation: found.designation,
      };
    } else {
      academicMentor = {
        name: rawMentorName,
        rollNo: "—",
        department: user.department || "—",
        gender: "—",
        legend: "—",
        email: "—",
        mobile: "—",
        designation: "Faculty Mentor",
      };
    }
  }

  // Data cleaning & gender inference (resolves legacy mojibake like â€“ / Â·)
  const rawYear = user.year || "";
  const cleanedYear = rawYear
    .replace(/â\x80\x93|â€\s*|â€“/g, "–")
    .replace(/Â·/g, "·")
    .replace(/\s+/g, " ")
    .trim();
  const displayYear = cleanedYear.replace(/\s*·\s*(Male|Female)\b/gi, "").trim() || "—";

  let displayGender = user.gender?.trim();
  if (!displayGender && rawYear) {
    if (/\bfemale\b/i.test(rawYear)) displayGender = "Female";
    else if (/\bmale\b/i.test(rawYear)) displayGender = "Male";
  }
  if (!displayGender) displayGender = "—";

  const mentorDesignation = (academicMentor?.designation || (user.mentorName ? "Faculty Mentor" : "—"))
    .replace(/\bProff\b/i, "Professor");

  const rawMentorDisplay = academicMentor?.name || (user.mentorName ? user.mentorName.split("-")[0].trim() : "Not assigned");
  const mentorLegend = academicMentor?.legend || "";
  const cleanedMentorName = rawMentorDisplay.replace(/^(dr|mr|mrs|ms)\.?\s+/i, "");
  const mentorDisplayName = mentorLegend && cleanedMentorName !== "Not assigned"
    ? `${mentorLegend}. ${titleCase(cleanedMentorName)}`
    : titleCase(rawMentorDisplay);

  return (
    <div>
      <PageHeader
        title="Profile"
        description="Your record in the DesignSeries programme, and the account settings you control."
      />

      {/* ------------------------------------------------------------------ */}
      {/* Identity banner                                                     */}
      {/* ------------------------------------------------------------------ */}
      <Card thread className="mb-4 sm:mb-5">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <div className="flex items-center gap-4">
            <Avatar name={user.name} seed={user.id} size={68} ring />
            <div className="min-w-0">
              <h2 className="text-[20px] font-bold leading-tight" style={{ letterSpacing: "-0.028em" }}>
                {titleCase(user.name)}
              </h2>
              <p className="mt-1 font-mono text-[12.5px]" style={{ color: "var(--text-muted)" }}>
                {user.rollNo}
              </p>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                <Badge tone="blue">{ROLE_LABEL[user.role as Role] ?? user.role}</Badge>
                <Badge tone={user.systemStatus === "ACTIVE" ? "green" : "red"} dot>
                  {user.systemStatus.toLowerCase()}
                </Badge>
                {rank ? <Badge tone="amber" icon="trophy">Rank {rank.position} of {rank.total}</Badge> : null}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-5 sm:ml-auto">
            <ProgressRing
              value={attendance.rate}
              size={78}
              thickness={8}
              tone={attendance.rate >= 85 ? "green" : attendance.rate >= 70 ? "amber" : "red"}
              sublabel="attend."
            />
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              <MiniStat label="Points" value={user.rewardPoints} tone="amber" />
              <MiniStat label="Worklogs" value={worklogCount} tone="blue" />
              <MiniStat label="Tasks done" value={taskCount} tone="green" />
              <MiniStat label="Passes" value={passCount} tone="red" />
            </div>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] sm:gap-5">
        <div className="flex min-w-0 flex-col gap-4 sm:gap-5">
          {/* If the user is STUDENT / STUDENT + ADMIN / ADMIN:
              User details will be displayed on one grid card and Academic Mentor details on one card */}
          {isStudentOrAdmin ? (
            <>
              {/* Card 1: User Details Grid Card */}
              <Card>
                <CardHeader
                  icon="user"
                  title="User Details"
                  subtitle="Your personal & academic programme record."
                />
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-3.5">
                  <ProfileInfoTile label="NAME" value={titleCase(user.name)} />
                  <ProfileInfoTile label="ROLL NUMBER" value={user.rollNo} mono />
                  <ProfileInfoTile label="DEPARTMENT" value={titleCase(user.department) || "—"} />
                  <ProfileInfoTile label="EMAIL" value={user.email} mono />
                  <ProfileInfoTile label="YEAR" value={displayYear} />
                  <ProfileInfoTile label="MENTOR" value={mentorDisplayName} />
                  <ProfileInfoTile label="GENDER" value={displayGender} />
                  <ProfileInfoTile label="DOMAIN" value={user.domain || "—"} />
                </dl>
              </Card>

              {/* Card 2: Academic Mentor Details Card */}
              <Card>
                <CardHeader
                  icon="shield"
                  title="Academic Mentor Details"
                  subtitle="Assigned faculty mentor."
                />
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-3.5">
                  <ProfileInfoTile label="NAME" value={mentorDisplayName} />
                  <ProfileInfoTile label="ID" value={academicMentor?.rollNo || "—"} mono />
                  <ProfileInfoTile label="DEPARTMENT" value={academicMentor?.department || "—"} />
                  <ProfileInfoTile label="GENDER" value={academicMentor?.gender || "—"} />
                  <ProfileInfoTile label="LEGEND" value={academicMentor?.legend || "—"} />
                  <ProfileInfoTile label="EMAIL" value={academicMentor?.email || "—"} mono />
                  <ProfileInfoTile label="PHONE" value={academicMentor?.mobile || "—"} mono />
                  <ProfileInfoTile label="DESIGNATION" value={mentorDesignation} />
                </dl>
              </Card>
            </>
          ) : (
            /* Faculty Mentor Profile Card */
            <Card>
              <CardHeader
                icon="shield"
                title="Faculty Mentor Details"
                subtitle="Official faculty record in the portal."
              />
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-3.5">
                <ProfileInfoTile
                  label="Faculty Name"
                  value={user.legend ? `${user.legend}. ${titleCase(user.name)}` : titleCase(user.name)}
                />
                <ProfileInfoTile label="Faculty ID" value={user.rollNo} mono />
                <ProfileInfoTile label="Faculty Designation" value={user.designation || "Faculty Mentor"} />
                <ProfileInfoTile label="Faculty Department" value={titleCase(user.department) || "—"} />
                <ProfileInfoTile label="Gender" value={user.gender || "—"} />
                <ProfileInfoTile label="Legend" value={user.legend || "—"} />
                <ProfileInfoTile label="Faculty Official Email" value={user.email} mono />
                <ProfileInfoTile label="Faculty Phone" value={user.mobile || "—"} mono />
              </dl>
            </Card>
          )}

          <ProfileLinksForm
            initial={{ mobile: user.mobile, linkedin: user.linkedin, github: user.github }}
          />

          <StudentLinkedinSection initialPosts={linkedinPosts} />

          <div id="security" className="scroll-mt-20">
            <PasswordForm mustChange={user.mustChangePassword} />
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-4 sm:gap-5">
          <Card>
            <CardHeader icon="chart" title="At a glance" subtitle="Last 30 days." />
            <ul className="flex flex-col gap-2.5">
              <GlanceRow
                tone={attendance.rate >= 75 ? "green" : "red"}
                icon="check-circle"
                label="Attendance"
                value={`${attendance.rate}%`}
                detail={`${attendance.hoursLogged} of ${attendance.hoursPossible} hours`}
              />
              <GlanceRow
                tone="blue"
                icon="calendar"
                label="Full days"
                value={String(attendance.fullDays)}
                detail={`out of ${attendance.daysTracked} tracked days`}
              />
              <GlanceRow
                tone="amber"
                icon="sparkle"
                label="Current streak"
                value={`${attendance.streak} days`}
                detail="consecutive days present"
              />
              <GlanceRow
                tone="red"
                icon="linkedin"
                label="Verified posts"
                value={String(linkedinCount)}
                detail="build-in-public submissions"
              />
            </ul>
          </Card>

          <Card>
            <CardHeader
              icon="shield"
              title="Access"
              subtitle={
                permissions.length === 0
                  ? "You have the standard student access."
                  : `${permissions.length} console ${permissions.length === 1 ? "module" : "modules"} unlocked.`
              }
            />
            {permissions.length === 0 ? (
              <div className="inset-panel flex items-start gap-2.5 p-3">
                <Icon name="user" className="mt-px h-4 w-4 shrink-0" style={{ color: "var(--text-muted)" }} />
                <p className="text-[12.5px] leading-snug" style={{ color: "var(--text-muted)" }}>
                  Student access: your own attendance, worklogs, tasks, passes and notes. Everything
                  in your account is visible only to you and the DesignSeries staff.
                </p>
              </div>
            ) : (
              <ul className="flex flex-wrap gap-1.5">
                {permissions.map((permission) => (
                  <li key={permission}>
                    <Badge tone="green" icon="check">
                      {PERMISSION_LABEL[permission as Permission]}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader icon="link" title="Links" />
            <div className="flex flex-col gap-2">
              <ExternalLink
                href={user.linkedin}
                icon="linkedin"
                label="LinkedIn"
                placeholder="Not added yet"
              />
              <ExternalLink href={user.github} icon="github" label="GitHub" placeholder="Not added yet" />
              <ExternalLink
                href={user.mobile ? `tel:${user.mobile}` : ""}
                icon="phone"
                label={user.mobile || "No number on file"}
                placeholder="No number on file"
                plain
              />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function MiniStat({ label, value, tone }: { label: string; value: number; tone: "blue" | "red" | "amber" | "green" }) {
  return (
    <div data-accent={tone}>
      <p className="text-[19px] font-bold leading-none tabular-nums" style={{ color: "var(--tone)", letterSpacing: "-0.03em" }}>
        {value}
      </p>
      <p className="mt-1 text-[10.5px] font-semibold uppercase tracking-[0.09em]" style={{ color: "var(--text-faint)" }}>
        {label}
      </p>
    </div>
  );
}

function GlanceRow({
  tone,
  icon,
  label,
  value,
  detail,
}: {
  tone: "blue" | "red" | "amber" | "green";
  icon: "check-circle" | "calendar" | "sparkle" | "linkedin";
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <li data-accent={tone} className="flex items-center gap-3">
      <span
        className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px]"
        style={{ background: "var(--tone-soft)", color: "var(--tone)" }}
      >
        <Icon name={icon} className="h-[17px] w-[17px]" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[12.5px] font-semibold" style={{ color: "var(--text-strong)" }}>
          {label}
        </span>
        <span className="block truncate text-[11px]" style={{ color: "var(--text-muted)" }}>
          {detail}
        </span>
      </span>
      <span className="shrink-0 text-[14px] font-bold tabular-nums" style={{ color: "var(--tone)" }}>
        {value}
      </span>
    </li>
  );
}

function ExternalLink({
  href,
  icon,
  label,
  placeholder,
  plain = false,
}: {
  href: string;
  icon: "linkedin" | "github" | "phone";
  label: string;
  placeholder: string;
  plain?: boolean;
}) {
  if (!href) {
    return (
      <span className="inset-panel flex items-center gap-2.5 p-2.5 text-[12.5px]" style={{ color: "var(--text-faint)" }}>
        <Icon name={icon} className="h-4 w-4" />
        {placeholder}
      </span>
    );
  }

  return (
    <a
      href={href}
      target={plain ? undefined : "_blank"}
      rel={plain ? undefined : "noopener noreferrer"}
      className="inset-panel flex items-center gap-2.5 p-2.5 text-[12.5px] font-medium transition-colors hover:border-[var(--accent)]"
      style={{ color: "var(--text-default)" }}
    >
      <Icon name={icon} className="h-4 w-4 shrink-0" style={{ color: "var(--text-muted)" }} />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {plain ? null : <Icon name="arrow-up-right" className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--text-faint)" }} />}
    </a>
  );
}

function ProfileInfoTile({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="rounded-xl border border-[var(--line-soft)] bg-[var(--surface-sunken)]/50 p-3 sm:p-3.5 flex flex-col justify-between transition-colors hover:border-[var(--line-strong)]">
      <dt className="text-[10px] sm:text-[10.5px] font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">
        {label}
      </dt>
      <dd
        className={cn(
          "mt-1 text-[13px] sm:text-[13.5px] font-semibold text-[var(--text-strong)] leading-snug break-words",
          mono && "font-mono text-[12px]"
        )}
      >
        {value}
      </dd>
    </div>
  );
}
