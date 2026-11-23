"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/Button";
import { Field, Textarea } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { ATTENDANCE_HOURS, HOUR_WINDOW } from "@/lib/constants";
import { formatDay } from "@/lib/dates";
import { cn } from "@/lib/utils";

export interface ActiveLeaveInfo {
  id: string;
  leaveType: string;
  fromDate: string;
  toDate: string;
  status: string;
  reason?: string | null;
  duration?: string | null;
}

interface CheckInPanelProps {
  date: string;
  loggedHours: number[];
  loggedReason?: string | null;
  /** True once the 23:30 cutoff has passed. */
  closed: boolean;
  compact?: boolean;
  activeLeave?: ActiveLeaveInfo | null;
}

/**
 * Missed OTP Attendance Check-In Panel.
 *
 * Rules & Features:
 * 1. Read-only Date (same-day date locked).
 * 2. Single-tap toggles individual hour.
 * 3. Double-tap (<500ms) batch selects/deselects Hours 1 through target hour.
 * 4. Only ONE submission allowed per day (locked permanently after submission, no edits/deletions).
 * 5. Row-per-hour backend persistence.
 */
export function CheckInPanel({
  date,
  loggedHours,
  loggedReason,
  closed,
  compact = false,
  activeLeave = null,
}: CheckInPanelProps) {
  const router = useRouter();
  const toast = useToast();

  const logged = useMemo(() => new Set(loggedHours), [loggedHours]);
  const hasAlreadySubmitted = logged.size > 0;

  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [leaveModalOpen, setLeaveModalOpen] = useState(false);

  // Track double-tap timing for each hour button
  const lastTapRef = useRef<Record<number, number>>({});

  const handleHourClick = (hour: number) => {
    if (hasAlreadySubmitted || closed) return;

    const now = Date.now();
    const lastTap = lastTapRef.current[hour] || 0;
    const isDoubleTap = now - lastTap < 500;

    if (isDoubleTap) {
      lastTapRef.current[hour] = 0; // reset tap
      const isCurrentlyActive = selected.has(hour);

      setSelected((prev) => {
        const next = new Set(prev);
        if (isCurrentlyActive) {
          // Deselect Hours 1..hour
          for (let h = 1; h <= hour; h++) {
            next.delete(h);
          }
        } else {
          // Select Hours 1..hour
          for (let h = 1; h <= hour; h++) {
            next.add(h);
          }
        }
        return next;
      });
    } else {
      lastTapRef.current[hour] = now;
      // Single tap: toggle only this hour
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(hour)) next.delete(hour);
        else next.add(hour);
        return next;
      });
    }
  };

  const selectAll = () => setSelected(new Set(ATTENDANCE_HOURS));
  const clearSelection = () => setSelected(new Set());

  const submit = async () => {
    if (selected.size === 0) {
      toast.warning("Pick at least one hour", "Tap the hours you were present for.");
      return;
    }
    if (reason.trim().length < 4) {
      toast.warning("Reason required", "Please provide a valid reason or task summary (min 4 characters).");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          hours: [...selected].sort((a, b) => a - b),
          reason: reason.trim(),
        }),
      });

      const payload = await response.json();

      if (!payload.ok) {
        toast.error("Submission failed", payload.error || "Could not record attendance.");
        setSaving(false);
        return;
      }

      const count = payload.data?.recorded?.length || selected.size;
      toast.success(
        "Missed OTP Attendance Recorded",
        `${count} ${count === 1 ? "hour" : "hours"} saved successfully.`
      );

      setSelected(new Set());
      setReason("");
      router.refresh();
    } catch {
      toast.error("Network problem", "Your check-in was not saved. Please check your connection and try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      {/* --- Date & Status Header (Read-Only Date) ------------------------- */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2.5 rounded-[10px] border border-[var(--line-subtle)] bg-[var(--surface-sunken)] px-3.5 py-2.5">
        <div className="flex items-center gap-2">
          <Icon name="calendar" className="h-4 w-4 text-[var(--accent)]" />
          <span className="text-[13px] font-semibold text-[var(--text-strong)]">
            {formatDay(date, "long")}
          </span>
          <span className="rounded bg-[var(--surface-raised)] px-1.5 py-0.5 text-[10.5px] font-medium text-[var(--text-faint)] border border-[var(--line-subtle)]">
            Today • Locked
          </span>
        </div>

        <div>
          {activeLeave ? (
            <Badge tone="amber" icon="calendar">
              Active Leave ({activeLeave.leaveType})
            </Badge>
          ) : hasAlreadySubmitted ? (
            <Badge tone="green" icon="check-circle">
              {logged.size === ATTENDANCE_HOURS.length
                ? `Full Day Logged (${logged.size}/7 hrs)`
                : `${logged.size} of 7 Hours Logged`}
            </Badge>
          ) : closed ? (
            <Badge tone="red" icon="clock">
              Check-in Closed (23:30 Cutoff)
            </Badge>
          ) : (
            <Badge tone="blue" icon="clock">
              Open for Check-in
            </Badge>
          )}
        </div>
      </div>

      {/* --- State 0: Active Leave Applied (Hours Hidden & Locked) ----------- */}
      {activeLeave ? (
        <div className="space-y-4">
          <div
            onClick={() => setLeaveModalOpen(true)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") setLeaveModalOpen(true);
            }}
            className="group relative cursor-pointer rounded-[14px] border border-amber-300 dark:border-amber-700/60 bg-gradient-to-br from-amber-50 to-orange-50/50 dark:from-amber-950/30 dark:to-orange-950/20 p-4 transition-all hover:border-amber-400 hover:shadow-md"
          >
            <div className="flex items-start gap-3.5">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-500/20 text-amber-700 dark:text-amber-300">
                <Icon name="calendar" className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="text-[14.5px] font-bold text-amber-950 dark:text-amber-100">
                    Active Leave Applied · {activeLeave.leaveType}
                  </h4>
                  <span className="rounded-full bg-amber-200/90 dark:bg-amber-800/70 px-2.5 py-0.5 text-[10.5px] font-bold uppercase tracking-wider text-amber-900 dark:text-amber-100">
                    {activeLeave.status}
                  </span>
                </div>
                <p className="mt-1 text-[13px] leading-relaxed text-amber-900/80 dark:text-amber-200/90">
                  You have an approved leave covering this date ({formatDay(activeLeave.fromDate.slice(0, 10), "medium")} – {formatDay(activeLeave.toDate.slice(0, 10), "medium")}).
                </p>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 pt-2.5 border-t border-amber-200/60 dark:border-amber-800/40">
                  <span className="text-[12px] font-medium text-amber-800 dark:text-amber-300">
                    Attendance hours cannot be submitted on leave days
                  </span>
                  <div className="flex items-center gap-1 text-[12px] font-bold text-amber-700 dark:text-amber-300 group-hover:underline">
                    <span>View Leave Details</span>
                    <Icon name="chevron-right" className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : hasAlreadySubmitted ? (
        <div className="space-y-4">
          <div className="rounded-[12px] border border-[var(--color-brand-green-200)] bg-[var(--color-brand-green-050)] p-4 dark:border-[var(--color-brand-green-900)] dark:bg-[var(--color-brand-green-950)]">
            <div className="flex items-start gap-3">
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--color-brand-green)] text-white">
                <Icon name="check" className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-[14px] font-bold text-[var(--text-strong)]">
                    Missed OTP Attendance Logged
                  </h4>
                  <span className="text-[11px] font-medium text-[var(--text-faint)]">
                    Logged for today
                  </span>
                </div>
                <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--text-muted)]">
                  Your attendance for today has been submitted and stored as individual hour records.
                </p>
              </div>
            </div>

            {/* Submitted hours display */}
            <div className="mt-3.5 pt-3 border-t border-[var(--color-brand-green-200)] dark:border-[var(--color-brand-green-900)]">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-faint)]">
                Logged Hours for Today
              </span>
              <div className="mt-2 grid grid-cols-7 gap-1 sm:gap-2">
                {ATTENDANCE_HOURS.map((hour) => {
                  const isPresent = logged.has(hour);
                  return (
                    <div
                      key={hour}
                      className={cn(
                        "flex flex-col items-center justify-center py-1.5 px-0.5 sm:py-2 sm:px-1 rounded-[8px] sm:rounded-[10px] border text-center transition-colors",
                        isPresent
                          ? "border-[var(--color-brand-green)] bg-[var(--color-brand-green-100)] dark:bg-[var(--color-brand-green-900)]/40 text-[var(--color-brand-green-800)] dark:text-[var(--color-brand-green-200)]"
                          : "border-[var(--line-subtle)] bg-[var(--surface-raised)]/50 opacity-40 text-[var(--text-faint)]"
                      )}
                    >
                      <span className="text-[13px] sm:text-[15px] font-bold leading-none">Hr {hour}</span>
                      <span className="mt-1 text-[8px] sm:text-[9.5px] font-semibold uppercase">
                        {isPresent ? "Present" : "Absent"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Submitted reason */}
            {loggedReason ? (
              <div className="mt-3 pt-3 border-t border-[var(--color-brand-green-200)] dark:border-[var(--color-brand-green-900)]">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-faint)]">
                  Submitted Reason / Task Log
                </span>
                <p className="mt-1 text-[13px] text-[var(--text-strong)] bg-[var(--surface-raised)]/80 p-2.5 rounded-[8px] border border-[var(--line-subtle)]">
                  {loggedReason}
                </p>
              </div>
            ) : null}
          </div>
        </div>
      ) : closed ? (
        /* --- State 2: Closed for Today ----------------------------------- */
        <div className="rounded-[12px] border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/30">
          <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
            <Icon name="clock" className="h-5 w-5" />
            <h4 className="text-[14px] font-bold">Check-in closed for today</h4>
          </div>
          <p className="mt-1.5 text-[12.5px] text-[var(--text-muted)]">
            Attendance logging closed at 11:30 PM. If you missed logging your hours, please reach out to your mentor or coordinator.
          </p>
        </div>
      ) : (
        /* --- State 3: Interactive Selection & Submission ----------------- */
        <div>
          <div className="mb-2.5 flex items-center justify-between">
            <span className="text-[12px] font-semibold text-[var(--text-muted)]">
              Select Attendance Hours (1 – 7)
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={selectAll}
                className="text-[11.5px] font-semibold text-[var(--accent)] hover:underline"
              >
                Select all (1–7)
              </button>
              {selected.size > 0 ? (
                <>
                  <span className="text-[var(--text-faint)]">•</span>
                  <button
                    type="button"
                    onClick={clearSelection}
                    className="text-[11.5px] font-semibold text-[var(--text-muted)] hover:underline"
                  >
                    Clear
                  </button>
                </>
              ) : null}
            </div>
          </div>

          {/* Hour grid - full width 7-col layout on mobile & desktop */}
          <div className="grid grid-cols-7 gap-1 sm:gap-2">
            {ATTENDANCE_HOURS.map((hour) => {
              const isSelected = selected.has(hour);

              return (
                <button
                  key={hour}
                  type="button"
                  onClick={() => handleHourClick(hour)}
                  aria-pressed={isSelected}
                  title={`Hour ${hour} (${HOUR_WINDOW[hour]}) - Tap to toggle`}
                  className={cn(
                    "group relative flex flex-col items-center justify-center gap-0.5 rounded-[10px] sm:rounded-[12px] border py-2 px-0.5 sm:py-2.5 sm:px-1 select-none",
                    "transition-all duration-150 active:scale-95",
                    isSelected
                      ? "border-[var(--accent)] bg-[var(--accent-soft)] shadow-sm"
                      : "border-[var(--line-default)] bg-[var(--surface-raised)] hover:border-[var(--text-faint)]"
                  )}
                >
                  <span
                    className={cn(
                      "text-[15px] sm:text-[17px] font-bold leading-none tabular-nums",
                      isSelected ? "text-[var(--accent)]" : "text-[var(--text-strong)]"
                    )}
                  >
                    {hour}
                  </span>
                  <span
                    className={cn(
                      "text-[8px] sm:text-[9.5px] font-semibold uppercase tracking-[0.04em] sm:tracking-[0.06em]",
                      isSelected ? "text-[var(--accent)] font-bold" : "text-[var(--text-faint)]"
                    )}
                  >
                    {isSelected ? "Selected" : `Hr ${hour}`}
                  </span>
                  <span
                    className="mt-0.5 hidden text-[9px] tabular-nums sm:block text-[var(--text-faint)]"
                  >
                    {HOUR_WINDOW[hour].split(" – ")[0]}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Reason Input & Submission */}
          <div className="mt-4">
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
              htmlFor="missed-otp-reason"
              required
              help="Enter reason (4 to 65 characters)."
            >
              <Textarea
                id="missed-otp-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value.slice(0, 65))}
                placeholder="e.g. Activity mapped with another venue / OTP not received"
                maxLength={65}
                rows={compact ? 2 : 2}
              />
            </Field>

            <div className="mt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <p className="text-[11.5px] text-[var(--text-faint)]">
                {selected.size > 0
                  ? `Selected ${selected.size} ${selected.size === 1 ? "hour" : "hours"}: ${[...selected]
                      .sort((a, b) => a - b)
                      .join(", ")}`
                  : "Select the hours you attended above."}
              </p>
              <Button
                onClick={submit}
                loading={saving}
                disabled={selected.size === 0 || reason.trim().length < 4}
                icon={saving ? undefined : "check-circle"}
                className="w-full sm:w-auto"
              >
                {saving ? "Submitting…" : "Submit Missed OTP Attendance"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {activeLeave ? (
        <Modal
          open={leaveModalOpen}
          onClose={() => setLeaveModalOpen(false)}
          title="Active Leave Notice"
          description="Attendance check-in is disabled during your active leave period."
          size="md"
          footer={
            <div className="flex justify-end w-full">
              <Button variant="secondary" onClick={() => setLeaveModalOpen(false)}>
                Close
              </Button>
            </div>
          }
        >
          <div className="space-y-4 py-1 text-[13px]">
            <div className="rounded-[10px] border border-amber-200 bg-amber-50 p-3 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
              <div className="flex items-start gap-2.5">
                <Icon name="info" className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                <p className="font-medium text-[12.5px] leading-relaxed">
                  You currently have an active leave covering this date. Attendance hours cannot be logged for active leave days.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 rounded-[12px] border border-[var(--line-subtle)] bg-[var(--surface-sunken)] p-3.5">
              <div>
                <span className="text-[11px] font-medium text-[var(--text-faint)] uppercase tracking-wider">Leave Type</span>
                <p className="mt-0.5 font-bold text-[var(--text-strong)] text-[14px]">{activeLeave.leaveType}</p>
              </div>
              <div>
                <span className="text-[11px] font-medium text-[var(--text-faint)] uppercase tracking-wider">Status</span>
                <p className="mt-0.5 font-bold capitalize text-amber-600 dark:text-amber-400 text-[14px]">
                  {activeLeave.status.toLowerCase()}
                </p>
              </div>
              <div>
                <span className="text-[11px] font-medium text-[var(--text-faint)] uppercase tracking-wider">From Date</span>
                <p className="mt-0.5 font-semibold text-[var(--text-strong)]">{formatDay(activeLeave.fromDate.slice(0, 10), "medium")}</p>
              </div>
              <div>
                <span className="text-[11px] font-medium text-[var(--text-faint)] uppercase tracking-wider">To Date</span>
                <p className="mt-0.5 font-semibold text-[var(--text-strong)]">{formatDay(activeLeave.toDate.slice(0, 10), "medium")}</p>
              </div>
              {activeLeave.duration ? (
                <div className="col-span-2">
                  <span className="text-[11px] font-medium text-[var(--text-faint)] uppercase tracking-wider">Duration</span>
                  <p className="mt-0.5 font-semibold text-[var(--text-strong)]">{activeLeave.duration}</p>
                </div>
              ) : null}
              {activeLeave.reason ? (
                <div className="col-span-2">
                  <span className="text-[11px] font-medium text-[var(--text-faint)] uppercase tracking-wider">Reason</span>
                  <p className="mt-1 text-[12.5px] text-[var(--text-muted)] bg-[var(--surface-raised)] p-2.5 rounded-[8px] border border-[var(--line-subtle)] whitespace-pre-wrap">
                    {activeLeave.reason}
                  </p>
                </div>
              ) : null}
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
