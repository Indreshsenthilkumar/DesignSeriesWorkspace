"use client";

import { useMemo, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { WORKLOG_SLOTS } from "@/lib/constants";
import { formatDay, rangeOfDays, startOfMonth, endOfMonth, toDayKey, fromDayKey, monthLabel } from "@/lib/dates";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/Badge";

export type GridRow = {
  studentId: string;
  name: string;
  rollNo: string;
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
}: {
  rows: GridRow[];
  month: string;
  onMonthChange: (m: string) => void;
}) {
  const [popover, setPopover] = useState<{
    studentName: string;
    date: string;
    log: GridRow["logs"][string];
  } | null>(null);

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

  return (
    <div className="flex flex-col gap-3">
      {/* Month nav */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={prevMonth}
            className="grid h-8 w-8 place-items-center rounded-[8px] transition-colors hover:bg-[var(--surface-hover)]"
            aria-label="Previous month"
          >
            <Icon name="chevron-down" className="h-4 w-4 -rotate-90" style={{ color: "var(--text-muted)" }} />
          </button>
          <span className="text-[14px] font-semibold" style={{ color: "var(--text-strong)" }}>
            {label} — Worklog Overview
          </span>
          <button
            onClick={nextMonth}
            disabled={isCurrentMonth}
            className="grid h-8 w-8 place-items-center rounded-[8px] transition-colors hover:bg-[var(--surface-hover)] disabled:opacity-30"
            aria-label="Next month"
          >
            <Icon name="chevron-down" className="h-4 w-4 rotate-90" style={{ color: "var(--text-muted)" }} />
          </button>
        </div>
        <div className="flex items-center gap-3 text-[11.5px]" style={{ color: "var(--text-faint)" }}>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-sm bg-[var(--color-brand-green-100)]" />
            Submitted
          </span>
          <span className="flex items-center gap-1.5">
            <span
              className="inline-block h-3 w-3 rounded-sm"
              style={{ background: "var(--color-brand-green-500)" }}
            />
            Reviewed
          </span>
          <span className="flex items-center gap-1.5">
            <span
              className="inline-block h-3 w-3 rounded-sm"
              style={{ background: "var(--color-brand-red-100)" }}
            />
            Flagged
          </span>
          <span className="flex items-center gap-1.5">
            <span
              className="inline-block h-3 w-3 rounded-sm border"
              style={{ borderColor: "var(--line-soft)", background: "var(--surface-raised)" }}
            />
            Missing
          </span>
        </div>
      </div>

      {/* Scrollable matrix */}
      <div className="overflow-x-auto rounded-[12px] border" style={{ borderColor: "var(--line-soft)" }}>
        <table className="border-collapse text-[11.5px]" style={{ minWidth: `${200 + days.length * 36}px` }}>
          <thead>
            <tr>
              {/* Sticky header columns */}
              <th
                className="sticky left-0 z-20 border-b border-r px-3 py-2 text-left text-[10px] font-bold uppercase tracking-[0.08em]"
                style={{
                  borderColor: "var(--line-soft)",
                  background: "var(--surface-raised)",
                  color: "var(--text-faint)",
                  minWidth: 36,
                }}
              >
                S.No
              </th>
              <th
                className="sticky left-9 z-20 border-b border-r px-3 py-2 text-left text-[10px] font-bold uppercase tracking-[0.08em]"
                style={{
                  borderColor: "var(--line-soft)",
                  background: "var(--surface-raised)",
                  color: "var(--text-faint)",
                  minWidth: 160,
                }}
              >
                Name
              </th>
              {days.map((day) => {
                const d = fromDayKey(day);
                const isSun = d.getDay() === 0;
                const isTod = day === today;
                return (
                  <th
                    key={day}
                    className="border-b border-r px-1 py-2 text-center font-bold"
                    style={{
                      borderColor: "var(--line-soft)",
                      background: isTod
                        ? "var(--color-brand-blue-50)"
                        : isSun
                        ? "var(--surface-sunken)"
                        : "var(--surface-raised)",
                      color: isSun ? "var(--text-faint)" : isTod ? "var(--accent)" : "var(--text-muted)",
                      minWidth: 36,
                    }}
                  >
                    <div className="flex flex-col items-center gap-0.5">
                      <span className="text-[9px] font-normal uppercase" style={{ opacity: 0.7 }}>
                        {["Su","Mo","Tu","We","Th","Fr","Sa"][d.getDay()]}
                      </span>
                      <span className="tabular-nums">{d.getDate()}</span>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={days.length + 2}
                  className="px-6 py-8 text-center"
                  style={{ color: "var(--text-faint)" }}
                >
                  No students found.
                </td>
              </tr>
            ) : (
              rows.map((row, idx) => (
                <tr
                  key={row.studentId}
                  className="group transition-colors"
                  style={{
                    background: idx % 2 === 0 ? "var(--surface-raised)" : "var(--surface-sunken)",
                  }}
                >
                  {/* S.No */}
                  <td
                    className="sticky left-0 z-10 border-b border-r px-3 py-2 text-center tabular-nums"
                    style={{
                      borderColor: "var(--line-soft)",
                      background: idx % 2 === 0 ? "var(--surface-raised)" : "var(--surface-sunken)",
                      color: "var(--text-faint)",
                    }}
                  >
                    {idx + 1}
                  </td>
                  {/* Name */}
                  <td
                    className="sticky left-9 z-10 border-b border-r px-3 py-2"
                    style={{
                      borderColor: "var(--line-soft)",
                      background: idx % 2 === 0 ? "var(--surface-raised)" : "var(--surface-sunken)",
                    }}
                  >
                    <div className="flex flex-col">
                      <span className="font-semibold leading-snug" style={{ color: "var(--text-strong)" }}>
                        {row.name}
                      </span>
                      <span className="text-[10px]" style={{ color: "var(--text-faint)" }}>
                        {row.rollNo}
                      </span>
                    </div>
                  </td>
                  {/* Day cells */}
                  {days.map((day) => {
                    const log = row.logs[day];
                    const isSun = fromDayKey(day).getDay() === 0;
                    const isFuture = day > today;

                    let bg = "transparent";
                    let icon = null;
                    if (log) {
                      if (log.status === "REVIEWED") {
                        bg = "var(--color-brand-green-500)";
                        icon = "✓";
                      } else if (log.status === "FLAGGED") {
                        bg = "var(--color-brand-red-100)";
                        icon = "⚑";
                      } else {
                        // SUBMITTED
                        bg = "var(--color-brand-green-100)";
                        icon = "✓";
                      }
                    }

                    return (
                      <td
                        key={day}
                        className="border-b border-r p-0.5"
                        style={{ borderColor: "var(--line-soft)" }}
                      >
                        <button
                          disabled={!log}
                          onClick={() =>
                            log &&
                            setPopover({
                              studentName: row.name,
                              date: day,
                              log,
                            })
                          }
                          className="flex h-7 w-full items-center justify-center rounded-[6px] text-[11px] font-bold transition-all"
                          style={{
                            background: bg,
                            color:
                              log?.status === "REVIEWED"
                                ? "#fff"
                                : log?.status === "FLAGGED"
                                ? "var(--color-brand-red-700)"
                                : log
                                ? "var(--color-brand-green-700)"
                                : isSun || isFuture
                                ? "transparent"
                                : "var(--text-faint)",
                            cursor: log ? "pointer" : "default",
                            opacity: isFuture ? 0.3 : 1,
                          }}
                          title={log ? `${row.name} — ${formatDay(day, "medium")}` : undefined}
                        >
                          {icon}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Detail popover */}
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

