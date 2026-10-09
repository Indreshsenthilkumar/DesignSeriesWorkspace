"use client";

import { useMemo, useState } from "react";
import { formatDay } from "@/lib/dates";
import { ATTENDANCE_HOURS, HOUR_WINDOW } from "@/lib/constants";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { StatTile } from "@/components/ui/StatTile";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/shell/PageHeader";
import { Table, TableWrap, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { EmptyRow } from "@/components/ui/EmptyState";
import { CheckInPanel } from "@/components/features/CheckInPanel";
import { ExportAttendanceModal } from "@/components/features/ExportAttendanceModal";

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
}

export function AttendanceHistoryView({
  stats,
  records,
  today,
  todayHours,
  todayReason,
  closed,
}: AttendanceHistoryViewProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFilter, setDateFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [reasonFilter, setReasonFilter] = useState("all");

  const [addModalOpen, setAddModalOpen] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);

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

      // 3. Status filter
      if (statusFilter !== "all") {
        const normStatus = (r.status || "LOGGED").toUpperCase();
        if (normStatus !== statusFilter.toUpperCase()) return false;
      }

      // 4. Reason filter
      if (reasonFilter !== "all") {
        if (r.reason.trim() !== reasonFilter) return false;
      }

      return true;
    });
  }, [records, searchQuery, dateFilter, statusFilter, reasonFilter]);

  const hasActiveFilters =
    searchQuery.trim() !== "" ||
    dateFilter !== "all" ||
    statusFilter !== "all" ||
    reasonFilter !== "all";

  const clearAllFilters = () => {
    setSearchQuery("");
    setDateFilter("all");
    setStatusFilter("all");
    setReasonFilter("all");
  };

  // Dynamically calculate absent days based on active filter or default to current month
  const displayedAbsentDays = useMemo(() => {
    if (dateFilter === "all" || dateFilter === "this-month") {
      // Month-scoped absent days (matches the "This Month" caption)
      const thisMonthPrefix = today.slice(0, 7);
      return records
        .filter((r) => r.date.startsWith(thisMonthPrefix))
        .reduce((sum, r) => sum + (r.absentDays ?? 0), 0);
    }
    return filteredRecords.reduce((sum, r) => sum + (r.absentDays ?? 0), 0);
  }, [records, filteredRecords, dateFilter, today]);

  const absentDaysCaption =
    dateFilter === "last-30"
      ? "Last 30 Days"
      : dateFilter === "last-90"
      ? "Last 90 Days"
      : "This Month";

  return (
    <div className="space-y-5">
      {/* =====================================================================
          1. Page Header (Consistent Portal Header)
          ===================================================================== */}
      <PageHeader
        title="Missed OTP Attendance history"
        description="Track and manage attendance logs."
        actions={
          <Button
            onClick={() => setAddModalOpen(true)}
            icon="plus"
          >
            Add attendance hour
          </Button>
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
          3. Filter & Action Toolbar + Table inside website theme Card
          ===================================================================== */}
      <Card padded={false} className="overflow-hidden">
        {/* Filter Toolbar */}
        <div className="flex flex-col gap-3 p-3.5 sm:p-4 border-b border-[var(--line-soft)] sm:flex-row sm:items-center sm:justify-between bg-[var(--surface-raised)]">
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Search Input */}
            <div className="relative min-w-[200px] sm:min-w-[230px]">
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

            {/* Status Filter */}
            <div className="relative">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="appearance-none rounded-[8px] border border-[var(--line-default)] bg-[var(--surface-inset)] py-1.5 pl-3 pr-7 text-[12.5px] font-medium text-[var(--text-default)] transition-colors hover:border-[var(--line-strong)] focus:border-[var(--accent)] focus:outline-none cursor-pointer"
              >
                <option value="all">All Status</option>
                <option value="LOGGED">Logged</option>
                <option value="PRESENT">Present</option>
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

          {/* Right Action: Counter & Export */}
          <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-[var(--line-soft)]">
            <span className="text-[12px] text-[var(--text-muted)]">
              Showing <span className="font-semibold text-[var(--text-strong)]">{filteredRecords.length}</span> {filteredRecords.length === 1 ? "record" : "records"}
            </span>

            <Button
              variant="secondary"
              size="sm"
              icon="download"
              onClick={() => setExportModalOpen(true)}
            >
              Export
            </Button>
          </div>
        </div>

        {/* Table Wrap */}
        <TableWrap className="border-0 rounded-none">
          <Table>
            <THead>
              <TR>
                <TH>Date</TH>
                <TH>Reason / Task</TH>
                <TH>Hours</TH>
                <TH>Status</TH>
              </TR>
            </THead>
            <TBody>
              {filteredRecords.length === 0 ? (
                <EmptyRow colSpan={4} message="No attendance logs found." />
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

                    {/* Column 3: Hours + Leave/Absent count */}
                    <TD>
                      <div className="flex items-center gap-2 flex-wrap">
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
                                  className="grid h-6 w-6 place-items-center rounded-[6px] text-[10.5px] font-bold"
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

                        {/* Half/Full day leave indicator badge */}
                        {record.absentDays !== undefined && record.absentDays > 0 ? (
                          <span
                            className="inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] font-semibold"
                            style={{
                              background:
                                record.absentDays === 1
                                  ? "var(--color-brand-red-050)"
                                  : "var(--color-brand-amber-050)",
                              color:
                                record.absentDays === 1
                                  ? "var(--color-brand-red)"
                                  : "var(--color-brand-amber)",
                            }}
                          >
                            {record.absentDays === 1 ? "1.0 day leave" : "0.5 day leave"}
                          </span>
                        ) : null}
                      </div>
                    </TD>

                    {/* Column 4: Status */}
                    <TD>
                      <Badge tone="green" dot>
                        LOGGED
                      </Badge>
                    </TD>
                  </TR>
                ))
              )}
            </TBody>
          </Table>
        </TableWrap>
      </Card>

      {/* =====================================================================
          4. Modal: Add Attendance Hour (CheckInPanel with same-day date,
             single/double-tap, and 1-submission lock)
          ===================================================================== */}
      <Modal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        title="Log Missed OTP Attendance"
        description="Select hours attended for today. Each hour is stored as a separate database record with locked single submission."
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

      {/* =====================================================================
          5. Modal: Export Missed OTP Attendance (Excel, PDF, CSV with column toggles)
          ===================================================================== */}
      <ExportAttendanceModal
        open={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        defaultFrom={records.length > 0 ? records[records.length - 1].date : today}
        defaultTo={today}
      />
    </div>
  );
}
