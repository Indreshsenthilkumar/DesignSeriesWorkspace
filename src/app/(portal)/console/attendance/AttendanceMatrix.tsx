"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { PersonCell } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { Modal } from "@/components/ui/Modal";
import { ProgressBar } from "@/components/ui/Progress";
import { useToast } from "@/components/ui/Toast";
import { ATTENDANCE_HOURS, HOUR_WINDOW } from "@/lib/constants";
import { formatDay, weekdayShort } from "@/lib/dates";
import { cn, shortYear } from "@/lib/utils";
import { ExportAttendanceModal } from "@/components/features/ExportAttendanceModal";
import { BulkImportAttendanceModal } from "@/components/features/BulkImportAttendanceModal";

export type MatrixStudent = {
  id: string;
  name: string;
  rollNo: string;
  year: string;
  domain: string;
  mentorName: string;
  role?: string;
  hours: number;
  rate: number;
  fullDays: number;
  daysPresent: number;
  perDay: number[];
  dayDetails?: Record<string, { hours: number[]; reason: string; status: string }>;
};

/**
 * The roster attendance grid across all members (students, mentors, admins).
 *
 * One row per member, one cell per tracked day, shaded by logged hours.
 * Admins can click any cell or '+ Add' to view, log, or edit attendance for anyone,
 * including themselves.
 */
