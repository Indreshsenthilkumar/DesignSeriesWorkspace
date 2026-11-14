"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatDay } from "@/lib/dates";
import { ATTENDANCE_HOURS, HOUR_WINDOW } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { StatTile } from "@/components/ui/StatTile";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Field, Textarea } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { PageHeader } from "@/components/shell/PageHeader";
import { Table, TableWrap, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { EmptyRow } from "@/components/ui/EmptyState";
import { CheckInPanel } from "@/components/features/CheckInPanel";
import { BulkImportAttendanceModal } from "@/components/features/BulkImportAttendanceModal";

export interface AttendanceHistoryRecord {
  date: string;
  hours: number[];
  reason: string;
  status: string;
  absentDays?: number;
  createdAt?: string;
}

export interface AttendanceHistoryStats {
  absentDays: number;
  totalHours: number;
  hoursToday: number;
  approvedDays: number;
  hoursDeltaPercent?: number;
  approvedDeltaPercent?: number;
}

interface AttendanceHistoryViewProps {
  stats: AttendanceHistoryStats;
  records: AttendanceHistoryRecord[];
  today: string;
  todayHours: number[];
  todayReason?: string | null;
  closed: boolean;
  canManage?: boolean;
  userId?: string;
}

export function AttendanceHistoryView({
  stats,
  records,
  today,
  todayHours,
  todayReason,
  closed,
  canManage = false,
  userId,
}: AttendanceHistoryViewProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFilter, setDateFilter] = useState("all");
  const [absentFilter, setAbsentFilter] = useState("all");
  const [reasonFilter, setReasonFilter] = useState("all");

  const [addModalOpen, setAddModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<AttendanceHistoryRecord | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = () => {
    setRefreshing(true);
    router.refresh();
    setTimeout(() => {
      setRefreshing(false);
    }, 700);
  };

  // Extract unique non-empty reasons for the filter dropdown
  const uniqueReasons = useMemo(() => {
    const set = new Set<string>();
    records.forEach((r) => {
      if (r.reason && r.reason.trim().length > 0) {
        set.add(r.reason.trim());
      }
    });
    return Array.from(set);
  }, [records]);

  // Filter records based on active toolbar filters
  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      // 1. Search query (matches formatted date or reason/task)
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const formatted = formatDay(r.date, "medium").toLowerCase();
        const matchesDate = r.date.toLowerCase().includes(query) || formatted.includes(query);
        const matchesReason = r.reason.toLowerCase().includes(query);
        if (!matchesDate && !matchesReason) return false;
      }

      // 2. Date filter
      if (dateFilter !== "all") {
        const recordDate = new Date(r.date);
        const now = new Date();
        if (dateFilter === "this-month") {
          if (
            recordDate.getFullYear() !== now.getFullYear() ||
            recordDate.getMonth() !== now.getMonth()
          ) {
            return false;
          }
        } else if (dateFilter === "last-30") {
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(now.getDate() - 30);
          if (recordDate < thirtyDaysAgo) return false;
        } else if (dateFilter === "last-90") {
          const ninetyDaysAgo = new Date();
          ninetyDaysAgo.setDate(now.getDate() - 90);
          if (recordDate < ninetyDaysAgo) return false;
        }
      }

      // 3. Absent Days filter
      if (absentFilter !== "all") {
        const target = parseFloat(absentFilter);
        if (r.absentDays !== target) return false;
      }

      // 4. Reason filter
      if (reasonFilter !== "all") {
        if (r.reason.trim() !== reasonFilter) return false;
      }

      return true;
    });
  }, [records, searchQuery, dateFilter, absentFilter, reasonFilter]);

  const hasActiveFilters =
    searchQuery.trim() !== "" ||
    dateFilter !== "all" ||
    absentFilter !== "all" ||
    reasonFilter !== "all";

  const clearAllFilters = () => {
    setSearchQuery("");
    setDateFilter("all");
    setAbsentFilter("all");
    setReasonFilter("all");
  };

  // Dynamically calculate absent days based on active filter or default to current month
  const displayedAbsentDays = useMemo(() => {
    if (dateFilter === "this-month") {
      const thisMonthPrefix = today.slice(0, 7);
      return filteredRecords
        .filter((r) => r.date.startsWith(thisMonthPrefix))
        .reduce((sum, r) => sum + (r.absentDays ?? 0), 0);
    }
    return filteredRecords.reduce((sum, r) => sum + (r.absentDays ?? 0), 0);
  }, [filteredRecords, dateFilter, today]);

  const absentDaysCaption =
    dateFilter === "this-month"
      ? "This Month"
      : dateFilter === "last-30"
      ? "Last 30 Days"
      : dateFilter === "last-90"
      ? "Last 90 Days"
      : "Total";

  return (
    <div className="space-y-5">
      {/* =====================================================================
          1. Page Header (Consistent Portal Header)
          ===================================================================== */}
      <PageHeader
        title="Missed OTP Attendance history"
        description="Track and manage attendance logs."
        actions={
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            {canManage && (
              <Button
                variant="secondary"
                onClick={() => setImportModalOpen(true)}
                icon="upload"
                className="flex-1 sm:flex-initial"
              >
                Import Sheet / CSV
              </Button>
            )}
            <Button
              onClick={() => setAddModalOpen(true)}
              icon="plus"
              className="flex-1 sm:flex-initial"
            >
              Add attendance hour
            </Button>
          </div>
        }
      />

      {/* =====================================================================
          2. Top 4 KPI Cards (Website Theme StatTile with signature accent bar)
             - Absent Days: 1,2,3,4 = 0.5 day; 5,6,7 = 0.5 day; both = 1.0 day
          ===================================================================== */}
      <div className="stagger mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4 sm:mb-5">
        <StatTile
          label="Absent Days"
          value={displayedAbsentDays.toFixed(1)}
          icon="alert"
          tone={displayedAbsentDays > 3 ? "red" : displayedAbsentDays > 0 ? "amber" : "slate"}
          caption={absentDaysCaption}
        />
        <StatTile
          label="Total Hours"
          value={stats.totalHours}
          unit="hrs"
          icon="clock"
          tone="blue"
          delta={stats.hoursDeltaPercent ?? 8}
          caption="from last month"
        />
        <StatTile
          label="Hours Logged Today"
          value={stats.hoursToday}
          unit="/ 7"
          icon="calendar"
          tone={stats.hoursToday > 0 ? "green" : "blue"}
          caption="Real-time sync"
        />
        <StatTile
          label="Approved"
          value={stats.approvedDays}
          unit="days"
          icon="check-circle"
          tone="green"
          delta={stats.approvedDeltaPercent ?? 15}
          caption="from last month"
        />
      </div>

      {/* =====================================================================
          3. Filter & Action Toolbar (Standalone panel)
          ===================================================================== */}
      <div className="surface p-3.5 sm:p-4 rounded-[14px] flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between shadow-xs">
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Search Input */}
          <div className="relative w-full sm:w-auto min-w-[180px] sm:min-w-[230px] flex-1">
            <Icon
              name="search"
              className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-faint)]"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search logs..."
              className="w-full rounded-[8px] border border-[var(--line-default)] bg-[var(--surface-inset)] py-1.5 pl-8 pr-3 text-[12.5px] text-[var(--text-strong)] placeholder-[var(--text-faint)] transition-colors focus:border-[var(--accent)] focus:bg-[var(--surface-raised)] focus:outline-none"
            />
          </div>

          {/* Date Filter */}
          <div className="relative">
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="appearance-none rounded-[8px] border border-[var(--line-default)] bg-[var(--surface-inset)] py-1.5 pl-7 pr-7 text-[12.5px] font-medium text-[var(--text-default)] transition-colors hover:border-[var(--line-strong)] focus:border-[var(--accent)] focus:outline-none cursor-pointer"
            >
              <option value="all">All Dates</option>
              <option value="this-month">This Month</option>
              <option value="last-30">Last 30 Days</option>
              <option value="last-90">Last 90 Days</option>
            </select>
            <Icon
              name="calendar"
              className="pointer-events-none absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-[var(--text-faint)]"
            />
            <Icon
              name="chevron-down"
              className="pointer-events-none absolute right-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-[var(--text-faint)]"
            />
          </div>

          {/* Absent Days Filter */}
          <div className="relative">
            <select
              value={absentFilter}
              onChange={(e) => setAbsentFilter(e.target.value)}
              className="appearance-none rounded-[8px] border border-[var(--line-default)] bg-[var(--surface-inset)] py-1.5 pl-3 pr-7 text-[12.5px] font-medium text-[var(--text-default)] transition-colors hover:border-[var(--line-strong)] focus:border-[var(--accent)] focus:outline-none cursor-pointer"
            >
              <option value="all">All Absent Days</option>
              <option value="1">1.0 Day Absent</option>
              <option value="0.5">0.5 Day Absent</option>
            </select>
            <Icon
              name="chevron-down"
              className="pointer-events-none absolute right-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-[var(--text-faint)]"
            />
          </div>

          {/* Reason Filter */}
          <div className="relative max-w-[200px]">
            <select
              value={reasonFilter}
              onChange={(e) => setReasonFilter(e.target.value)}
              className="w-full appearance-none truncate rounded-[8px] border border-[var(--line-default)] bg-[var(--surface-inset)] py-1.5 pl-3 pr-7 text-[12.5px] font-medium text-[var(--text-default)] transition-colors hover:border-[var(--line-strong)] focus:border-[var(--accent)] focus:outline-none cursor-pointer"
            >
              <option value="all">All Reasons</option>
              {uniqueReasons.map((reason) => (
                <option key={reason} value={reason}>
                  {reason}
                </option>
              ))}
            </select>
            <Icon
              name="chevron-down"
              className="pointer-events-none absolute right-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-[var(--text-faint)]"
            />
          </div>

          {/* Clear All */}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearAllFilters}
              className="flex items-center gap-1 text-[12px] font-medium text-[var(--text-muted)] hover:text-red-600 transition-colors cursor-pointer"
            >
              <Icon name="close" className="h-3 w-3" />
              Clear All
            </button>
          )}
        </div>

        {/* Right Action: Counter & Refresh Button */}
        <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-[var(--line-soft)]">
          <span className="text-[12px] text-[var(--text-muted)]">
            Showing <span className="font-semibold text-[var(--text-strong)]">{filteredRecords.length}</span> {filteredRecords.length === 1 ? "record" : "records"}
          </span>

          <Button
            variant="secondary"
            size="sm"
            icon="refresh"
            onClick={handleRefresh}
            disabled={refreshing}
            className={refreshing ? "[&_svg]:animate-spin" : ""}
          >
            {refreshing ? "Refreshing…" : "Refresh"}
          </Button>
        </div>
      </div>

      {/* =====================================================================
          4. DESKTOP TABLE VIEW (md:block inside Card)
          ===================================================================== */}
      <Card padded={false} className="hidden md:block overflow-hidden shadow-xs">
        <TableWrap className="border-0 rounded-none">
          <Table>
            <THead>
              <TR>
                <TH>Date</TH>
                <TH>Reason / Task</TH>
                <TH>Hours</TH>
                <TH>Absent Days</TH>
                <TH className="text-right">Action</TH>
              </TR>
            </THead>
            <TBody>
              {filteredRecords.length === 0 ? (
                <EmptyRow colSpan={5} message="No attendance logs found." />
              ) : (
                filteredRecords.map((record) => (
                  <TR key={record.date} interactive>
                    {/* Column 1: Date */}
                    <TD>
                      <Badge tone="blue">
                        {formatDay(record.date, "medium")}
                      </Badge>
                    </TD>

                    {/* Column 2: Reason / Task */}
                    <TD>
                      <span className="block text-[13px] font-semibold leading-snug line-clamp-2" style={{ color: "var(--text-strong)" }}>
                        {record.reason || "Missed OTP Attendance Log"}
                      </span>
                    </TD>

                    {/* Column 3: Hours Only */}
                    <TD>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {record.hours.length === 0 ? (
                          <span className="text-[12px] text-[var(--text-faint)]">—</span>
                        ) : (
                          record.hours
                            .slice()
                            .sort((a, b) => a - b)
                            .map((hour) => (
                              <span
                                key={hour}
                                data-accent="blue"
                                title={`Hour ${hour} (${HOUR_WINDOW[hour] || ""})`}
                                className="grid h-6 w-6 place-items-center rounded-[6px] text-[10.5px] font-bold select-none"
                                style={{
                                  background: "var(--tone-soft)",
                                  color: "var(--tone)",
                                  boxShadow: "inset 0 0 0 1px color-mix(in srgb, var(--tone) 25%, transparent)",
                                }}
                              >
                                {hour}
                              </span>
                            ))
                        )}
                      </div>
                    </TD>

                    {/* Column 4: Absent Day Calculation */}
                    <TD>
                      {record.absentDays !== undefined && record.absentDays > 0 ? (
                        <span
                          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold"
                          style={{
                            background:
                              record.absentDays === 1
                                ? "var(--color-brand-red-050)"
                                : "var(--color-brand-amber-050)",
                            color:
                              record.absentDays === 1
                                ? "var(--color-brand-red)"
                                : "var(--color-brand-amber)",
                            boxShadow: `inset 0 0 0 1px ${
                              record.absentDays === 1
                                ? "color-mix(in srgb, var(--color-brand-red) 30%, transparent)"
                                : "color-mix(in srgb, var(--color-brand-amber) 30%, transparent)"
                            }`,
                          }}
                        >
                          <span
                            className="h-1.5 w-1.5 rounded-full"
                            style={{
                              background:
                                record.absentDays === 1
                                ? "var(--color-brand-red)"
                                : "var(--color-brand-amber)",
                            }}
                          />
                          {record.absentDays === 1 ? "1.0 Day Absent" : "0.5 Day Absent"}
                        </span>
                      ) : (
                        <span className="text-[12px] text-[var(--text-faint)]">0.0 Days</span>
                      )}
                    </TD>

                    {/* Column 5: Action */}
                    <TD className="text-right">
                      <Button
                        size="sm"
                        variant="secondary"
                        icon="edit"
                        onClick={() => setEditingRecord(record)}
                      >
                        Edit
                      </Button>
                    </TD>
                  </TR>
                ))
              )}
            </TBody>
          </Table>
        </TableWrap>
      </Card>

      {/* =====================================================================
          5. MOBILE CARD VIEW (md:hidden - Cards sit directly without background card)
          ===================================================================== */}
      <div className="md:hidden space-y-3">
        <div className="flex items-center justify-between px-1 pt-1">
          <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--text-muted)] font-heading">
            History ({filteredRecords.length})
          </span>
        </div>

        {filteredRecords.length === 0 ? (
          <div className="surface py-10 px-4 text-center text-[13px] text-[var(--text-muted)] rounded-[14px]">
            No attendance logs found.
          </div>
        ) : (
          filteredRecords.map((record) => {
            const isOneDay = record.absentDays === 1;

            return (
              <div
                key={record.date}
                className="surface overflow-hidden rounded-[14px] border border-[var(--line-default)] bg-[var(--surface-raised)] shadow-xs"
              >
                {/* Card Main Body */}
                <div className="p-4 space-y-3">
                  {/* Top Row: Date & Badges */}
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-heading text-[16px] font-bold leading-tight text-[var(--text-strong)]">
                        {formatDay(record.date, "medium")}
                      </h3>
                      <p className="mt-1 text-[13px] font-medium leading-snug text-[var(--text-muted)] line-clamp-2">
                        {record.reason || "Missed OTP Attendance Log"}
                      </p>
                    </div>

                    {/* Right Badges: Total Hours & Absent Days */}
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      {/* Blue Hours Pill */}
                      <span
                        className="inline-flex items-center gap-1 rounded-[8px] bg-[var(--color-brand-blue)] px-2.5 py-1 text-[11.5px] font-bold text-white shadow-2xs"
                      >
                        <Icon name="sparkle" className="h-3 w-3" />
                        {record.hours.length} {record.hours.length === 1 ? "Hr" : "Hrs"}
                      </span>

                      {/* Absent Days calculation pill */}
                      {record.absentDays !== undefined && record.absentDays > 0 ? (
                        <span
                          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-bold"
                          style={{
                            background: isOneDay ? "var(--color-brand-red-050)" : "var(--color-brand-amber-050)",
                            color: isOneDay ? "var(--color-brand-red)" : "var(--color-brand-amber)",
                          }}
                        >
                          <span
                            className="h-1.5 w-1.5 rounded-full"
                            style={{ background: isOneDay ? "var(--color-brand-red)" : "var(--color-brand-amber)" }}
                          />
                          {isOneDay ? "1.0d Leave" : "0.5d Leave"}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  {/* Hours Circles Row */}
                  <div className="flex items-center gap-1.5 pt-0.5">
                    {record.hours.length === 0 ? (
                      <span className="text-[12px] text-[var(--text-faint)]">—</span>
                    ) : (
                      record.hours
                        .slice()
                        .sort((a, b) => a - b)
                        .map((hour) => (
                          <span
                            key={hour}
                            data-accent="blue"
                            title={`Hour ${hour} (${HOUR_WINDOW[hour] || ""})`}
                            className="grid h-7 w-7 place-items-center rounded-full text-[11.5px] font-bold select-none"
                            style={{
                              background: "var(--color-brand-blue-050)",
                              color: "var(--color-brand-blue)",
                              boxShadow: "inset 0 0 0 1px color-mix(in srgb, var(--color-brand-blue) 30%, transparent)",
                            }}
                          >
                            {hour}
                          </span>
                        ))
                    )}
                  </div>
                </div>

                {/* Bottom Footer Strip */}
                <div
                  className="flex items-center justify-between border-t px-4 py-2.5 text-[11.5px] font-semibold"
                  style={{
                    background: "var(--surface-sunken)",
                    borderColor: "var(--line-soft)",
                  }}
                >
                  <div
                    className="flex items-center gap-1.5"
                    style={{ color: "var(--color-brand-green)" }}
                  >
                    <Icon name="check-circle" className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">Verified log</span>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    icon="edit"
                    onClick={() => setEditingRecord(record)}
                  >
                    Edit Hours
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* =====================================================================
          4. Modal: Add Attendance Hour (CheckInPanel with same-day date,
             single/double-tap, and 1-submission lock)
          ===================================================================== */}
      <Modal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        title="Log Missed OTP Attendance"
        description="Select hours attended for today. Each hour is stored as a separate database record."
        size="lg"
      >
        <div className="pt-2">
          <CheckInPanel
            date={today}
            loggedHours={todayHours}
            loggedReason={todayReason}
            closed={closed}
          />
        </div>
      </Modal>

      <BulkImportAttendanceModal
        open={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        onSuccess={() => router.refresh()}
      />

      {editingRecord && userId && (
        <EditAttendanceDialog
          record={editingRecord}
          userId={userId}
          onClose={() => setEditingRecord(null)}
          onSaved={() => {
            setEditingRecord(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Edit Attendance Dialog for Users
// ---------------------------------------------------------------------------

function EditAttendanceDialog({
  record,
  userId,
  onClose,
  onSaved,
}: {
  record: AttendanceHistoryRecord;
  userId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [hours, setHours] = useState<Set<number>>(() => new Set(record.hours));
  const [reason, setReason] = useState(record.reason || "");
  const [saving, setSaving] = useState(false);

  const toggle = (hour: number) => {
    setHours((current) => {
      const next = new Set(current);
      if (next.has(hour)) next.delete(hour);
      else next.add(hour);
      return next;
    });
  };

  const selectAll = () => setHours(new Set(ATTENDANCE_HOURS));
  const clearAll = () => setHours(new Set());

  // Dynamic absent days calculation
  const hasFirstHalf = [1, 2, 3, 4].some((h) => hours.has(h));
  const hasSecondHalf = [5, 6, 7].some((h) => hours.has(h));
  let calculatedAbsentDays = 0;
  if (hasFirstHalf) calculatedAbsentDays += 0.5;
  if (hasSecondHalf) calculatedAbsentDays += 0.5;

  const handleSave = async () => {
    if (hours.size === 0) {
      toast.warning("Select at least one hour", "Please select at least one hour to log.");
      return;
    }
    if (!reason.trim()) {
      toast.warning("Reason required", "Please provide a reason or describe what you worked on.");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/attendance", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          date: record.date,
          hours: Array.from(hours).sort((a, b) => a - b),
          reason: reason.trim(),
        }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Failed to update attendance.");
      }
      toast.success(
        "Attendance updated!",
        `Your logged hours for ${formatDay(record.date, "medium")} have been updated successfully.`
      );
      onSaved();
    } catch (err: any) {
      toast.error("Update failed", err.message || "Failed to save attendance changes.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`Edit Missed OTP Attendance — ${formatDay(record.date, "medium")}`}
      description="Adjust your logged hours or update your task description. Changes will immediately recalculate your absent days."
      size="md"
      footer={
        <div className="flex items-center justify-between w-full">
          <span className="text-[12px] font-semibold text-[var(--text-muted)]">
            {hours.size} {hours.size === 1 ? "hour" : "hours"} selected
          </span>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} loading={saving} disabled={hours.size === 0}>
              Save Changes
            </Button>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        {/* Date and dynamic status preview */}
        <div className="flex items-center justify-between gap-3 p-3 rounded-[10px] bg-[var(--surface-sunken)] border border-[var(--line-soft)]">
          <div>
            <span className="block text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
              Date
            </span>
            <span className="text-[14px] font-bold text-[var(--text-strong)] font-heading">
              {formatDay(record.date, "long")}
            </span>
          </div>

          <div className="text-right">
            <span className="block text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
              Calculated Absent Days
            </span>
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11.5px] font-bold",
                calculatedAbsentDays === 1
                  ? "bg-[var(--color-brand-red-050)] text-[var(--color-brand-red)]"
                  : calculatedAbsentDays === 0.5
                  ? "bg-[var(--color-brand-amber-050)] text-[var(--color-brand-amber)]"
                  : "bg-[var(--surface-inset)] text-[var(--text-muted)]"
              )}
            >
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  calculatedAbsentDays === 1
                    ? "bg-[var(--color-brand-red)]"
                    : calculatedAbsentDays === 0.5
                    ? "bg-[var(--color-brand-amber)]"
                    : "bg-[var(--text-muted)]"
                )}
              />
              {calculatedAbsentDays === 1 ? "1.0 Day Absent" : calculatedAbsentDays === 0.5 ? "0.5 Day Absent" : "0.0 Days"}
            </span>
          </div>
        </div>

        {/* Hour Selector */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-[12px] font-bold uppercase tracking-wider text-[var(--text-muted)] font-heading">
              Select Logged Hours (1–7)
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={selectAll}
                className="text-[11.5px] font-semibold text-[var(--color-brand-blue)] hover:underline cursor-pointer"
              >
                Select All (7)
              </button>
              <span className="text-[var(--text-faint)]">·</span>
              <button
                type="button"
                onClick={clearAll}
                className="text-[11.5px] font-semibold text-[var(--text-muted)] hover:text-red-500 cursor-pointer"
              >
                Clear
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
            {ATTENDANCE_HOURS.map((hour) => {
              const selected = hours.has(hour);
              return (
                <button
                  key={hour}
                  type="button"
                  onClick={() => toggle(hour)}
                  title={`Hour ${hour} (${HOUR_WINDOW[hour] || ""})`}
                  className={cn(
                    "flex flex-col items-center justify-center rounded-[10px] py-2.5 transition-all cursor-pointer border select-none",
                    selected
                      ? "border-[var(--color-brand-blue)] bg-[var(--color-brand-blue)] text-white shadow-xs"
                      : "border-[var(--line-default)] bg-[var(--surface-raised)] text-[var(--text-strong)] hover:border-[var(--line-strong)]"
                  )}
                >
                  <span className="text-[14px] font-bold leading-none">{hour}</span>
                  <span
                    className={cn(
                      "mt-1 text-[9.5px] font-medium leading-none",
                      selected ? "text-blue-100" : "text-[var(--text-faint)]"
                    )}
                  >
                    {hour <= 4 ? "H1" : "H2"}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="mt-1.5 text-[11px] text-[var(--text-faint)]">
            H1: Hours 1–4 (First Half, 0.5d) · H2: Hours 5–7 (Second Half, 0.5d)
          </p>
        </div>

        {/* Reason / Task */}
        <div>
          {/* Quick Reason Suggestions */}
          <div className="mb-2 flex flex-wrap items-center gap-1.5">
            <span className="text-[11.5px] font-medium text-[var(--text-faint)]">
              Suggestions:
            </span>
            <button
              type="button"
              onClick={() => setReason("Activity mapped with another venue")}
              className={cn(
                "rounded-full px-2.5 py-1 text-[11px] font-medium border transition-colors cursor-pointer",
                reason === "Activity mapped with another venue"
                  ? "bg-[var(--color-brand-blue-050)] border-[var(--color-brand-blue)] text-[var(--color-brand-blue)] font-semibold"
                  : "bg-[var(--surface-sunken)] border-[var(--line-default)] text-[var(--text-muted)] hover:border-[var(--line-strong)]"
              )}
            >
              Activity mapped with another venue
            </button>
            <button
              type="button"
              onClick={() => setReason("OTP not received")}
              className={cn(
                "rounded-full px-2.5 py-1 text-[11px] font-medium border transition-colors cursor-pointer",
                reason === "OTP not received"
                  ? "bg-[var(--color-brand-blue-050)] border-[var(--color-brand-blue)] text-[var(--color-brand-blue)] font-semibold"
                  : "bg-[var(--surface-sunken)] border-[var(--line-default)] text-[var(--text-muted)] hover:border-[var(--line-strong)]"
              )}
            >
              OTP not received
            </button>
          </div>

          <Field
            label="Reason"
            hint={`${reason.length}/65`}
            htmlFor="edit-attendance-reason"
            required
            help="Enter reason (4 to 65 characters)."
          >
            <Textarea
              id="edit-attendance-reason"
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value.slice(0, 65))}
              placeholder="e.g. Activity mapped with another venue / OTP not received"
              maxLength={65}
              required
            />
          </Field>
        </div>
      </div>
    </Modal>
  );
}
