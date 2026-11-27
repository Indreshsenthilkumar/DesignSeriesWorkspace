import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/shell/PageHeader";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { ProgressRing } from "@/components/ui/Progress";
import { requireUser } from "@/lib/auth";
import { PERMISSION_LABEL, ROLE_LABEL, type Permission, type Role } from "@/lib/constants";
import { grantedPermissions, type PermissionSubject } from "@/lib/permissions";
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
                subtitle="Your cohort enrollment and assigned faculty mentor."
              />

              <div className="space-y-5">
                {/* 1. Student Programme Enrollment Details */}
                <div>
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2.5 font-sans">
                    Student Details
                  </h4>
                  <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <ProfileInfoTile label="NAME" value={titleCase(user.name)} />
                    <ProfileInfoTile label="COLLEGE EMAIL" value={user.email} />
                    <ProfileInfoTile label="CONTACT NUMBER" value={user.mobile || "—"} />
                    <ProfileInfoTile label="DEPARTMENT" value={titleCase(user.department) || "—"} />
                    <ProfileInfoTile label="ROLL NUMBER" value={user.rollNo} />
                    <ProfileInfoTile label="GENDER" value={displayGender} />
                  </dl>
                </div>

                {/* 2. Assigned Faculty Mentor Details */}
                <div className="rounded-2xl border border-[var(--line-soft)] bg-[var(--surface-sunken)]/60 p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3.5 pb-3.5 border-b border-[var(--line-soft)]">
                    <div>
                      <span className="text-[10.5px] font-bold uppercase tracking-wider text-[var(--color-brand-blue)] font-sans">
                        Assigned Faculty Mentor
                      </span>
                      <h3 className="text-[16px] font-bold text-[var(--text-strong)] leading-snug font-sans">
                        {mentorDisplayName}
                      </h3>
                      <p className="text-[12px] text-[var(--text-muted)] font-sans">
                        {mentorDesignation} · {academicMentor?.department || titleCase(user.department) || "BIT"}
                      </p>
                    </div>

                    {/* Quick Contact Buttons */}
                    <div className="flex items-center gap-2">
                      {academicMentor?.email && academicMentor.email !== "—" ? (
                        <a
                          href={`mailto:${academicMentor.email}`}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--line-default)] bg-[var(--surface-raised)] px-3 py-1.5 text-[12px] font-semibold text-[var(--text-strong)] hover:border-[var(--color-brand-blue)] active:scale-95 transition-all shadow-xs font-sans"
                        >
                          <Icon name="mail" className="h-3.5 w-3.5 text-[var(--color-brand-blue)]" />
                          Email
                        </a>
                      ) : null}

                      {academicMentor?.mobile && academicMentor.mobile !== "—" ? (
                        <a
                          href={`tel:${academicMentor.mobile.replace(/\s+/g, "")}`}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--line-default)] bg-[var(--surface-raised)] px-3 py-1.5 text-[12px] font-semibold text-[var(--text-strong)] hover:border-[var(--color-brand-blue)] active:scale-95 transition-all shadow-xs font-sans"
                        >
                          <Icon name="phone" className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                          Call
                        </a>
                      ) : null}
                    </div>
                  </div>

                  {/* Mentor Detailed Grid */}
                  <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <ProfileInfoTile label="MENTOR NAME" value={mentorDisplayName} />
                    <ProfileInfoTile label="FACULTY ID" value={academicMentor?.rollNo || "—"} />
                    <ProfileInfoTile label="OFFICIAL EMAIL" value={academicMentor?.email || "—"} />
                    <ProfileInfoTile label="PHONE NUMBER" value={academicMentor?.mobile || "—"} />
                    <ProfileInfoTile label="DEPARTMENT" value={academicMentor?.department || titleCase(user.department) || "—"} />
                    <ProfileInfoTile label="DESIGNATION" value={mentorDesignation} />
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
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <ProfileInfoTile
                  label="FACULTY NAME"
                  value={user.legend ? `${user.legend}. ${titleCase(user.name)}` : titleCase(user.name)}
                />
                <ProfileInfoTile label="FACULTY ID" value={user.rollNo} />
                <ProfileInfoTile label="DESIGNATION" value={user.designation || "Faculty Mentor"} />
                <ProfileInfoTile label="DEPARTMENT" value={titleCase(user.department) || "—"} />
                <ProfileInfoTile label="OFFICIAL EMAIL" value={user.email} />
                <ProfileInfoTile label="PHONE NUMBER" value={user.mobile || "—"} />
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

          {/* Unlocked Console Permissions (Shown only if special permissions exist) */}
          {permissions.length > 0 ? (
            <Card>
              <CardHeader
                icon="shield"
                title="Administrative Access"
                subtitle={`${permissions.length} console ${permissions.length === 1 ? "module" : "modules"} unlocked.`}
              />
              <ul className="flex flex-wrap gap-1.5">
                {permissions.map((permission) => (
                  <li key={permission}>
                    <Badge tone="green" icon="check">
                      {PERMISSION_LABEL[permission as Permission]}
                    </Badge>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function ProfileInfoTile({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-[var(--line-soft)] bg-[var(--surface-raised)] p-3 sm:p-3.5 flex flex-col justify-between transition-colors hover:border-[var(--line-strong)]">
      <dt className="text-[10px] sm:text-[10.5px] font-bold uppercase tracking-[0.12em] text-[var(--text-muted)] font-sans">
        {label}
      </dt>
      <dd className="mt-1 text-[13px] sm:text-[13.5px] font-semibold text-[var(--text-strong)] leading-snug break-words font-sans">
        {value}
      </dd>
    </div>
  );
}
