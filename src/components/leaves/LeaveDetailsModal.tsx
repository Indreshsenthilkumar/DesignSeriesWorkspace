"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import { formatLeaveDateTime, isLeaveTypeOnDuty } from "@/lib/leaves";

export type LeaveRecord = {
  id: string;
  userId: string;
  rollNo?: string;
  email?: string;
  name?: string;
  department?: string;
  year?: string;
  leaveType: string;
  fromDate: string;
  toDate: string;
  gateOut?: string | null;
  gateIn?: string | null;
  duration?: string;
  reason?: string;
  remarks?: string;
  venueDetails?: string;
  companyDetails?: string;
  status: string;
  reviewerId?: string | null;
  reviewedAt?: string | null;
  reviewerRemark?: string;
  createdAt: string;
  user?: {
    id: string;
    name: string;
    rollNo: string;
    department?: string;
    year?: string;
    mentorName?: string;
    mobile?: string;
  };
  reviewer?: {
    id: string;
    name: string;
    role?: string;
  } | null;
};

export function LeaveDetailsModal({
  leave,
  onClose,
  canReview = false,
  isOwner = false,
  onReviewed,
}: {
  leave: LeaveRecord;
  onClose: () => void;
  canReview?: boolean;
  isOwner?: boolean;
  onReviewed?: (updated: LeaveRecord) => void;
}) {
  const toast = useToast();
  const [remark, setRemark] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const displayReason = leave.reason || leave.remarks || "—";
  const studentName = leave.user?.name || leave.name || "Student";
  const studentRollNo = leave.user?.rollNo || leave.rollNo || "—";
  const studentDept = leave.user?.department || leave.department || "General Engineering";
  const mentorDisplayName = leave.user?.mentorName || "Assigned Mentor";

  async function handleDecision(status: "APPROVED" | "REJECTED" | "CANCELLED") {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/leaves", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: leave.id,
          status,
          reviewerRemark: remark,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update leave request");
      }
      onReviewed?.(data.data || { ...leave, status, reviewerRemark: remark, reviewedAt: new Date().toISOString() });
      onClose();
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "APPROVED":
        return (
          <span className="inline-flex items-center rounded-full bg-[#107c41] px-3 py-0.5 text-xs font-semibold text-white shadow-sm">
            Approved
          </span>
        );
      case "REJECTED":
        return (
          <span className="inline-flex items-center rounded-full bg-rose-600 px-3 py-0.5 text-xs font-semibold text-white shadow-sm">
            Rejected
          </span>
        );
      case "CANCELLED":
        return (
          <span className="inline-flex items-center rounded-full bg-slate-500 px-3 py-0.5 text-xs font-semibold text-white shadow-sm">
            Cancelled
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center rounded-full bg-amber-500 px-3 py-0.5 text-xs font-semibold text-white shadow-sm">
            Pending
          </span>
        );
    }
  };

  const getTypeBadge = (type: string) => {
    const isOD = isLeaveTypeOnDuty(type);
    return (
      <span
        className={`inline-flex items-center rounded-full px-3 py-0.5 text-xs font-medium text-white shadow-sm ${
          isOD ? "bg-[#2563eb]" : "bg-[#6366f1]"
        }`}
      >
        {type}
      </span>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-2.5 sm:p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative flex flex-col w-full max-w-xl max-h-[92dvh] sm:max-h-[88vh] overflow-hidden rounded-2xl bg-[var(--surface-raised)] border border-[var(--line-default)] shadow-2xl text-[var(--text-strong)]">
        {/* Modal Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-[var(--line-soft)] px-4 py-3.5 sm:px-6 sm:py-4 bg-[var(--surface-raised)]">
          <h2 className="text-sm sm:text-lg font-bold tracking-tight text-[var(--text-strong)] truncate pr-2">
            Leave Details - {leave.leaveType}
          </h2>
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="shrink-0 rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--surface-sunken)] hover:text-[var(--text-strong)] transition-colors"
          >
            <Icon name="close" className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 min-h-0 overflow-y-auto p-3.5 sm:p-6 space-y-4 sm:space-y-6 overscroll-contain">
          {/* Section 1: HIGHLIGHTED Student Details, Department & Mentor Name at the TOP */}
          <div className="rounded-xl border border-[var(--color-brand-blue)]/25 bg-[var(--color-brand-blue)]/5 p-3.5 sm:p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-2.5 sm:mb-3">
              <div className="grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-[var(--color-brand-blue)]/15 text-[var(--color-brand-blue)]">
                <Icon name="user" className="h-3.5 w-3.5" />
              </div>
              <span className="text-[10.5px] sm:text-xs font-bold uppercase tracking-wider text-[var(--color-brand-blue)]">
                Student & Mentor Details
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-4">
              <div className="min-w-0">
                <p className="text-[10px] sm:text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                  Student Name & Roll No
                </p>
                <p className="mt-0.5 text-xs sm:text-sm font-bold text-[var(--text-strong)] break-words">
                  {studentName} <span className="font-medium text-[var(--text-muted)]">({studentRollNo})</span>
                </p>
              </div>

              <div className="min-w-0">
                <p className="text-[10px] sm:text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                  Department
                </p>
                <p className="mt-0.5 text-xs sm:text-sm font-bold text-[var(--text-strong)] leading-snug break-words">
                  {studentDept}
                </p>
              </div>

              <div className="min-w-0">
                <p className="text-[10px] sm:text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                  Mentor Name
                </p>
                <p className="mt-0.5 text-xs sm:text-sm font-bold text-[var(--text-strong)] leading-snug break-words">
                  {mentorDisplayName}
                </p>
              </div>
            </div>
          </div>

          {/* Section 2: Leave Information (Mobile-responsive 2 col grid) */}
          <div>
            <h3 className="text-xs sm:text-sm font-bold text-[var(--text-strong)] uppercase tracking-wider text-[var(--text-muted)] mb-2.5">
              Leave Information
            </h3>

            <div className="grid grid-cols-2 gap-3 sm:gap-4 text-xs sm:text-sm">
              <div className="min-w-0">
                <p className="text-[10.5px] sm:text-xs font-medium text-[var(--text-muted)]">Leave Type</p>
                <div className="mt-1">{getTypeBadge(leave.leaveType)}</div>
              </div>
              <div className="min-w-0">
                <p className="text-[10.5px] sm:text-xs font-medium text-[var(--text-muted)]">Status</p>
                <div className="mt-1">{getStatusBadge(leave.status)}</div>
              </div>

              <div className="min-w-0">
                <p className="text-[10.5px] sm:text-xs font-medium text-[var(--text-muted)]">From Date</p>
                <p className="mt-0.5 text-xs sm:text-sm font-semibold text-[var(--text-strong)] break-words leading-tight">
                  {formatLeaveDateTime(leave.fromDate)}
                </p>
              </div>
              <div className="min-w-0">
                <p className="text-[10.5px] sm:text-xs font-medium text-[var(--text-muted)]">To Date</p>
                <p className="mt-0.5 text-xs sm:text-sm font-semibold text-[var(--text-strong)] break-words leading-tight">
                  {formatLeaveDateTime(leave.toDate)}
                </p>
              </div>

              <div className="min-w-0">
                <p className="text-[10.5px] sm:text-xs font-medium text-[var(--text-muted)]">Duration</p>
                <p className="mt-0.5 text-xs sm:text-sm font-bold text-[var(--text-strong)]">{leave.duration || "1 day"}</p>
              </div>

              <div className="col-span-2 pt-1 min-w-0">
                <p className="text-[10.5px] sm:text-xs font-medium text-[var(--text-muted)]">Remarks / Reason</p>
                <p className="mt-1 text-xs sm:text-sm font-medium text-[var(--text-strong)] whitespace-pre-wrap break-words rounded-lg bg-[var(--surface-sunken)] p-3 border border-[var(--line-soft)] leading-relaxed">
                  {displayReason}
                </p>
              </div>

              {leave.venueDetails ? (
                <div className="col-span-2 min-w-0">
                  <p className="text-[10.5px] sm:text-xs font-medium text-[var(--text-muted)]">Venue Details</p>
                  <p className="mt-1 text-xs sm:text-sm font-medium text-[var(--text-strong)] break-words rounded-lg bg-[var(--surface-sunken)] p-2.5 border border-[var(--line-soft)]">{leave.venueDetails}</p>
                </div>
              ) : null}

              {leave.companyDetails ? (
                <div className="col-span-2 min-w-0">
                  <p className="text-[10.5px] sm:text-xs font-medium text-[var(--text-muted)]">Company Details</p>
                  <p className="mt-1 text-xs sm:text-sm font-medium text-[var(--text-strong)] break-words rounded-lg bg-[var(--surface-sunken)] p-2.5 border border-[var(--line-soft)]">{leave.companyDetails}</p>
                </div>
              ) : null}
            </div>
          </div>

          {/* Section 3: Approval Status */}
          <div>
            <h3 className="text-xs sm:text-sm font-bold text-[var(--text-strong)] uppercase tracking-wider text-[var(--text-muted)] mb-2.5">
              Approval Status
            </h3>

            <div className="rounded-xl border border-[var(--line-default)] bg-[var(--surface-sunken)] p-3.5 sm:p-5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs sm:text-sm font-bold text-[var(--text-strong)]">Review Decision</span>
                {getStatusBadge(leave.status)}
              </div>

              {leave.reviewedAt ? (
                <p className="mt-2 text-[11px] sm:text-xs text-[var(--text-muted)] leading-relaxed break-words">
                  Approved by: <span className="font-semibold text-[var(--text-strong)]">{leave.reviewer?.name || "Admin / Mentor"}</span> on {formatLeaveDateTime(leave.reviewedAt)}
                </p>
              ) : (
                <p className="mt-2 text-[11px] sm:text-xs text-[var(--text-muted)]">
                  Pending review by domain mentor or administrator.
                </p>
              )}

              {leave.reviewerRemark ? (
                <div className="mt-3 rounded-lg bg-[var(--surface-raised)] p-3 border border-[var(--line-soft)] text-xs break-words">
                  <span className="font-semibold text-[var(--text-strong)]">Reviewer Remark: </span>
                  <span className="text-[var(--text-muted)]">{leave.reviewerRemark}</span>
                </div>
              ) : null}

              {error && (
                <div className="mt-3 rounded-lg bg-rose-500/10 border border-rose-500/20 p-2.5 text-xs text-rose-500">
                  {error}
                </div>
              )}

              {/* Review Actions for Admin / Mentor */}
              {canReview && (
                <div className="mt-4 pt-4 border-t border-[var(--line-soft)] space-y-3">
                  <input
                    type="text"
                    placeholder="Optional review remark (e.g., Approved for competition)..."
                    value={remark}
                    onChange={(e) => setRemark(e.target.value)}
                    className="w-full rounded-lg border border-[var(--line-default)] bg-[var(--surface-raised)] px-3 py-2 text-xs text-[var(--text-strong)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-1 focus:ring-[var(--color-brand-blue)]"
                  />
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3">
                    <button
                      disabled={loading}
                      onClick={() => handleDecision("APPROVED")}
                      className="flex-1 rounded-lg bg-[#107c41] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#0e6b37] disabled:opacity-50 transition-colors shadow-sm"
                    >
                      {loading ? "Processing..." : "Approve Request"}
                    </button>
                    <button
                      disabled={loading}
                      onClick={() => handleDecision("REJECTED")}
                      className="flex-1 rounded-lg bg-rose-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50 transition-colors shadow-sm"
                    >
                      {loading ? "Processing..." : "Reject Request"}
                    </button>
                  </div>
                </div>
              )}

              {/* Cancel Action for Student */}
              {isOwner && leave.status === "PENDING" && !canReview && (
                <div className="mt-4 pt-4 border-t border-[var(--line-soft)]">
                  <button
                    disabled={loading}
                    onClick={() => handleDecision("CANCELLED")}
                    className="w-full rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-2.5 text-xs font-semibold text-rose-500 hover:bg-rose-500/20 disabled:opacity-50 transition-colors"
                  >
                    {loading ? "Cancelling..." : "Cancel Leave Request"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="shrink-0 border-t border-[var(--line-soft)] bg-[var(--surface-sunken)] px-3.5 py-3 sm:px-6 sm:py-3.5 flex items-center justify-between gap-2">
          <button
            onClick={() => {
              if (typeof window !== "undefined") {
                const shareUrl = `${window.location.origin}/leaves/${leave.id}`;
                navigator.clipboard.writeText(shareUrl).then(() => {
                  toast.success("Link copied to clipboard!", "You can send this link to your mentor or admin.");
                });
              }
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--line-default)] bg-[var(--surface-raised)] px-3 py-2 text-xs font-semibold text-[var(--text-strong)] hover:border-[var(--color-brand-blue)] hover:text-[var(--color-brand-blue)] transition-colors shadow-sm"
          >
            <Icon name="link" className="h-3.5 w-3.5" />
            Share Link
          </button>

          <button
            onClick={onClose}
            className="rounded-lg border border-[var(--line-default)] bg-[var(--surface-raised)] px-4 py-2 text-xs font-semibold text-[var(--text-strong)] hover:bg-[var(--surface-sunken)] transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
