"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { getLeaveFieldGroup, LEAVE_TYPES, calculateDuration } from "@/lib/leaves";
import type { LeaveRecord } from "./LeaveDetailsModal";

export function ApplyLeaveModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: (newLeave: LeaveRecord) => void;
}) {
  const [leaveType, setLeaveType] = useState<string>("Leave");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [reason, setReason] = useState<string>("");
  const [remarks, setRemarks] = useState<string>("");
  const [venueDetails, setVenueDetails] = useState<string>("");
  const [companyDetails, setCompanyDetails] = useState<string>("");

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fieldGroup = getLeaveFieldGroup(leaveType);
  const estimatedDuration = fromDate && toDate ? calculateDuration(fromDate, toDate) : "";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!fromDate || !toDate) {
      setError("Please provide both From Date and To Date.");
      return;
    }

    if (new Date(fromDate).getTime() > new Date(toDate).getTime()) {
      setError("To Date must be equal to or after From Date.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/leaves", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leaveType,
          fromDate,
          toDate,
          reason,
          remarks,
          venueDetails,
          companyDetails,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to submit leave request.");
      }

      onSuccess(data.data);
      onClose();
    } catch (err: any) {
      setError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-2.5 sm:p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative flex flex-col w-full max-w-lg max-h-[92dvh] sm:max-h-[88vh] overflow-hidden rounded-2xl bg-[var(--surface-raised)] border border-[var(--line-default)] shadow-2xl text-[var(--text-strong)]">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-[var(--line-soft)] px-4 py-3.5 sm:px-6 sm:py-4">
          <div className="min-w-0 pr-2">
            <h2 className="text-base sm:text-lg font-bold tracking-tight text-[var(--text-strong)] truncate">
              Apply Leave
            </h2>
            <p className="text-[11px] sm:text-xs text-[var(--text-muted)] mt-0.5 truncate">
              Submit request for leave or on-duty approval
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="shrink-0 rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--surface-sunken)] hover:text-[var(--text-strong)] transition-colors"
          >
            <Icon name="close" className="h-5 w-5" />
          </button>
        </div>

        {/* Form Scrollable Body */}
        <form onSubmit={handleSubmit} className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-5 overscroll-contain">
          {error && (
            <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-500">
              {error}
            </div>
          )}

          {/* Leave Type */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
              Leave Type <span className="text-rose-500">*</span>
            </label>
            <select
              value={leaveType}
              onChange={(e) => setLeaveType(e.target.value)}
              className="w-full rounded-xl border border-[var(--line-default)] bg-[var(--surface-sunken)] px-3.5 py-2.5 text-sm text-[var(--text-strong)] focus:border-[var(--color-brand-blue)] focus:outline-none transition-colors"
              required
            >
              {LEAVE_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>

          {/* From & To Date Time */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
                From Date & Time <span className="text-rose-500">*</span>
              </label>
              <input
                type="datetime-local"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-full rounded-xl border border-[var(--line-default)] bg-[var(--surface-sunken)] px-3 py-2 text-xs text-[var(--text-strong)] focus:border-[var(--color-brand-blue)] focus:outline-none transition-colors"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
                To Date & Time <span className="text-rose-500">*</span>
              </label>
              <input
                type="datetime-local"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-full rounded-xl border border-[var(--line-default)] bg-[var(--surface-sunken)] px-3 py-2 text-xs text-[var(--text-strong)] focus:border-[var(--color-brand-blue)] focus:outline-none transition-colors"
                required
              />
            </div>
          </div>

          {estimatedDuration && (
            <div className="rounded-lg bg-[var(--surface-sunken)] px-3 py-2 text-xs text-[var(--text-muted)] flex items-center justify-between">
              <span>Estimated Duration:</span>
              <span className="font-semibold text-[var(--text-strong)]">{estimatedDuration}</span>
            </div>
          )}

          {/* Conditional Field: Group A (REASON ONLY) */}
          {fieldGroup === "REASON_ONLY" && (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
                Reason <span className="text-rose-500">*</span>
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                placeholder="Explain the reason for your leave (e.g. Going to Home, Medical rest)..."
                className="w-full rounded-xl border border-[var(--line-default)] bg-[var(--surface-sunken)] p-3 text-xs text-[var(--text-strong)] placeholder:text-[var(--text-faint)] focus:border-[var(--color-brand-blue)] focus:outline-none transition-colors"
                required
              />
            </div>
          )}

          {/* Conditional Field: Group B (REMARKS & VENUE) */}
          {fieldGroup === "REMARKS_VENUE" && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
                  Remarks <span className="text-rose-500">*</span>
                </label>
                <textarea
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  rows={2}
                  placeholder="Details of the event or examination..."
                  className="w-full rounded-xl border border-[var(--line-default)] bg-[var(--surface-sunken)] p-3 text-xs text-[var(--text-strong)] placeholder:text-[var(--text-faint)] focus:border-[var(--color-brand-blue)] focus:outline-none transition-colors"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
                  Venue Details <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={venueDetails}
                  onChange={(e) => setVenueDetails(e.target.value)}
                  placeholder="Venue location, college name or exam center..."
                  className="w-full rounded-xl border border-[var(--line-default)] bg-[var(--surface-sunken)] px-3.5 py-2.5 text-xs text-[var(--text-strong)] placeholder:text-[var(--text-faint)] focus:border-[var(--color-brand-blue)] focus:outline-none transition-colors"
                  required
                />
              </div>
            </div>
          )}

          {/* Conditional Field: Group C (REMARKS & COMPANY DETAILS) */}
          {fieldGroup === "REMARKS_COMPANY" && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
                  Remarks <span className="text-rose-500">*</span>
                </label>
                <textarea
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  rows={2}
                  placeholder="Competition or presentation details..."
                  className="w-full rounded-xl border border-[var(--line-default)] bg-[var(--surface-sunken)] p-3 text-xs text-[var(--text-strong)] placeholder:text-[var(--text-faint)] focus:border-[var(--color-brand-blue)] focus:outline-none transition-colors"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
                  Company / Organization Details <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={companyDetails}
                  onChange={(e) => setCompanyDetails(e.target.value)}
                  placeholder="Company name, institution or organizing body..."
                  className="w-full rounded-xl border border-[var(--line-default)] bg-[var(--surface-sunken)] px-3.5 py-2.5 text-xs text-[var(--text-strong)] placeholder:text-[var(--text-faint)] focus:border-[var(--color-brand-blue)] focus:outline-none transition-colors"
                  required
                />
              </div>
            </div>
          )}

          {/* Conditional Field: Group D (REMARKS, VENUE & COMPANY) */}
          {fieldGroup === "REMARKS_VENUE_COMPANY" && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
                  Remarks <span className="text-rose-500">*</span>
                </label>
                <textarea
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  rows={2}
                  placeholder="Details of the placement drive or training course..."
                  className="w-full rounded-xl border border-[var(--line-default)] bg-[var(--surface-sunken)] p-3 text-xs text-[var(--text-strong)] placeholder:text-[var(--text-faint)] focus:border-[var(--color-brand-blue)] focus:outline-none transition-colors"
                  required
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
                    Venue Details <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={venueDetails}
                    onChange={(e) => setVenueDetails(e.target.value)}
                    placeholder="Venue location..."
                    className="w-full rounded-xl border border-[var(--line-default)] bg-[var(--surface-sunken)] px-3.5 py-2 text-xs text-[var(--text-strong)] placeholder:text-[var(--text-faint)] focus:border-[var(--color-brand-blue)] focus:outline-none transition-colors"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
                    Company Details <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={companyDetails}
                    onChange={(e) => setCompanyDetails(e.target.value)}
                    placeholder="Company name..."
                    className="w-full rounded-xl border border-[var(--line-default)] bg-[var(--surface-sunken)] px-3.5 py-2 text-xs text-[var(--text-strong)] placeholder:text-[var(--text-faint)] focus:border-[var(--color-brand-blue)] focus:outline-none transition-colors"
                    required
                  />
                </div>
              </div>
            </div>
          )}

          {/* Form Actions */}
          <div className="border-t border-[var(--line-soft)] pt-5 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-[var(--line-default)] bg-[var(--surface-sunken)] px-4 py-2.5 text-xs font-semibold text-[var(--text-strong)] hover:bg-[var(--surface-raised)] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-xl bg-[var(--color-brand-blue)] px-5 py-2.5 text-xs font-semibold text-white hover:opacity-95 disabled:opacity-50 transition-all shadow-md"
            >
              {loading ? "Submitting..." : "Submit Leave Request"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
