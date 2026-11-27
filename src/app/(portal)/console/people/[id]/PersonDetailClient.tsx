"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { PageHeader } from "@/components/shell/PageHeader";
import { Avatar } from "@/components/ui/Avatar";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { Button, LinkButton } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/Icon";
import { ConfirmDialog } from "@/components/ui/Modal";
import { MiniBars, ProgressRing } from "@/components/ui/Progress";
import { StatGrid, StatTile } from "@/components/ui/StatTile";
import { useToast } from "@/components/ui/Toast";
import { ATTENDANCE_HOURS, PERMISSION_LABEL, ROLE_LABEL, WORKLOG_SLOTS, type Permission, type Role } from "@/lib/constants";
import { formatDay, relativeTime } from "@/lib/dates";
import { cn, titleCase } from "@/lib/utils";

import { ManageDialog, type PersonRow } from "../PeopleClient";

export type PersonDetailClientProps = {
  person: PersonRow;
  actorRole: string;
  canManage: boolean;
  options: { departments: string[]; years: string[]; domains: string[]; mentors: string[] };
  attendance: {
    rate: number;
    streak: number;
    fullDays: number;
    hoursLogged: number;
    hoursPossible: number;
    byDay: { key: string; value: number }[];
  } | null;
  worklogs: Array<{
    id: string;
    date: string;
    s1?: string | null;
    s2?: string | null;
    s3?: string | null;
    s4?: string | null;
    s5?: string | null;
    status: string;
    mentorRemark?: string | null;
  }>;
  tasks: Array<{
    id: string;
    title: string;
    status: string;
    priority: string;
    dueDate: string | null;
    points: number;
  }>;
  passes: Array<{
    id: string;
    date: string;
    destination: string;
    status: string;
    fromTime: string;
    toTime: string;
  }>;
  linkedin: Array<{
    id: string;
    url: string;
    postedOn: string;
    verified: boolean;
    reactions: number;
  }>;
  rewards: Array<{
    id: string;
    points: number;
    reason: string;
    source: string;
  }>;
  createdAtStr: string;
  mustChangePassword: boolean;
};

