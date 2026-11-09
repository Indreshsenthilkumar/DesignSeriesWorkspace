"use client";

import { useMemo, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { WORKLOG_SLOTS } from "@/lib/constants";
import { formatDay, rangeOfDays, endOfMonth, toDayKey, fromDayKey, monthLabel } from "@/lib/dates";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/Badge";

export type GridRow = {
  studentId: string;
  name: string;
  rollNo: string;
  role: string;
  domain: string;
  year: string;
  department?: string;
  /** date -> log info */
  logs: Record<
    string,
    {
      id: string;
      status: string;
      s1: string;
      s2: string;
      s3: string;
      s4: string;
      s5: string;
      mentorRemark: string;
    }
  >;
};

export function WorklogMonthlyGrid({
  rows,
  month, // "YYYY-MM"
  onMonthChange,
  options,
}: {
  rows: GridRow[];
  month: string;
  onMonthChange: (m: string) => void;
  options?: { domains: string[]; years: string[] };
}) {
  const [popover, setPopover] = useState<{
    studentName: string;
    date: string;
    log: GridRow["logs"][string];
  } | null>(null);

  // ── Filters state ────────────────────────────────────────────────────────
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [domainFilter, setDomainFilter] = useState("ALL");
  const [yearFilter, setYearFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const days = useMemo(() => {
    const first = `${month}-01`;
    const last = endOfMonth(first);
    return rangeOfDays(first, last);
  }, [month]);

  // Navigate months
  const prevMonth = () => {
    const [y, m] = month.split("-").map(Number);
    const d = new Date(y, (m ?? 1) - 2, 1);
    onMonthChange(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  };
  const nextMonth = () => {
    const [y, m] = month.split("-").map(Number);
    const d = new Date(y, m ?? 1, 1);
    onMonthChange(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  };

  const today = toDayKey();
  const isCurrentMonth = month === today.slice(0, 7);

  const label = (() => {
    const first = `${month}-01`;
    return monthLabel(first);
  })();

  // ── Filtered students ───────────────────────────────────────────────────
  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      // Role filter
      if (roleFilter === "STUDENT" && r.role !== "STUDENT") return false;
      if (
        roleFilter === "STUDENT_ADMIN" &&
        r.role !== "STUDENT_ADMIN" &&
        r.role !== "ADMIN"
      ) {
        return false;
      }

      // Domain filter
      if (domainFilter !== "ALL" && r.domain !== domainFilter) return false;

      // Year filter
      if (yearFilter !== "ALL" && r.year !== yearFilter) return false;

      // Submission status filter
      const logCount = Object.keys(r.logs).length;
      if (statusFilter === "WITH_LOGS" && logCount === 0) return false;
      if (statusFilter === "NO_LOGS" && logCount > 0) return false;

      // Search query
      if (query.trim()) {
        const q = query.trim().toLowerCase();
        const haystack = `${r.name} ${r.rollNo} ${r.domain} ${r.year} ${r.role}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }

      return true;
    });
  }, [rows, query, roleFilter, domainFilter, yearFilter, statusFilter]);

  // ── Export CSV handler ──────────────────────────────────────────────────
  const exportGridCSV = () => {
    const headers = [
      "S.No",
      "Student Name",
      "Roll No",
      "Role",
      "Domain",
      "Year",
      ...days.map((d) => d.slice(8)),
    ];
    const csvLines = [headers.join(",")];

    filteredRows.forEach((r, idx) => {
      const isStudentAdmin = r.role === "STUDENT_ADMIN" || r.role === "ADMIN";
      const roleStr = isStudentAdmin ? "Student + Admin" : "Student";
      const dayValues = days.map((day) => {
        const log = r.logs[day];
        if (!log) {
          const isSun = fromDayKey(day).getDay() === 0;
          return isSun ? "Sunday" : "-";
        }
        return log.status;
      });

      const line = [
        idx + 1,
        `"${r.name.replace(/"/g, '""')}"`,
        `"${r.rollNo}"`,
        `"${roleStr}"`,
        `"${(r.domain || "").replace(/"/g, '""')}"`,
        `"${(r.year || "").replace(/"/g, '""')}"`,
        ...dayValues,
      ];
      csvLines.push(line.join(","));
    });

    const blob = new Blob([csvLines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Worklog-Overview-${month}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div id="admin-analytics-monthly-grid-container" className="flex flex-col gap-3">
      {/* Top Header Card */}
      <div
        className="flex flex-wrap items-center justify-between gap-3 rounded-[12px] border p-3 sm:p-4"
        style={{ background: "var(--surface-raised)", borderColor: "var(--line-soft)" }}
      >
        <div className="flex items-center gap-2.5">
          <button
            onClick={prevMonth}
            className="grid h-8 w-8 place-items-center rounded-[8px] border transition-colors hover:bg-[var(--surface-hover)]"
            style={{ borderColor: "var(--line-soft)" }}
            aria-label="Previous month"
            title="Previous month"
          >
            <Icon name="chevron-down" className="h-4 w-4 rotate-90" style={{ color: "var(--text-muted)" }} />
          </button>
          <h2
            id="monthly-overview-title"
            className="text-[16px] font-bold tracking-tight"
            style={{ color: "var(--text-strong)" }}
          >
            {label} — Worklog Overview
          </h2>
          <button
            onClick={nextMonth}
            disabled={isCurrentMonth}
            className="grid h-8 w-8 place-items-center rounded-[8px] border transition-colors hover:bg-[var(--surface-hover)] disabled:opacity-30"
            style={{ borderColor: "var(--line-soft)" }}
            aria-label="Next month"
            title="Next month"
          >
            <Icon name="chevron-down" className="h-4 w-4 -rotate-90" style={{ color: "var(--text-muted)" }} />
          </button>
        </div>

        <Button
          size="sm"
          variant="secondary"
          icon="download"
          onClick={exportGridCSV}
        >
          Export Monthly Grid
        </Button>
      </div>

      {/* Search & Filter Toolbar */}
      <div
        className="grid gap-2.5 rounded-[12px] border p-3 sm:grid-cols-2 lg:grid-cols-5"
        style={{ background: "var(--surface-raised)", borderColor: "var(--line-soft)" }}
      >
        {/* Text Search */}
        <div className="relative">
          <span
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: "var(--text-faint)" }}
          >
            <Icon name="search" className="h-3.5 w-3.5" />
          </span>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search student or roll no…"
            className="h-9 w-full rounded-[8px] border pl-8 pr-3 text-[12.5px] transition-colors focus:outline-none focus:ring-2"
            style={{
              borderColor: "var(--line-default)",
              background: "var(--surface-sunken)",
              color: "var(--text-default)",
            }}
            aria-label="Search students"
          />
        </div>

        {/* Role Filter */}
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="h-9 w-full rounded-[8px] border px-3 text-[12.5px] focus:outline-none focus:ring-2"
          style={{
            borderColor: "var(--line-default)",
            background: "var(--surface-sunken)",
            color: "var(--text-default)",
          }}
          aria-label="Filter by role"
        >
          <option value="ALL">All Roles</option>
          <option value="STUDENT">Students Only</option>
          <option value="STUDENT_ADMIN">Student + Admin Only</option>
        </select>

        {/* Domain Filter */}
        <select
          value={domainFilter}
          onChange={(e) => setDomainFilter(e.target.value)}
          className="h-9 w-full rounded-[8px] border px-3 text-[12.5px] focus:outline-none focus:ring-2"
          style={{
            borderColor: "var(--line-default)",
            background: "var(--surface-sunken)",
            color: "var(--text-default)",
          }}
          aria-label="Filter by domain"
        >
          <option value="ALL">All Domains</option>
          {(options?.domains || []).map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>

        {/* Year Filter */}
        <select
          value={yearFilter}
          onChange={(e) => setYearFilter(e.target.value)}
          className="h-9 w-full rounded-[8px] border px-3 text-[12.5px] focus:outline-none focus:ring-2"
          style={{
            borderColor: "var(--line-default)",
            background: "var(--surface-sunken)",
            color: "var(--text-default)",
          }}
          aria-label="Filter by year"
        >
          <option value="ALL">All Years</option>
          {(options?.years || []).map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>

        {/* Submissions filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-9 w-full rounded-[8px] border px-3 text-[12.5px] focus:outline-none focus:ring-2"
          style={{
            borderColor: "var(--line-default)",
            background: "var(--surface-sunken)",
            color: "var(--text-default)",
          }}
          aria-label="Filter by submissions"
        >
          <option value="ALL">All Submissions</option>
          <option value="WITH_LOGS">Has Logs this Month</option>
          <option value="NO_LOGS">No Logs this Month</option>
        </select>
      </div>

      {/* Legend & Count Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-1 py-0.5 text-[12px]">
        <div className="flex flex-wrap items-center gap-4">
          {/* Submitted (Awaiting Review) - Vibrant Blue */}
          <span className="flex items-center gap-1.5 font-medium" style={{ color: "var(--text-muted)" }}>
            <span
              className="flex h-5 w-5 items-center justify-center rounded-[5px]"
              style={{ background: "#e0f2fe", border: "1.5px solid #7dd3fc", color: "#0284c7" }}
            >
              <CheckIcon className="h-3 w-3" strokeWidth={3} />
            </span>
            <span>Submitted (Awaiting review)</span>
          </span>

          {/* Reviewed - Vibrant Green */}
          <span className="flex items-center gap-1.5 font-medium" style={{ color: "var(--text-muted)" }}>
            <span
              className="flex h-5 w-5 items-center justify-center rounded-[5px]"
              style={{ background: "#dcfce7", border: "1.5px solid #86efac", color: "#15803d" }}
            >
              <CheckIcon className="h-3 w-3" strokeWidth={3} />
            </span>
            <span>Reviewed (Signed off)</span>
          </span>

          {/* Flagged - Vibrant Red */}
          <span className="flex items-center gap-1.5 font-medium" style={{ color: "var(--text-muted)" }}>
            <span
              className="flex h-5 w-5 items-center justify-center rounded-[5px]"
              style={{ background: "#fee2e2", border: "1.5px solid #fca5a5", color: "#b91c1c" }}
            >
              <FlagIcon className="h-2.5 w-2.5" />
            </span>
            <span>Flagged</span>
          </span>

          {/* Missing - Clean Outline Box */}
          <span className="flex items-center gap-1.5 font-medium" style={{ color: "var(--text-muted)" }}>
            <span
              className="inline-block h-5 w-5 rounded-[5px]"
              style={{ border: "1.5px solid #cbd5e1", background: "#ffffff" }}
            />
            <span>No worklog</span>
          </span>
        </div>

        <span className="text-[11.5px] font-medium" style={{ color: "var(--text-faint)" }}>
          Showing <strong style={{ color: "var(--text-strong)" }}>{filteredRows.length}</strong> of {rows.length} students
        </span>
      </div>

      {/* Scrollable matrix */}
      <div
        className="overflow-x-auto rounded-[12px] border"
        style={{ borderColor: "var(--line-soft)", background: "var(--surface-raised)" }}
      >
        <table className="border-collapse text-[11.5px]" style={{ minWidth: `${280 + days.length * 36}px` }}>
          <thead>
            <tr>
              {/* Sticky S.No Column */}
              <th
                className="sticky z-20 border-b border-r px-2 py-2 text-center text-[10px] font-bold uppercase tracking-[0.08em]"
                style={{
                  left: 0,
                  width: 44,
                  minWidth: 44,
                  maxWidth: 44,
                  borderColor: "var(--line-soft)",
                  background: "var(--surface-raised)",
                  color: "var(--text-faint)",
                }}
              >
                S.No
              </th>

              {/* Sticky Name Column */}
              <th
                className="sticky z-20 border-b border-r px-3 py-2 text-left text-[10px] font-bold uppercase tracking-[0.08em]"
                style={{
                  left: 44,
                  width: 236,
                  minWidth: 236,
                  maxWidth: 236,
                  borderColor: "var(--line-soft)",
                  background: "var(--surface-raised)",
                  color: "var(--text-faint)",
                  boxShadow: "2px 0 4px -2px rgba(0,0,0,0.08)",
                }}
              >
                Name
              </th>

              {/* Day Headers */}
              {days.map((day) => {
                const d = fromDayKey(day);
                const isSun = d.getDay() === 0;
                const isTod = day === today;
                return (
                  <th
                    key={day}
                    className="border-b border-r px-1 py-2 text-center font-bold"
                    style={{
                      width: 36,
                      minWidth: 36,
                      maxWidth: 36,
                      borderColor: "var(--line-soft)",
                      background: isTod
                        ? "#eff6ff"
                        : isSun
                        ? "var(--surface-sunken)"
                        : "var(--surface-raised)",
                      color: isSun ? "var(--text-faint)" : isTod ? "#2563eb" : "var(--text-muted)",
                    }}
                  >
                    <div className="flex flex-col items-center gap-0.5">
                      <span className="text-[9px] font-normal uppercase" style={{ opacity: 0.7 }}>
                        {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"][d.getDay()]}
                      </span>
                      <span className="tabular-nums text-[11px]">{d.getDate()}</span>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 ? (
              <tr>
                <td
                  colSpan={days.length + 2}
                  className="px-6 py-12 text-center text-[13px]"
                  style={{ color: "var(--text-faint)" }}
                >
                  No students match the current filters.
                </td>
              </tr>
            ) : (
              filteredRows.map((row, idx) => {
                const isStudentAdmin = row.role === "STUDENT_ADMIN" || row.role === "ADMIN";
                const rowBg = idx % 2 === 0 ? "var(--surface-raised)" : "var(--surface-sunken)";

                return (
                  <tr
                    key={row.studentId}
                    className="group transition-colors hover:bg-[var(--surface-hover)]"
                    style={{ background: rowBg }}
                  >
                    {/* Sticky S.No Cell */}
                    <td
                      className="sticky z-10 border-b border-r px-2 py-2 text-center tabular-nums text-[11px]"
                      style={{
                        left: 0,
                        width: 44,
                        minWidth: 44,
                        maxWidth: 44,
                        borderColor: "var(--line-soft)",
                        background: rowBg,
                        color: "var(--text-faint)",
                      }}
                    >
                      {idx + 1}
                    </td>

                    {/* Sticky Name Cell with Student + Admin Role Badge */}
                    <td
                      className="sticky z-10 border-b border-r px-3 py-2"
                      style={{
                        left: 44,
                        width: 236,
                        minWidth: 236,
                        maxWidth: 236,
                        borderColor: "var(--line-soft)",
                        background: rowBg,
                        boxShadow: "2px 0 4px -2px rgba(0,0,0,0.08)",
                      }}
                    >
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className="font-semibold text-[12px] leading-snug truncate"
                            style={{ color: "var(--text-strong)" }}
                            title={row.name}
                          >
                            {row.name}
                          </span>
                          {isStudentAdmin ? (
                            <span
                              className="inline-flex shrink-0 items-center rounded px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wider"
                              style={{
                                background: "#dcfce7",
                                color: "#166534",
                                border: "1px solid #86efac",
                              }}
                            >
                              Student + Admin
                            </span>
                          ) : null}
                        </div>
                        <div
                          className="flex items-center gap-1.5 text-[10px]"
                          style={{ color: "var(--text-faint)" }}
                        >
                          <span className="font-mono">{row.rollNo || "—"}</span>
                          {row.domain ? <span className="truncate">· {row.domain}</span> : null}
                        </div>
                      </div>
                    </td>

                    {/* Day Cells */}
                    {days.map((day) => {
                      const log = row.logs[day];
                      const isSun = fromDayKey(day).getDay() === 0;
                      const isFuture = day > today;

                      let cellBg = "#ffffff";
                      let cellBorder = "1.5px solid #cbd5e1";
                      let iconEl = null;

                      if (log) {
                        if (log.status === "REVIEWED") {
                          // Reviewed - Vibrant Green
                          cellBg = "#dcfce7";
                          cellBorder = "1.5px solid #86efac";
                          iconEl = (
                            <span style={{ color: "#15803d" }}>
                              <CheckIcon className="h-4 w-4" strokeWidth={3} />
                            </span>
                          );
                        } else if (log.status === "FLAGGED") {
                          // Flagged - Vibrant Red
                          cellBg = "#fee2e2";
                          cellBorder = "1.5px solid #fca5a5";
                          iconEl = (
                            <span style={{ color: "#b91c1c" }}>
                              <FlagIcon className="h-3.5 w-3.5" />
                            </span>
                          );
                        } else {
                          // Submitted (Awaiting review) - Vibrant Sky Blue
                          cellBg = "#e0f2fe";
                          cellBorder = "1.5px solid #7dd3fc";
                          iconEl = (
                            <span style={{ color: "#0284c7" }}>
                              <CheckIcon className="h-4 w-4" strokeWidth={3} />
                            </span>
                          );
                        }
                      } else if (isFuture) {
                        cellBg = "transparent";
                        cellBorder = "1px dashed #e2e8f0";
                      } else if (isSun) {
                        cellBg = "var(--surface-sunken)";
                        cellBorder = "1px dashed var(--line-soft)";
                      }

                      return (
                        <td
                          key={day}
                          className="border-b border-r p-1 text-center"
                          style={{
                            width: 36,
                            minWidth: 36,
                            maxWidth: 36,
                            borderColor: "var(--line-soft)",
                            background: isSun ? "rgba(0,0,0,0.015)" : undefined,
                          }}
                        >
                          <button
                            type="button"
                            disabled={!log}
                            onClick={() =>
                              log &&
                              setPopover({
                                studentName: row.name,
                                date: day,
                                log,
                              })
                            }
                            className="mx-auto flex h-7 w-7 items-center justify-center rounded-[6px] transition-all hover:scale-105 active:scale-95"
                            style={{
                              background: cellBg,
                              border: cellBorder,
                              cursor: log ? "pointer" : "default",
                              opacity: isFuture ? 0.35 : 1,
                              boxShadow: log ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
                            }}
                            title={
                              log
                                ? `${row.name} — ${formatDay(day, "medium")} (${
                                    log.status === "REVIEWED"
                                      ? "Reviewed"
                                      : log.status === "FLAGGED"
                                      ? "Flagged"
                                      : "Submitted"
                                  })`
                                : isSun
                                ? "Sunday"
                                : isFuture
                                ? "Future Date"
                                : "No worklog submitted"
                            }
                          >
                            {iconEl}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Detail Popover Modal */}
      {popover ? (
        <LogDetailModal
          studentName={popover.studentName}
          date={popover.date}
          log={popover.log}
          onClose={() => setPopover(null)}
        />
      ) : null}
    </div>
  );
}

// ── Icons ──────────────────────────────────────────────────────────────────

function CheckIcon({ className, strokeWidth = 2.5 }: { className?: string; strokeWidth?: number }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function FlagIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
      <line x1="4" y1="22" x2="4" y2="15" stroke="currentColor" strokeWidth="2.5" />
    </svg>
  );
}

// ── Modal ──────────────────────────────────────────────────────────────────

function LogDetailModal({
  studentName,
  date,
  log,
  onClose,
}: {
  studentName: string;
  date: string;
  log: GridRow["logs"][string];
  onClose: () => void;
}) {
  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={`${studentName} — ${formatDay(date, "long")}`}
      description="Worklog detail"
      footer={
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <StatusBadge status={log.status} />
        </div>
        <dl className="flex flex-col gap-2.5">
          {WORKLOG_SLOTS.map((slot) => {
            const value = log[slot.key as keyof typeof log] as string;
            if (!value) return null;
            return (
              <div key={slot.key} className="inset-panel p-3">
                <dt className="flex items-baseline justify-between">
                  <span
                    className="text-[10.5px] font-bold uppercase tracking-[0.08em]"
                    style={{ color: "var(--text-faint)" }}
                  >
                    {slot.label}
                  </span>
                  <span className="font-mono text-[10.5px]" style={{ color: "var(--text-faint)" }}>
                    {slot.window}
                  </span>
                </dt>
                <dd
                  className="mt-1.5 text-[12.5px] leading-relaxed"
                  style={{ color: "var(--text-default)" }}
                >
                  {value}
                </dd>
              </div>
            );
          })}
        </dl>

        {log.mentorRemark ? (
          <div
            data-accent={log.status === "FLAGGED" ? "red" : "green"}
            className="flex items-start gap-2.5 rounded-[10px] p-3"
            style={{ background: "var(--tone-soft)" }}
          >
            <Icon name="user" className="mt-px h-4 w-4 shrink-0" style={{ color: "var(--tone)" }} />
            <div>
              <p
                className="text-[11px] font-bold uppercase tracking-[0.07em]"
                style={{ color: "var(--tone)" }}
              >
                Mentor remark
              </p>
              <p className="mt-1 text-[12.5px] leading-relaxed" style={{ color: "var(--tone)" }}>
                {log.mentorRemark}
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
