import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/shell/PageHeader";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { ProgressRing } from "@/components/ui/Progress";
import { requireUser } from "@/lib/auth";
import { ROLE_LABEL, type Role } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { attendanceSummary, leaderboardRank } from "@/lib/queries";
import { StudentLinkedinSection } from "@/components/features/StudentLinkedinSection";
import { matchesMentor } from "@/lib/leaves";
import { cn, titleCase } from "@/lib/utils";

import { PasswordForm, ProfileLinksForm, ProfilePreferencesCard } from "./ProfileClient";

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
      {/* 1. Hero Profile Banner with Interactive Metric Shortcuts           */}
      {/* ------------------------------------------------------------------ */}
      <Card thread className="mb-4 sm:mb-5">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          {/* Identity & Badges */}
          <div className="flex items-center gap-4">
            <Avatar name={user.name} seed={user.id} size={64} ring />
            <div className="min-w-0">
              <h2 className="text-[20px] font-bold leading-tight text-[var(--text-strong)]" style={{ letterSpacing: "-0.028em" }}>
                {titleCase(user.name)}
              </h2>
              <p className="mt-1 font-mono text-[12.5px] text-[var(--text-muted)]">
                {user.rollNo}
              </p>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                <Badge tone="blue">{ROLE_LABEL[user.role as Role] ?? user.role}</Badge>
                <Badge tone={user.systemStatus === "ACTIVE" ? "green" : "red"} dot>
                  {user.systemStatus.toLowerCase()}
                </Badge>
                {user.domain ? (
                  <Badge tone="slate">{user.domain}</Badge>
                ) : null}
              </div>
            </div>
          </div>

          {/* Attendance Ring & Interactive Quick Actions */}
          <div className="flex flex-wrap items-center gap-3 sm:gap-5 border-t lg:border-t-0 pt-4 lg:pt-0 border-[var(--line-soft)]">
            <div className="flex items-center gap-3 pr-2">
              <ProgressRing
                value={attendance.rate}
                size={72}
                thickness={7.5}
                tone={attendance.rate >= 85 ? "green" : attendance.rate >= 70 ? "amber" : "red"}
                sublabel="attend."
              />
              <div className="text-left">
                <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-faint)]">Rate</p>
                <p className="text-[17px] font-bold text-[var(--text-strong)] tabular-nums">{attendance.rate}%</p>
                <p className="text-[10.5px] text-[var(--text-muted)]">{attendance.hoursLogged}/{attendance.hoursPossible} hrs</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 sm:gap-2.5">
              {/* Reward Points Tile */}
              <Link
                href="/rewards"
                className="group flex flex-col justify-between rounded-xl border border-[var(--line-soft)] bg-[var(--surface-inset)] p-2.5 transition-all hover:border-[var(--color-brand-blue)] hover:shadow-xs active:scale-95"
                title="View points history & score breakdown"
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[9.5px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                    Points
                  </span>
                  <Icon name="arrow-up-right" className="h-3 w-3 text-[var(--text-faint)] group-hover:text-[var(--color-brand-blue)] transition-colors" />
                </div>
                <p className="mt-1 text-[16px] font-bold text-[var(--text-strong)] tabular-nums leading-none">
                  {user.rewardPoints} <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400">pts</span>
                </p>
              </Link>

              {/* Leaderboard Tile */}
              <Link
                href="/leaderboard"
                className="group flex flex-col justify-between rounded-xl border border-[var(--line-soft)] bg-[var(--surface-inset)] p-2.5 transition-all hover:border-[var(--color-brand-blue)] hover:shadow-xs active:scale-95"
                title="View cohort rankings"
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[9.5px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
                    Rank
                  </span>
                  <Icon name="arrow-up-right" className="h-3 w-3 text-[var(--text-faint)] group-hover:text-[var(--color-brand-blue)] transition-colors" />
                </div>
                <p className="mt-1 text-[16px] font-bold text-[var(--text-strong)] tabular-nums leading-none">
                  {rank ? `#${rank.position}` : "—"}
                </p>
              </Link>

              {/* Private Notes Tile */}
              <Link
                href="/notes"
                className="group flex flex-col justify-between rounded-xl border border-[var(--line-soft)] bg-[var(--surface-inset)] p-2.5 transition-all hover:border-[var(--color-brand-blue)] hover:shadow-xs active:scale-95"
                title="Open private scratchpad"
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[9.5px] font-bold uppercase tracking-wider text-[var(--color-brand-blue)]">
                    Notes
                  </span>
                  <Icon name="arrow-up-right" className="h-3 w-3 text-[var(--text-faint)] group-hover:text-[var(--color-brand-blue)] transition-colors" />
                </div>
                <p className="mt-1 text-[13.5px] font-bold text-[var(--text-strong)] leading-none">
                  Scratchpad
                </p>
              </Link>
            </div>
          </div>
        </div>
      </Card>

      {/* ------------------------------------------------------------------ */}
      {/* 2. Structured Two-Column Content Grid                              */}
      {/* ------------------------------------------------------------------ */}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] sm:gap-5">
        {/* Left Column: Academic & Programme Details + Build in Public */}
        <div className="flex min-w-0 flex-col gap-4 sm:gap-5">
          {isStudentOrAdmin ? (
            <Card>
              <CardHeader
                icon="user"
                title="Academic & Mentor Details"
                subtitle="Your academic profile and assigned faculty mentor."
              />

              <div className="space-y-6">
                {/* 1. Student Details (Google Account List Style) */}
                <div>
                  <div className="flex items-center gap-2 mb-2 px-1">
                    <span className="text-[11.5px] font-semibold text-[var(--color-brand-blue)] font-sans uppercase tracking-wider">
                      Student Details
                    </span>
                  </div>

                  <dl className="rounded-2xl border border-[var(--line-soft)] bg-[var(--surface-sunken)]/30 p-1 sm:p-2 divide-y divide-[var(--line-soft)]">
                    <GoogleInfoRow label="Name" value={titleCase(user.name)} />
                    <GoogleInfoRow label="College Email" value={user.email} />
                    <GoogleInfoRow label="Contact Number" value={user.mobile || "—"} />
                    <GoogleInfoRow label="Department" value={titleCase(user.department) || "—"} />
                    <GoogleInfoRow label="Roll Number" value={user.rollNo} />
                    <GoogleInfoRow label="Gender" value={displayGender} isLast />
                  </dl>
                </div>

                {/* 2. Assigned Faculty Mentor (Google Workspace Profile Card Style) */}
                <div className="rounded-2xl border border-[var(--line-soft)] bg-[var(--surface-sunken)]/40 p-4 sm:p-5">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3.5 mb-3.5 border-b border-[var(--line-soft)]">
                    <div className="flex items-center gap-3">
                      <Avatar name={mentorDisplayName} seed={academicMentor?.rollNo || mentorDisplayName} size={44} ring />
                      <div>
                        <span className="text-[11px] font-semibold text-[var(--color-brand-blue)] font-sans uppercase tracking-wider block">
                          Assigned Faculty Mentor
                        </span>
                        <h4 className="text-[16px] font-semibold text-[var(--text-strong)] leading-snug font-sans">
                          {mentorDisplayName}
                        </h4>
                        <p className="text-[12.5px] text-[var(--text-muted)] font-sans">
                          {mentorDesignation} · {academicMentor?.department || titleCase(user.department) || "BIT"}
                        </p>
                      </div>
                    </div>

                    {/* Quick Contact Action Chips */}
                    <div className="flex items-center gap-2 shrink-0">
                      {academicMentor?.email && academicMentor.email !== "—" ? (
                        <a
                          href={`mailto:${academicMentor.email}`}
                          className="inline-flex items-center gap-1.5 rounded-full border border-[var(--line-default)] bg-[var(--surface-raised)] px-3.5 py-1.5 text-[12px] font-medium text-[var(--color-brand-blue)] hover:bg-[var(--color-brand-blue-050)] hover:border-[var(--color-brand-blue)] active:scale-95 transition-all shadow-xs font-sans"
                        >
                          <Icon name="mail" className="h-3.5 w-3.5 text-[var(--color-brand-blue)]" />
                          Email
                        </a>
                      ) : null}

                      {academicMentor?.mobile && academicMentor.mobile !== "—" ? (
                        <a
                          href={`tel:${academicMentor.mobile.replace(/\s+/g, "")}`}
                          className="inline-flex items-center gap-1.5 rounded-full border border-[var(--line-default)] bg-[var(--surface-raised)] px-3.5 py-1.5 text-[12px] font-medium text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 hover:border-emerald-300 active:scale-95 transition-all shadow-xs font-sans"
                        >
                          <Icon name="phone" className="h-3.5 w-3.5" />
                          Call
                        </a>
                      ) : null}
                    </div>
                  </div>

                  {/* Mentor Detailed Rows (Clean, non-repetitive) */}
                  <dl className="rounded-xl bg-[var(--surface-raised)] p-1 sm:p-2 divide-y divide-[var(--line-soft)] border border-[var(--line-soft)]">
                    <GoogleInfoRow label="Faculty ID" value={academicMentor?.rollNo || "—"} />
                    <GoogleInfoRow label="Official Email" value={academicMentor?.email || "—"} />
                    <GoogleInfoRow label="Phone Number" value={academicMentor?.mobile || "—"} />
                    <GoogleInfoRow label="Department" value={academicMentor?.department || titleCase(user.department) || "—"} />
                    <GoogleInfoRow label="Designation" value={mentorDesignation} isLast />
                  </dl>
                </div>
              </div>
            </Card>
          ) : (
            /* Faculty Mentor Profile Card */
            <Card>
              <CardHeader
                icon="shield"
                title="Faculty Mentor Details"
                subtitle="Official faculty record in the portal."
              />
              <dl className="rounded-2xl border border-[var(--line-soft)] bg-[var(--surface-sunken)]/30 p-1 sm:p-2 divide-y divide-[var(--line-soft)]">
                <GoogleInfoRow
                  label="Faculty Name"
                  value={user.legend ? `${user.legend}. ${titleCase(user.name)}` : titleCase(user.name)}
                />
                <GoogleInfoRow label="Faculty ID" value={user.rollNo} />
                <GoogleInfoRow label="Designation" value={user.designation || "Faculty Mentor"} />
                <GoogleInfoRow label="Department" value={titleCase(user.department) || "—"} />
                <GoogleInfoRow label="Official Email" value={user.email} />
                <GoogleInfoRow label="Phone Number" value={user.mobile || "—"} isLast />
              </dl>
            </Card>
          )}

          {/* Build in Public Section */}
          <StudentLinkedinSection initialPosts={linkedinPosts} />
        </div>

        {/* Right Column: Editable Links, App Preferences & Account Security */}
        <div className="flex min-w-0 flex-col gap-4 sm:gap-5">
          {/* Editable Contact & Social Links */}
          <ProfileLinksForm
            initial={{ mobile: user.mobile, linkedin: user.linkedin, github: user.github }}
          />

          {/* App Preferences & PWA Download */}
          <ProfilePreferencesCard />

          {/* Password Security Form */}
          <div id="security" className="scroll-mt-20">
            <PasswordForm mustChange={user.mustChangePassword} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function GoogleInfoRow({
  label,
  value,
  isLast = false,
}: {
  label: string;
  value: React.ReactNode;
  isLast?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col sm:flex-row sm:items-center justify-between py-2.5 sm:py-3 px-2 sm:px-3 gap-0.5 sm:gap-4 transition-colors hover:bg-[var(--surface-sunken)]/50 rounded-xl",
        !isLast && "border-b border-[var(--line-soft)]"
      )}
    >
      <dt className="text-[12.5px] sm:text-[13px] font-normal text-[var(--text-muted)] shrink-0 sm:w-40 font-sans">
        {label}
      </dt>
      <dd className="text-[13.5px] sm:text-[14px] font-medium text-[var(--text-strong)] break-words font-sans sm:text-right">
        {value || "—"}
      </dd>
    </div>
  );
}
