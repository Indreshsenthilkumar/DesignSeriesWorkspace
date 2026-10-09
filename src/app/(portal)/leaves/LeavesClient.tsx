"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import { formatLeaveDateTime, isLeaveTypeOnDuty } from "@/lib/leaves";
import { LeaveDetailsModal, type LeaveRecord } from "@/components/leaves/LeaveDetailsModal";
import { ApplyLeaveModal } from "@/components/leaves/ApplyLeaveModal";

export function LeavesClient({
  initialLeaves,
  currentUser,
}: {
  initialLeaves: LeaveRecord[];
  currentUser: {
    id: string;
    name: string;
    rollNo: string;
    department?: string;
    year?: string;
    mentorName?: string;
  };
}) {
  const toast = useToast();
  const [leaves, setLeaves] = useState<LeaveRecord[]>(initialLeaves);
  const [filter, setFilter] = useState<string>("ALL");
  const [isApplyOpen, setIsApplyOpen] = useState(false);
  const [selectedLeave, setSelectedLeave] = useState<LeaveRecord | null>(null);

  const filteredLeaves = leaves.filter((item) => {
    if (filter === "ALL") return true;
    return item.status === filter;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "APPROVED":
        return (
          <span className="inline-flex items-center rounded-md bg-[#107c41] px-2 py-0.5 text-xs font-semibold text-white shadow-sm">
            Approved
          </span>
        );
      case "REJECTED":
        return (
          <span className="inline-flex items-center rounded-md bg-rose-600 px-2 py-0.5 text-xs font-semibold text-white shadow-sm">
            Rejected
          </span>
        );
      case "CANCELLED":
        return (
          <span className="inline-flex items-center rounded-md bg-slate-500 px-2 py-0.5 text-xs font-semibold text-white shadow-sm">
            Cancelled
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center rounded-md bg-amber-500 px-2 py-0.5 text-xs font-semibold text-white shadow-sm">
            Pending
          </span>
        );
    }
  };

  const getTypeBadge = (type: string) => {
    const isOD = isLeaveTypeOnDuty(type);
    return (
      <span
        className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium text-white shadow-sm ${
          isOD ? "bg-[#2563eb]" : "bg-[#6366f1]"
        }`}
      >
        {type}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Top Action Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto rounded-lg bg-[var(--surface-sunken)] p-1 border border-[var(--line-soft)]">
          {[
            { id: "ALL", label: "All Leaves" },
            { id: "PENDING", label: "Pending" },
            { id: "APPROVED", label: "Approved" },
            { id: "REJECTED", label: "Rejected" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
                filter === tab.id
                  ? "bg-[var(--surface-raised)] text-[var(--text-strong)] shadow-sm"
                  : "text-[var(--text-muted)] hover:text-[var(--text-strong)]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Apply Leave Button */}
        <button
          onClick={() => setIsApplyOpen(true)}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--color-brand-blue)] px-4 py-2.5 text-xs font-semibold text-white shadow-md hover:opacity-95 transition-all"
        >
          <Icon name="plus" className="h-4 w-4" />
          Apply Leave
        </button>
      </div>

      {/* Leave Requests List */}
      {filteredLeaves.length === 0 ? (
        <div className="rounded-lg border border-[var(--line-default)] bg-[var(--surface-raised)] p-12 text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-lg bg-[var(--surface-sunken)] text-[var(--text-muted)] mb-3">
            <Icon name="calendar" className="h-6 w-6" />
          </div>
          <h3 className="text-base font-semibold text-[var(--text-strong)]">No leave records found</h3>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            {filter === "ALL"
              ? "You haven't submitted any leave or OnDuty requests yet."
              : `No leaves with status "${filter}".`}
          </p>
          <button
            onClick={() => setIsApplyOpen(true)}
            className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-[var(--surface-sunken)] px-3.5 py-2 text-xs font-semibold text-[var(--text-strong)] hover:bg-[var(--surface-raised)] border border-[var(--line-default)]"
          >
            <Icon name="plus" className="h-3.5 w-3.5" />
            Apply Leave
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredLeaves.map((item) => (
            <div
              key={item.id}
              onClick={() => setSelectedLeave(item)}
              className="group relative flex cursor-pointer flex-col justify-between overflow-hidden rounded-lg border border-[var(--line-default)] bg-[var(--surface-raised)] p-4 sm:p-5 shadow-sm transition-all hover:border-[var(--color-brand-blue)] hover:shadow-md"
            >
              <div>
                {/* Card Header: Type & Status */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  {getTypeBadge(item.leaveType)}
                  {getStatusBadge(item.status)}
                </div>

                {/* Duration & Dates */}
                <div className="space-y-1.5">
                  <p className="text-sm font-bold text-[var(--text-strong)]">
                    {item.duration || "1 day"}
                  </p>
                  <div className="text-xs text-[var(--text-muted)] space-y-0.5">
                    <p className="flex items-center gap-1.5">
                      <span className="text-[var(--text-faint)]">From:</span>
                      <span className="font-medium text-[var(--text-strong)]">
                        {formatLeaveDateTime(item.fromDate)}
                      </span>
                    </p>
                    <p className="flex items-center gap-1.5">
                      <span className="text-[var(--text-faint)]">To:</span>
                      <span className="font-medium text-[var(--text-strong)]">
                        {formatLeaveDateTime(item.toDate)}
                      </span>
                    </p>
                  </div>
                </div>

                {/* Reason / Remarks */}
                <div className="mt-3 pt-2.5 border-t border-[var(--line-soft)] text-xs">
                  <p className="text-[11px] sm:text-xs font-medium text-[var(--text-muted)]">
                    Reason / Remarks
                  </p>
                  <p className="mt-0.5 text-xs font-medium text-[var(--text-strong)] line-clamp-2 break-all leading-relaxed">
                    {item.reason || item.remarks || "—"}
                  </p>
                </div>
              </div>

              {/* Card Footer: View Details & Share */}
              <div className="mt-4 pt-3 border-t border-[var(--line-soft)] flex items-center justify-between text-xs">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (typeof window !== "undefined") {
                      const shareUrl = `${window.location.origin}/leaves/${item.id}`;
                      navigator.clipboard.writeText(shareUrl).then(() => {
                        toast.success("Link copied to clipboard!", "Share this link with your mentor or admin.");
                      });
                    }
                  }}
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[var(--text-muted)] hover:bg-[var(--surface-sunken)] hover:text-[var(--color-brand-blue)] transition-colors"
                >
                  <Icon name="link" className="h-3 w-3" />
                  Share
                </button>

                <span className="font-semibold text-[var(--color-brand-blue)] group-hover:translate-x-0.5 transition-transform inline-flex items-center gap-1">
                  Details <Icon name="chevron-right" className="h-3 w-3" />
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Apply Leave Modal */}
      {isApplyOpen && (
        <ApplyLeaveModal
          onClose={() => setIsApplyOpen(false)}
          onSuccess={(newLeave) => {
            setLeaves((prev) => [newLeave, ...prev]);
            setSelectedLeave(newLeave);
          }}
        />
      )}

      {/* Leave Details Modal */}
      {selectedLeave && (
        <LeaveDetailsModal
          leave={{
            ...selectedLeave,
            user: selectedLeave.user || {
              id: currentUser.id,
              name: currentUser.name,
              rollNo: currentUser.rollNo,
              department: currentUser.department,
              year: currentUser.year,
              mentorName: currentUser.mentorName,
            },
          }}
          isOwner={true}
          canReview={false}
          onClose={() => setSelectedLeave(null)}
          onReviewed={(updated) => {
            setLeaves((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
            setSelectedLeave(updated);
          }}
        />
      )}
    </div>
  );
}
