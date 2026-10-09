"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/Button";
import { Field, Textarea } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { ATTENDANCE_HOURS, HOUR_WINDOW } from "@/lib/constants";
import { formatDay } from "@/lib/dates";
import { cn } from "@/lib/utils";

interface CheckInPanelProps {
  date: string;
  loggedHours: number[];
  loggedReason?: string | null;
  /** True once the 23:30 cutoff has passed. */
  closed: boolean;
  compact?: boolean;
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
}: CheckInPanelProps) {
  const router = useRouter();
  const toast = useToast();

  const logged = useMemo(() => new Set(loggedHours), [loggedHours]);
  const hasAlreadySubmitted = logged.size > 0;

  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

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
        `${count} ${count === 1 ? "hour" : "hours"} saved successfully. This submission is now permanently locked for today.`
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
          {hasAlreadySubmitted ? (
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

      {/* --- State 1: Already Submitted for Today (Permanently Locked) ------ */}
      {hasAlreadySubmitted ? (
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
                    Only 1 submission allowed / day
                  </span>
                </div>
                <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--text-muted)]">
                  Your attendance for today has been submitted and stored as individual hour records.
                  Once entered, logs cannot be edited or deleted.
                </p>
              </div>
            </div>

            {/* Submitted hours display */}
            <div className="mt-3.5 pt-3 border-t border-[var(--color-brand-green-200)] dark:border-[var(--color-brand-green-900)]">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-faint)]">
                Logged Hours for Today
              </span>
              <div className="mt-2 grid grid-cols-4 sm:grid-cols-7 gap-2">
                {ATTENDANCE_HOURS.map((hour) => {
                  const isPresent = logged.has(hour);
                  return (
                    <div
                      key={hour}
                      className={cn(
                        "flex flex-col items-center justify-center py-2 px-1 rounded-[10px] border text-center transition-colors",
                        isPresent
                          ? "border-[var(--color-brand-green)] bg-[var(--color-brand-green-100)] dark:bg-[var(--color-brand-green-900)]/40 text-[var(--color-brand-green-800)] dark:text-[var(--color-brand-green-200)]"
                          : "border-[var(--line-subtle)] bg-[var(--surface-raised)]/50 opacity-40 text-[var(--text-faint)]"
                      )}
                    >
                      <span className="text-[15px] font-bold leading-none">Hr {hour}</span>
                      <span className="mt-1 text-[9.5px] font-semibold uppercase">
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

          <p className="mb-3 text-[11px] text-[var(--text-faint)]">
            💡 <span className="font-semibold">Single tap:</span> Toggle individual hour • <span className="font-semibold">Double tap:</span> Select/Deselect all hours up to that hour (e.g. double tap 4 to batch select 1–4).
          </p>

          {/* Hour grid */}
          <div
            className={cn(
              "grid gap-2",
              compact ? "grid-cols-4 sm:grid-cols-7" : "grid-cols-4 sm:grid-cols-7"
            )}
          >
            {ATTENDANCE_HOURS.map((hour) => {
              const isSelected = selected.has(hour);

              return (
                <button
                  key={hour}
                  type="button"
                  onClick={() => handleHourClick(hour)}
                  aria-pressed={isSelected}
                  title={`Hour ${hour} (${HOUR_WINDOW[hour]}) - Tap to toggle, double-tap for batch`}
                  className={cn(
                    "group relative flex flex-col items-center justify-center gap-0.5 rounded-[12px] border py-2.5 px-1 select-none",
                    "transition-all duration-150 active:scale-95",
                    isSelected
                      ? "border-[var(--accent)] bg-[var(--accent-soft)] shadow-sm"
                      : "border-[var(--line-default)] bg-[var(--surface-raised)] hover:border-[var(--text-faint)]"
                  )}
                >
                  <span
                    className={cn(
                      "text-[17px] font-bold leading-none tabular-nums",
                      isSelected ? "text-[var(--accent)]" : "text-[var(--text-strong)]"
                    )}
                  >
                    {hour}
                  </span>
                  <span
                    className={cn(
                      "text-[9.5px] font-semibold uppercase tracking-[0.06em]",
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
            <Field
              label="Reason / What did you work on?"
              htmlFor="missed-otp-reason"
              required
              help="Enter a brief description of tasks completed during these hours (minimum 4 characters)."
            >
              <Textarea
                id="missed-otp-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Worked on UI components and completed unit testing for project modules."
                maxLength={400}
                rows={compact ? 2 : 3}
              />
            </Field>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <p className="text-[11.5px] text-[var(--text-faint)]">
                {selected.size > 0
                  ? `Selected ${selected.size} ${selected.size === 1 ? "hour" : "hours"}: ${[...selected]
                      .sort((a, b) => a - b)
                      .join(", ")} (1 submission per day, locked upon submit)`
                  : "Select the hours you attended above."}
              </p>
              <Button
                onClick={submit}
                loading={saving}
                disabled={selected.size === 0 || reason.trim().length < 4}
                icon={saving ? undefined : "check-circle"}
              >
                {saving ? "Submitting…" : "Submit Missed OTP Attendance"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