export function PersonDetailClient({
  person,
  actorRole,
  canManage,
  options,
  attendance,
  worklogs,
  tasks,
  passes,
  linkedin,
  rewards,
  createdAtStr,
  mustChangePassword,
}: PersonDetailClientProps) {
  const router = useRouter();
  const toast = useToast();

  const [editing, setEditing] = useState(false);
  const [suspending, setSuspending] = useState<PersonRow | null>(null);
  const [busy, setBusy] = useState(false);

  const doneTasks = tasks.filter((t) => t.status === "DONE").length;

  const permissionsList = Object.entries(person.permissions)
    .filter(([, granted]) => granted)
    .map(([perm]) => perm as Permission);

  const suspend = async () => {
    if (!suspending) return;
    setBusy(true);
    try {
      const response = await fetch("/api/admin/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: suspending.id }),
      });
      const payload = await response.json();
      if (!payload.ok) {
        toast.error("Could not suspend account", payload.error);
        return;
      }
      toast.success(
        suspending.systemStatus === "ACTIVE" ? "Account suspended" : "Account reactivated",
        "The directory record and session permissions have been updated."
      );
      setSuspending(null);
      router.refresh();
    } catch {
      toast.error("Network problem");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      {/* Breadcrumb Navigation */}
      <div className="mb-3">
        <Link
          href="/console/people"
          className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-[var(--text-muted)] hover:text-[var(--text-strong)] transition-colors font-sans"
        >
          <Icon name="chevron-left" className="h-3.5 w-3.5" />
          Back to people directory
        </Link>
      </div>

      {/* Page Header with Action CTA */}
      <PageHeader
        title={titleCase(person.name)}
        description={`${person.rollNo} · ${person.email}${person.domain ? ` · ${person.domain}` : ""}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={person.role} label={ROLE_LABEL[person.role as Role]} />
            <StatusBadge status={person.systemStatus} />
            {canManage ? (
              <Button
                variant="primary"
                size="sm"
                icon="settings"
                onClick={() => setEditing(true)}
                className="font-sans"
              >
                Manage Account
              </Button>
            ) : null}
          </div>
        }
      />

      {/* Hero Banner: Identity, Metrics, and Direct Contact Chips */}
      <Card thread className="mb-4 sm:mb-5">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-5">
            <Avatar name={person.name} seed={person.id} size={64} ring />
            <div className="min-w-0">
              <h2 className="text-[20px] font-bold leading-tight text-[var(--text-strong)] font-sans">
                {titleCase(person.name)}
              </h2>
              <p className="mt-0.5 text-[13px] text-[var(--text-muted)] font-sans">
                {person.rollNo} · {person.year || "Batch not set"} · {titleCase(person.department) || "BIT"}
              </p>

              {/* Badges */}
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                <Badge tone="amber" icon="trophy">
                  {person.rewardPoints} points
                </Badge>
                {mustChangePassword ? (
                  <Badge tone="red" icon="lock">
                    Default issued password
                  </Badge>
                ) : null}
                <Badge tone="slate" icon="clock">
                  {person.lastLoginAt ? `Seen ${relativeTime(person.lastLoginAt)}` : "Never signed in"}
                </Badge>
                {person.systemStatus === "SUSPENDED" ? (
                  <Badge tone="red" icon="lock">
                    Suspended
                  </Badge>
                ) : null}
              </div>

              {/* Quick Communication & Action Chips */}
              <div className="mt-3.5 flex flex-wrap items-center gap-2">
                {person.email ? (
                  <a
                    href={`mailto:${person.email}`}
                    className="inline-flex items-center gap-1.5 rounded-full border border-[var(--line-default)] bg-[var(--surface-raised)] px-3 py-1 text-[12px] font-medium text-[var(--color-brand-blue)] hover:bg-[var(--color-brand-blue-050)] hover:border-[var(--color-brand-blue)] active:scale-95 transition-all shadow-xs font-sans"
                  >
                    <Icon name="mail" className="h-3.5 w-3.5 text-[var(--color-brand-blue)]" />
                    Email
                  </a>
                ) : null}

                {person.mobile && person.mobile !== "—" ? (
                  <a
                    href={`tel:${person.mobile.replace(/\s+/g, "")}`}
                    className="inline-flex items-center gap-1.5 rounded-full border border-[var(--line-default)] bg-[var(--surface-raised)] px-3 py-1 text-[12px] font-medium text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 hover:border-emerald-300 active:scale-95 transition-all shadow-xs font-sans"
                  >
                    <Icon name="phone" className="h-3.5 w-3.5" />
                    Call
                  </a>
                ) : null}

                {person.linkedin ? (
                  <a
                    href={person.linkedin}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-full border border-[var(--line-default)] bg-[var(--surface-raised)] px-3 py-1 text-[12px] font-medium text-[var(--text-strong)] hover:border-[var(--color-brand-blue)] active:scale-95 transition-all shadow-xs font-sans"
                  >
                    <Icon name="linkedin" className="h-3.5 w-3.5 text-blue-600" />
                    LinkedIn
                  </a>
                ) : null}

                {person.github ? (
                  <a
                    href={person.github}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-full border border-[var(--line-default)] bg-[var(--surface-raised)] px-3 py-1 text-[12px] font-medium text-[var(--text-strong)] hover:border-[var(--color-brand-blue)] active:scale-95 transition-all shadow-xs font-sans"
                  >
                    <Icon name="github" className="h-3.5 w-3.5 text-purple-600" />
                    GitHub
                  </a>
                ) : null}

                {canManage ? (
                  <button
                    onClick={() => setEditing(true)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-[var(--line-default)] bg-[var(--surface-sunken)] px-3 py-1 text-[12px] font-medium text-[var(--text-strong)] hover:border-[var(--line-strong)] active:scale-95 transition-all shadow-xs font-sans"
                  >
                    <Icon name="settings" className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                    Edit
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          {attendance ? (
            <div className="flex items-center gap-4 pt-3 border-t lg:border-t-0 lg:pt-0 border-[var(--line-soft)]">
              <ProgressRing
                value={attendance.rate}
                size={78}
                thickness={7.5}
                tone={attendance.rate >= 85 ? "green" : attendance.rate >= 70 ? "amber" : "red"}
                sublabel="30 days"
              />
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-faint)] font-sans">Attendance</p>
                <p className="text-[17px] font-bold text-[var(--text-strong)] tabular-nums font-sans">{attendance.rate}%</p>
                <p className="text-[11px] text-[var(--text-muted)] font-sans">
                  {attendance.hoursLogged}/{attendance.hoursPossible} hrs · {attendance.streak}d streak
                </p>
              </div>
            </div>
          ) : null}
        </div>
      </Card>

      {/* KPI Stats Grid */}
      <StatGrid>
        {attendance ? (
          <StatTile
            label="Attendance"
            value={`${attendance.rate}%`}
            icon="check-circle"
            tone={attendance.rate >= 85 ? "green" : attendance.rate >= 70 ? "amber" : "red"}
            caption={`${attendance.fullDays} full days · ${attendance.streak}-day streak`}
          />
        ) : null}
        <StatTile label="Worklogs" value={worklogs.length} icon="clipboard" tone="blue" caption="Most recent shown below" />
        <StatTile label="Tasks done" value={doneTasks} unit={`/ ${tasks.length}`} icon="target" tone="green" />
        <StatTile
          label="Verified posts"
          value={linkedin.filter((p) => p.verified).length}
          icon="linkedin"
          tone="red"
          caption={`${linkedin.length} submitted`}
        />
      </StatGrid>

      {/* Two Column Layout: Main Activity & Detailed Record */}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] sm:gap-5">
        {/* Left Column: Attendance, Worklogs, Tasks */}
        <div className="flex min-w-0 flex-col gap-4 sm:gap-5">
          {attendance ? (
            <Card>
              <CardHeader
                icon="chart"
                title="Attendance Shape"
                subtitle={`${attendance.hoursLogged} of ${attendance.hoursPossible} hours logged over 30 days.`}
                action={
                  <LinkButton href="/console/attendance" size="sm" variant="ghost" iconRight="chevron-right">
                    Matrix
                  </LinkButton>
                }
              />
              <MiniBars
                data={attendance.byDay}
                tone="blue"
                height={72}
                formatLabel={(key, value) => `${formatDay(key, "medium")} — ${value}/${ATTENDANCE_HOURS.length}`}
              />
            </Card>
          ) : null}

          {/* Recent Worklogs */}
          <Card>
            <CardHeader icon="clipboard" title="Recent Worklogs" subtitle="Latest submissions first." />
            {worklogs.length === 0 ? (
              <EmptyState compact icon="clipboard" title="No worklogs submitted yet" />
            ) : (
              <ul className="flex flex-col gap-2.5">
                {worklogs.map((log) => (
                  <li key={log.id} className="rounded-xl border border-[var(--line-soft)] bg-[var(--surface-sunken)]/40 p-3 sm:p-3.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[13px] font-semibold text-[var(--text-strong)] font-sans">
                        {formatDay(log.date, "long")}
                      </span>
                      <StatusBadge status={log.status} />
                    </div>
                    <dl className="mt-2.5 flex flex-col gap-1.5">
                      {WORKLOG_SLOTS.map((slot) => {
                        const value = log[slot.key];
                        if (!value) return null;
                        return (
                          <div key={slot.key} className="flex gap-2.5 sm:gap-3">
                            <dt className="w-14 shrink-0 text-[11px] font-medium text-[var(--text-faint)] font-sans">
                              {slot.label}
                            </dt>
                            <dd className="text-[12.5px] leading-snug text-[var(--text-muted)] font-sans break-words flex-1">
                              {value}
                            </dd>
                          </div>
                        );
                      })}
                    </dl>
                    {log.mentorRemark ? (
                      <p
                        data-accent={log.status === "FLAGGED" ? "red" : "green"}
                        className="mt-2.5 rounded-lg px-2.5 py-1.5 text-[11.5px] font-sans"
                        style={{ background: "var(--tone-soft)", color: "var(--tone)" }}
                      >
                        Mentor: {log.mentorRemark}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* Tasks Assigned */}
          <Card>
            <CardHeader icon="target" title="Assigned Tasks" subtitle={`${tasks.length} tasks recorded.`} />
            {tasks.length === 0 ? (
              <EmptyState compact icon="target" title="No tasks assigned" />
            ) : (
              <ul className="flex flex-col gap-2">
                {tasks.map((task) => (
                  <li key={task.id} className="rounded-xl border border-[var(--line-soft)] bg-[var(--surface-sunken)]/30 flex items-center gap-3 p-3">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-semibold text-[var(--text-strong)] font-sans">
                        {task.title}
                      </span>
                      <span className="block text-[11px] text-[var(--text-muted)] font-sans mt-0.5">
                        {task.dueDate ? `Due ${formatDay(task.dueDate, "medium")}` : "No due date"} · {task.points} pts
                      </span>
                    </span>
                    <StatusBadge status={task.status} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        {/* Right Column: Complete Record & Administrative Capabilities */}
        <div className="flex min-w-0 flex-col gap-4 sm:gap-5">
          {/* Complete Google-styled Record Card */}
          <Card>
            <CardHeader
              icon="user"
              title="Profile & Academic Record"
              subtitle="Personal, cohort and assignment details."
              action={
                canManage ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    icon="settings"
                    onClick={() => setEditing(true)}
                    className="font-sans"
                  >
                    Edit
                  </Button>
                ) : null
              }
            />

            <dl className="rounded-2xl border border-[var(--line-soft)] bg-[var(--surface-sunken)]/30 p-1 sm:p-2 divide-y divide-[var(--line-soft)]">
              {person.role === "MENTOR" ? (
                <>
                  <DetailRow label="Faculty Name" value={person.legend ? `${person.legend}. ${titleCase(person.name)}` : titleCase(person.name)} />
                  <DetailRow label="Faculty ID" value={person.rollNo} />
                  <DetailRow label="Official Email" value={person.email} />
                  <DetailRow label="Phone Number" value={person.mobile || "—"} />
                  <DetailRow label="Department" value={titleCase(person.department) || "—"} />
                  <DetailRow label="Designation" value={person.designation || "Faculty Mentor"} />
                  <DetailRow label="Gender" value={person.gender || "—"} />
                </>
              ) : (
                <>
                  <DetailRow label="Full Name" value={titleCase(person.name)} />
                  <DetailRow label="Roll Number" value={person.rollNo} />
                  <DetailRow label="College Email" value={person.email} />
                  <DetailRow label="Contact Number" value={person.mobile || "—"} />
                  <DetailRow label="Department" value={titleCase(person.department) || "—"} />
                  <DetailRow label="Batch / Year" value={person.year || "—"} />
                  <DetailRow label="Gender" value={person.gender || "—"} />
                  <DetailRow label="Domain" value={person.domain || "—"} />
                  <DetailRow label="Assigned Mentor" value={person.mentorName ? titleCase(person.mentorName.split("-")[0].trim()) : "—"} />
                </>
              )}

              <DetailRow
                label="LinkedIn Profile"
                value={
                  person.linkedin ? (
                    <a
                      href={person.linkedin}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[var(--color-brand-blue)] hover:underline inline-flex items-center gap-1 font-sans"
                    >
                      {person.linkedin.replace(/^https?:\/\/(www\.)?linkedin\.com\/in\//i, "").replace(/\/$/, "") || "Open profile"}
                      <Icon name="arrow-up-right" className="h-3 w-3" />
                    </a>
                  ) : (
                    "—"
                  )
                }
              />
              <DetailRow
                label="GitHub Profile"
                value={
                  person.github ? (
                    <a
                      href={person.github}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[var(--color-brand-blue)] hover:underline inline-flex items-center gap-1 font-sans"
                    >
                      {person.github.replace(/^https?:\/\/(www\.)?github\.com\//i, "").replace(/\/$/, "") || "Open profile"}
                      <Icon name="arrow-up-right" className="h-3 w-3" />
                    </a>
                  ) : (
                    "—"
                  )
                }
              />
              <DetailRow label="Portal Member Since" value={createdAtStr} />
            </dl>
          </Card>

          {/* Console Permissions (if any) */}
          {permissionsList.length > 0 ? (
            <Card>
              <CardHeader
                icon="shield"
                title="Console Permissions"
                subtitle={`${permissionsList.length} console modules granted.`}
              />
              <ul className="flex flex-wrap gap-1.5">
                {permissionsList.map((perm) => (
                  <li key={perm}>
                    <Badge tone="green" icon="check">
                      {PERMISSION_LABEL[perm]}
                    </Badge>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          {/* Activity Passes */}
          <Card>
            <CardHeader icon="ticket" title="Activity Passes" subtitle="Gate passes & approvals." />
            {passes.length === 0 ? (
              <EmptyState compact icon="ticket" title="No passes requested" />
            ) : (
              <ul className="flex flex-col gap-2">
                {passes.map((pass) => (
                  <li key={pass.id} className="flex items-center justify-between border-b py-2.5 last:border-0 border-[var(--line-soft)]">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium text-[var(--text-strong)] font-sans">
                        {pass.destination}
                      </span>
                      <span className="block text-[11px] text-[var(--text-faint)] font-sans">
                        {formatDay(pass.date, "medium")} · {pass.fromTime}–{pass.toTime}
                      </span>
                    </span>
                    <StatusBadge status={pass.status} />
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* Points Ledger */}
          <Card>
            <CardHeader icon="trophy" title="Points Ledger" subtitle={`${person.rewardPoints} total reward points.`} />
            {rewards.length === 0 ? (
              <EmptyState compact icon="trophy" title="No points recorded yet" />
            ) : (
              <ul className="flex flex-col">
                {rewards.map((entry) => (
                  <li key={entry.id} className="flex items-center justify-between gap-3 border-b py-2.5 last:border-0 border-[var(--line-soft)]">
                    <span className="min-w-0 flex-1 truncate text-[12.5px] text-[var(--text-strong)] font-sans">
                      {entry.reason}
                    </span>
                    <span
                      data-accent={entry.points >= 0 ? "green" : "red"}
                      className="shrink-0 text-[13px] font-bold tabular-nums font-sans"
                      style={{ color: "var(--tone)" }}
                    >
                      {entry.points >= 0 ? "+" : ""}
                      {entry.points}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      {/* Editing Dialog Modal */}
      {editing ? (
        <ManageDialog
          person={person}
          options={options}
          actorRole={actorRole}
          onClose={() => setEditing(false)}
          onSuspend={() => {
            setSuspending(person);
            setEditing(false);
          }}
        />
      ) : null}

      {/* Suspend Confirmation Dialog */}
      <ConfirmDialog
        open={Boolean(suspending)}
        onClose={() => setSuspending(null)}
        onConfirm={suspend}
        loading={busy}
        destructive
        title={`Suspend ${suspending?.name ?? "this account"}?`}
        message="They will be signed out and unable to log in. Attendance, worklogs, passes and history are fully preserved."
        confirmLabel="Suspend account"
      />
    </div>
  );
}

// ---------------------------------------------------------------------------

function DetailRow({
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
      <dt className="text-[12.5px] sm:text-[13px] font-normal text-[var(--text-muted)] shrink-0 sm:w-44 font-sans">
        {label}
      </dt>
      <dd className="text-[13.5px] sm:text-[14px] font-medium text-[var(--text-strong)] break-words font-sans sm:text-right">
        {value || "—"}
      </dd>
    </div>
  );
}