export function AttendanceMatrix({
  students,
  trackedDays,
  from,
  to,
  options,
  filters,
}: {
  students: MatrixStudent[];
  trackedDays: string[];
  from: string;
  to: string;
  options: { years: string[]; domains: string[]; roles?: string[] };
  filters: { year: string; domain: string; role?: string };
}) {
  const router = useRouter();
  const toast = useToast();

  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"name" | "rate" | "hours" | "role">("rate");
  const [manualEntry, setManualEntry] = useState<{ student: MatrixStudent; date?: string } | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [deleteRangeOpen, setDeleteRangeOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = q
      ? students.filter(
          (s) =>
            `${s.name} ${s.rollNo} ${s.domain} ${s.role || ""}`.toLowerCase().includes(q)
        )
      : students;

    return [...rows].sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name);
      if (sort === "hours") return b.hours - a.hours;
      if (sort === "role") return (a.role || "").localeCompare(b.role || "");
      return a.rate - b.rate; // lowest attendance first
    });
  }, [students, query, sort]);

  const applyRange = (nextFrom: string, nextTo: string, nextYear: string, nextDomain: string, nextRole: string) => {
    const query = new URLSearchParams({ from: nextFrom, to: nextTo });
    if (nextYear !== "ALL") query.set("year", nextYear);
    if (nextDomain !== "ALL") query.set("domain", nextDomain);
    if (nextRole !== "ALL") query.set("role", nextRole);
    router.push(`/console/attendance?${query.toString()}`);
  };

  const average = students.length
    ? Math.round(students.reduce((sum, s) => sum + s.rate, 0) / students.length)
    : 0;

  const currentRole = filters.role || "ALL";

  return (
    <>
      <Card className="mb-4">
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-6">
          <Field label="From" htmlFor="m-from">
            <Input
              id="m-from"
              type="date"
              defaultValue={from}
              max={to}
              onChange={(e) => applyRange(e.target.value, to, filters.year, filters.domain, currentRole)}
            />
          </Field>
          <Field label="To" htmlFor="m-to">
            <Input
              id="m-to"
              type="date"
              defaultValue={to}
              min={from}
              onChange={(e) => applyRange(from, e.target.value, filters.year, filters.domain, currentRole)}
            />
          </Field>
          <Field label="Role" htmlFor="m-role">
            <Select
              id="m-role"
              defaultValue={currentRole}
              onChange={(e) => applyRange(from, to, filters.year, filters.domain, e.target.value)}
            >
              <option value="ALL">All roles</option>
              <option value="STUDENT">Students</option>
              <option value="MENTOR">Mentors</option>
              <option value="ADMIN">Admins</option>
            </Select>
          </Field>
          <Field label="Year" htmlFor="m-year">
            <Select
              id="m-year"
              defaultValue={filters.year}
              onChange={(e) => applyRange(from, to, e.target.value, filters.domain, currentRole)}
            >
              <option value="ALL">All years</option>
              {options.years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Domain" htmlFor="m-domain">
            <Select
              id="m-domain"
              defaultValue={filters.domain}
              onChange={(e) => applyRange(from, to, filters.year, e.target.value, currentRole)}
            >
              <option value="ALL">All domains</option>
              {options.domains.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Search" htmlFor="m-search">
            <Input
              id="m-search"
              icon="search"
              placeholder="Name, roll no, role"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </Field>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Badge tone={average >= 75 ? "green" : "amber"}>Roster average {average}%</Badge>
          <Badge tone="slate">{trackedDays.length} tracked days</Badge>
          <Badge tone="slate">{filtered.length} members</Badge>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              icon="upload"
              onClick={() => setImportOpen(true)}
            >
              Import Sheet / CSV
            </Button>

            <Button
              variant="secondary"
              size="sm"
              icon="download"
              onClick={() => setExportOpen(true)}
            >
              Export
            </Button>

            <Button
              variant="secondary"
              size="sm"
              icon="trash"
              onClick={() => setDeleteRangeOpen(true)}
              className="text-red-600 hover:text-red-700 hover:border-red-300 dark:text-red-400"
            >
              Delete Logs
            </Button>

            <div className="flex items-center gap-1 rounded-[10px] border p-0.5" style={{ borderColor: "var(--line-default)" }}>
              {(["rate", "hours", "name", "role"] as const).map((key) => (
                <button
                  key={key}
                  onClick={() => setSort(key)}
                  className="h-7 rounded-[8px] px-2.5 text-[12px] font-semibold capitalize transition-colors"
                  style={{
                    background: sort === key ? "var(--accent-soft)" : "transparent",
                    color: sort === key ? "var(--accent)" : "var(--text-muted)",
                  }}
                >
                  {key === "rate" ? "Lowest first" : key}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {filtered.length === 0 ? (
        <EmptyState icon="search" title="No members match" description="Widen the date range or clear the filters." />
      ) : (
        <Card padded={false}>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead style={{ background: "var(--surface-inset)" }}>
                <tr>
                  <th
                    scope="col"
                    className="sticky left-0 z-10 min-w-[210px] border-b px-3.5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.07em]"
                    style={{ color: "var(--text-muted)", borderColor: "var(--line-soft)", background: "var(--surface-inset)" }}
                  >
                    Member (Students / Mentors / Admins)
                  </th>
                  <th
                    scope="col"
                    className="min-w-[120px] border-b px-3.5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.07em]"
                    style={{ color: "var(--text-muted)", borderColor: "var(--line-soft)" }}
                  >
                    Rate
                  </th>
                  {trackedDays.map((day) => (
                    <th
                      key={day}
                      scope="col"
                      title={formatDay(day, "long")}
                      className="border-b px-1 py-2.5 text-center text-[9.5px] font-semibold"
                      style={{ color: "var(--text-faint)", borderColor: "var(--line-soft)" }}
                    >
                      <span className="block">{weekdayShort(day).slice(0, 1)}</span>
                      <span className="block tabular-nums">{Number(day.slice(8))}</span>
                    </th>
                  ))}
                  <th className="border-b px-3.5 text-right text-[11px] font-semibold uppercase tracking-[0.07em]" style={{ borderColor: "var(--line-soft)", color: "var(--text-muted)" }}>
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((student) => {
                  const role = student.role || "STUDENT";
                  const roleTone = role === "ADMIN" ? "red" : role === "MENTOR" ? "amber" : "slate";

                  return (
                    <tr key={student.id} className="border-b last:border-0 hover:bg-[var(--surface-inset)]/30 transition-colors" style={{ borderColor: "var(--line-soft)" }}>
                      <td
                        className="sticky left-0 z-10 px-3.5 py-2"
                        style={{ background: "var(--surface-raised)" }}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <Link href={`/console/people/${student.id}`} className="min-w-0 flex-1">
                            <PersonCell
                              name={student.name}
                              seed={student.id}
                              meta={`${student.rollNo || "Staff"} · ${student.year ? shortYear(student.year) : student.domain || "Core"}`}
                              size={30}
                            />
                          </Link>
                          <Badge tone={roleTone} className="shrink-0 text-[10px] uppercase font-bold py-0.5 px-1.5">
                            {role}
                          </Badge>
                        </div>
                      </td>
                      <td className="px-3.5 py-2">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-9 shrink-0 text-[12.5px] font-bold tabular-nums"
                            style={{
                              color:
                                student.rate >= 85
                                  ? "var(--color-brand-green)"
                                  : student.rate >= 75
                                    ? "var(--text-strong)"
                                    : "var(--color-brand-red)",
                            }}
                          >
                            {student.rate}%
                          </span>
                          <ProgressBar
                            value={student.rate}
                            tone={student.rate >= 85 ? "green" : student.rate >= 75 ? "blue" : student.rate >= 50 ? "amber" : "red"}
                            height={5}
                            className="w-14"
                          />
                        </div>
                      </td>

                      {student.perDay.map((count, index) => {
                        const dateKey = trackedDays[index];
                        const dayInfo = student.dayDetails?.[dateKey];
                        const ratio = count / ATTENDANCE_HOURS.length;
                        const tone = count === 0 ? "slate" : ratio >= 1 ? "green" : ratio >= 0.5 ? "amber" : "red";
                        const tooltip = `${formatDay(dateKey, "medium")}: ${count}/${ATTENDANCE_HOURS.length} hrs${
                          dayInfo?.reason ? ` • "${dayInfo.reason}"` : ""
                        } (Click to edit)`;

                        return (
                          <td key={dateKey} className="px-0.5 py-2 text-center">
                            <button
                              type="button"
                              onClick={() => setManualEntry({ student, date: dateKey })}
                              data-accent={tone}
                              title={tooltip}
                              aria-label={tooltip}
                              className={cn(
                                "mx-auto block h-6 w-6 rounded-[5px] transition-transform hover:scale-115 hover:ring-2 hover:ring-[var(--accent)] cursor-pointer focus:outline-none"
                              )}
                              style={{
                                background:
                                  count > 0
                                    ? `color-mix(in srgb, var(--tone) ${28 + ratio * 52}%, var(--surface-raised))`
                                    : "var(--surface-sunken)",
                              }}
                            />
                          </td>
                        );
                      })}

                      <td className="px-3.5 py-2 text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          icon="plus"
                          onClick={() => setManualEntry({ student })}
                        >
                          Add / Edit
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center gap-3 border-t px-4 py-3 text-[10.5px]" style={{ borderColor: "var(--line-soft)", color: "var(--text-faint)" }}>
            <Legend tone="green" label="Full day (7 hrs)" />
            <Legend tone="amber" label="Half or more (4–6 hrs)" />
            <Legend tone="red" label="Under half (1–3 hrs)" />
            <Legend tone="slate" label="Absent / No log" />
            <span className="ml-auto">Click any day cell to edit/add logs. Sundays are excluded.</span>
          </div>
        </Card>
      )}

      {manualEntry ? (
        <ManualEntryDialog
          student={manualEntry.student}
          initialDate={manualEntry.date}
          onClose={() => setManualEntry(null)}
          onSaved={() => {
            setManualEntry(null);
            toast.success("Attendance saved", "The record has been updated and logged in the audit trail.");
            router.refresh();
          }}
        />
      ) : null}

      <ExportAttendanceModal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        defaultFrom={from}
        defaultTo={to}
        currentYear={filters.year}
        currentDomain={filters.domain}
      />

      <BulkImportAttendanceModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onSuccess={() => router.refresh()}
      />

      <DeleteAttendanceRangeModal
        open={deleteRangeOpen}
        onClose={() => setDeleteRangeOpen(false)}
        onSuccess={() => router.refresh()}
        defaultFrom={from}
        defaultTo={to}
        students={students}
      />
    </>
  );
}

function Legend({ tone, label }: { tone: "green" | "amber" | "red" | "slate"; label: string }) {
  return (
    <span data-accent={tone} className="flex items-center gap-1.5">
      <span className="h-3 w-3 rounded-[3px]" style={{ background: tone === "slate" ? "var(--surface-sunken)" : "var(--tone)" }} />
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------

function ManualEntryDialog({
  student,
  initialDate,
  onClose,
  onSaved,
}: {
  student: MatrixStudent;
  initialDate?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(initialDate || today);
  
  // Existing data for current date
  const existingForDate = student.dayDetails?.[date];
  const hasExistingLogs = Boolean(existingForDate && existingForDate.hours.length > 0);

  const [hours, setHours] = useState<Set<number>>(() =>
    existingForDate && existingForDate.hours.length > 0
      ? new Set(existingForDate.hours)
      : new Set(ATTENDANCE_HOURS)
  );
  const [status, setStatus] = useState(() => existingForDate?.status || "PRESENT");
  const [reason, setReason] = useState(() => existingForDate?.reason || "");
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);

  // Sync state when date is changed
  useEffect(() => {
    const dayData = student.dayDetails?.[date];
    if (dayData && dayData.hours.length > 0) {
      setHours(new Set(dayData.hours));
      setStatus(dayData.status || "PRESENT");
      setReason(dayData.reason || "");
    } else {
      setHours(new Set(ATTENDANCE_HOURS));
      setStatus("PRESENT");
      setReason("");
    }
  }, [date, student.dayDetails]);

  const toggle = (hour: number) => {
    setHours((current) => {
      const next = new Set(current);
      if (next.has(hour)) next.delete(hour);
      else next.add(hour);
      return next;
    });
  };

  const save = async () => {
    if (hours.size === 0) {
      toast.warning("Pick at least one hour", "Select the hours to record or use 'Clear' to remove attendance.");
      return;
    }
    setSaving(true);
    try {
      const response = await fetch("/api/attendance", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: student.id,
          date,
          hours: [...hours].sort((a, b) => a - b),
          status,
          reason: reason.trim() || `Admin manual entry for ${student.name}`,
        }),
      });
      const payload = await response.json();
      if (!payload.ok) {
        toast.error("Could not record attendance", payload.error);
        return;
      }
      onSaved();
    } catch {
      toast.error("Network problem", "Failed to update attendance.");
    } finally {
      setSaving(false);
    }
  };

  const clearDayAttendance = async () => {
    setClearing(true);
    try {
      const response = await fetch("/api/attendance", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: student.id,
          date,
        }),
      });
      const payload = await response.json();
      if (!payload.ok) {
        toast.error("Could not clear attendance", payload.error);
        return;
      }
      toast.success("Attendance cleared", `Removed attendance for ${student.name} on ${date}.`);
      onSaved();
    } catch {
      toast.error("Network problem", "Failed to clear attendance.");
    } finally {
      setClearing(false);
    }
  };

  const role = student.role || "STUDENT";
  const roleTone = role === "ADMIN" ? "red" : role === "MENTOR" ? "amber" : "slate";

  return (
    <Modal
      open
      onClose={onClose}
      title={`Log / Edit Attendance — ${student.name}`}
      description="Record or adjust attendance hours. This updates official records and logs all actions to the audit trail."
      size="md"
      footer={
        <div className="flex items-center justify-between w-full">
          <div>
            {hasExistingLogs ? (
              <Button
                variant="ghost"
                onClick={() => setConfirmClearOpen(true)}
                loading={clearing}
                disabled={saving}
                className="text-red-600 hover:text-red-700 dark:text-red-400"
              >
                Clear Day
              </Button>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={onClose} disabled={saving || clearing}>
              Cancel
            </Button>
            <Button onClick={save} loading={saving} disabled={clearing}>
              {hasExistingLogs ? "Update Attendance" : "Record Attendance"}
            </Button>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        {/* User preview header */}
        <div className="flex items-center justify-between gap-3 p-3 rounded-[10px] bg-[var(--surface-sunken)] border border-[var(--line-subtle)]">
          <div className="flex items-center gap-2.5">
            <PersonCell
              name={student.name}
              seed={student.id}
              meta={`${student.rollNo || "Staff"} · ${student.domain || "Core"}`}
              size={32}
            />
          </div>
          <Badge tone={roleTone} className="text-[11px] font-bold">
            {role}
          </Badge>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Date" htmlFor="me-date" required>
            <Input
              id="me-date"
              type="date"
              value={date}
              max={today}
              onChange={(e) => setDate(e.target.value)}
            />
          </Field>
          <Field label="Status" htmlFor="me-status" required>
            <Select id="me-status" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="PRESENT">Present</option>
              <option value="LATE">Late</option>
              <option value="EXCUSED">Excused</option>
              <option value="ABSENT">Absent (recorded)</option>
            </Select>
          </Field>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[12px] font-semibold text-[var(--text-default)]">
              Hours ({hours.size} selected)
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setHours(new Set(ATTENDANCE_HOURS))}
                className="text-[11.5px] font-semibold text-[var(--accent)] hover:underline"
              >
                All (1–7)
              </button>
              <span className="text-[var(--text-faint)]">•</span>
              <button
                type="button"
                onClick={() => setHours(new Set())}
                className="text-[11.5px] font-semibold text-[var(--text-muted)] hover:underline"
              >
                Clear
              </button>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
            {ATTENDANCE_HOURS.map((hour) => {
              const on = hours.has(hour);
              return (
                <button
                  key={hour}
                  type="button"
                  data-accent={on ? "blue" : "slate"}
                  onClick={() => toggle(hour)}
                  title={`Hour ${hour} (${HOUR_WINDOW[hour]})`}
                  className={cn(
                    "flex flex-col items-center rounded-[10px] border py-2 transition-all cursor-pointer select-none",
                    on
                      ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)] shadow-xs"
                      : "border-[var(--line-default)] bg-[var(--surface-raised)] text-[var(--text-muted)] hover:border-[var(--text-faint)]"
                  )}
                >
                  <span className="text-[15px] font-bold tabular-nums leading-none">{hour}</span>
                  <span className="mt-1 text-[9px] font-semibold uppercase tracking-[0.06em]">
                    {on ? "On" : "Off"}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <Field
          label="Reason / Note"
          htmlFor="me-reason"
          help="Describe reason for manual entry or edit. Visible in attendance history."
        >
          <Textarea
            id="me-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Attended session / Verified with coordinator / Mentor approved."
            rows={2}
          />
        </Field>

        <p className="flex items-start gap-2 text-[11.5px] text-[var(--text-faint)]">
          <Icon name="shield" className="mt-px h-3.5 w-3.5 shrink-0 text-[var(--accent)]" />
          Entries are marked as admin-sourced and recorded in the audit log against your account.
        </p>
      </div>

      {confirmClearOpen && (
        <Modal
          open
          onClose={() => setConfirmClearOpen(false)}
          title="Confirm Deletion"
          description={`Are you sure you want to delete the attendance log for ${student.name} on ${formatDay(date, "medium")}? This action cannot be undone.`}
          size="sm"
          footer={
            <div className="flex items-center justify-end gap-2 w-full">
              <Button
                variant="secondary"
                onClick={() => setConfirmClearOpen(false)}
                disabled={clearing}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={async () => {
                  setConfirmClearOpen(false);
                  await clearDayAttendance();
                }}
                loading={clearing}
              >
                Yes, Delete Log
              </Button>
            </div>
          }
        >
          <p className="text-[13px] text-[var(--text-muted)]">
            This will permanently remove the logged attendance records for {student.name} ({student.rollNo}) on {formatDay(date, "long")}.
          </p>
        </Modal>
      )}
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Delete Attendance Range Modal (Allows Admin to pick From & To date with confirmation)
// ---------------------------------------------------------------------------

function DeleteAttendanceRangeModal({
  open,
  onClose,
  onSuccess,
  defaultFrom,
  defaultTo,
  students,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  defaultFrom: string;
  defaultTo: string;
  students: MatrixStudent[];
}) {
  const toast = useToast();
  const [fromDate, setFromDate] = useState(defaultFrom);
  const [toDate, setToDate] = useState(defaultTo);
  const [selectedUserId, setSelectedUserId] = useState<string>("ALL");
  const [confirmPopupOpen, setConfirmPopupOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const selectedStudent = students.find((s) => s.id === selectedUserId);
  const targetLabel =
    selectedUserId === "ALL"
      ? "All Cohort Members"
      : selectedStudent
      ? `${selectedStudent.name} (${selectedStudent.rollNo})`
      : selectedUserId;

  const handleDelete = async () => {
    if (!fromDate || !toDate) {
      toast.warning("Select date range", "Please select both from and to dates.");
      return;
    }
    if (fromDate > toDate) {
      toast.warning("Invalid range", "From date must be earlier than or equal to To date.");
      return;
    }

    setDeleting(true);
    try {
      const response = await fetch("/api/attendance", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: selectedUserId === "ALL" ? undefined : selectedUserId,
          fromDate,
          toDate,
        }),
      });

      const payload = await response.json();
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Failed to delete attendance logs.");
      }

      toast.success(
        "Attendance logs deleted",
        `Successfully deleted ${payload.removed ?? 0} attendance record(s) from ${formatDay(fromDate, "medium")} to ${formatDay(toDate, "medium")}.`
      );
      setConfirmPopupOpen(false);
      onClose();
      onSuccess();
    } catch (err: any) {
      toast.error("Deletion failed", err.message || "Failed to delete attendance records.");
    } finally {
      setDeleting(false);
    }
  };

  if (!open) return null;

  return (
    <>
      <Modal
        open={open && !confirmPopupOpen}
        onClose={onClose}
        title="Delete Missed OTP Attendance Logs"
        description="Select from date and to date to remove attendance logs from the database."
        size="md"
        footer={
          <div className="flex items-center justify-between w-full">
            <Button variant="secondary" onClick={onClose} disabled={deleting}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                if (!fromDate || !toDate) {
                  toast.warning("Select dates", "Please enter both from and to dates.");
                  return;
                }
                if (fromDate > toDate) {
                  toast.warning("Invalid range", "From date cannot be after To date.");
                  return;
                }
                setConfirmPopupOpen(true);
              }}
            >
              Proceed to Delete…
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label="Target Member" htmlFor="del-user">
            <Select
              id="del-user"
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
            >
              <option value="ALL">All Cohort Members ({students.length})</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.rollNo || "No Roll"} · {s.role || "STUDENT"})
                </option>
              ))}
            </Select>
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="From Date" htmlFor="del-from" required>
              <Input
                id="del-from"
                type="date"
                value={fromDate}
                max={toDate}
                onChange={(e) => setFromDate(e.target.value)}
                required
              />
            </Field>

            <Field label="To Date" htmlFor="del-to" required>
              <Input
                id="del-to"
                type="date"
                value={toDate}
                min={fromDate}
                onChange={(e) => setToDate(e.target.value)}
                required
              />
            </Field>
          </div>

          <div className="rounded-[10px] border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-600 dark:text-amber-400 space-y-1">
            <div className="flex items-center gap-1.5 font-bold">
              <Icon name="alert" className="h-4 w-4" />
              <span>Confirmation Required</span>
            </div>
            <p>
              Deleting attendance records will permanently remove them from the database and recalculate attendance stats. A confirmation popup will ask you to confirm before any records are deleted.
            </p>
          </div>
        </div>
      </Modal>

      {/* Confirmation Popup Modal */}
      {confirmPopupOpen && (
        <Modal
          open
          onClose={() => setConfirmPopupOpen(false)}
          title="Confirm Deletion of Attendance Logs"
          description="Please confirm that you want to delete these attendance records."
          size="sm"
          footer={
            <div className="flex items-center justify-end gap-2 w-full">
              <Button
                variant="secondary"
                onClick={() => setConfirmPopupOpen(false)}
                disabled={deleting}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={handleDelete}
                loading={deleting}
              >
                Yes, Permanently Delete
              </Button>
            </div>
          }
        >
          <div className="space-y-3">
            <p className="text-[13px] text-[var(--text-strong)] leading-relaxed">
              Are you sure you want to permanently delete missed OTP attendance logs for{" "}
              <strong>{targetLabel}</strong> from{" "}
              <strong>{formatDay(fromDate, "medium")}</strong> to{" "}
              <strong>{formatDay(toDate, "medium")}</strong>?
            </p>
            <p className="text-[12px] text-red-500 font-semibold">
              Warning: This action cannot be undone. All matching attendance logs will be removed immediately from the database.
            </p>
          </div>
        </Modal>
      )}
    </>
  );
}
