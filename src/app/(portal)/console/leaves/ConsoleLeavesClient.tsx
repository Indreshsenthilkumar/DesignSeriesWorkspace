"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { formatLeaveDateTime, isLeaveTypeOnDuty } from "@/lib/leaves";
import { LeaveDetailsModal, type LeaveRecord } from "@/components/leaves/LeaveDetailsModal";

export function ConsoleLeavesClient({
  initialLeaves,
  isStaff,
}: {
  initialLeaves: LeaveRecord[];
  isStaff: boolean;
}) {
  const [leaves, setLeaves] = useState<LeaveRecord[]>(initialLeaves);
  const [filter, setFilter] = useState<string>("PENDING");
  const [query, setQuery] = useState<string>("");
  const [selectedLeave, setSelectedLeave] = useState<LeaveRecord | null>(null);

  const filteredLeaves = leaves.filter((item) => {
    if (filter !== "ALL" && item.status !== filter) return false;
    if (query.trim()) {
      const q = query.toLowerCase();
      const matchName = item.user?.name?.toLowerCase().includes(q);
      const matchRoll = item.user?.rollNo?.toLowerCase().includes(q) || item.rollNo?.toLowerCase().includes(q);
      const matchType = item.leaveType.toLowerCase().includes(q);
      const matchReason = (item.reason || item.remarks || "").toLowerCase().includes(q);
      const matchDept = (item.department || item.user?.department || "").toLowerCase().includes(q);
      return matchName || matchRoll || matchType || matchReason || matchDept;
    }
    return true;
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
    <div className="space-y-5">
      {/* Top Filter & Search Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto rounded-lg bg-[var(--surface-sunken)] p-1 border border-[var(--line-soft)]">
          {[
            { id: "PENDING", label: "Pending" },
            { id: "APPROVED", label: "Approved" },
            { id: "REJECTED", label: "Rejected" },
            { id: "ALL", label: "All Requests" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className={`rounded-md px-3.5 py-1.5 text-xs font-semibold transition-all ${
                filter === tab.id
                  ? "bg-[var(--surface-raised)] text-[var(--text-strong)] shadow-sm"
                  : "text-[var(--text-muted)] hover:text-[var(--text-strong)]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-72">
          <Icon
            name="search"
            className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-muted)]"
          />
          <input
            type="text"
            placeholder="Search by student, roll no, type..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-md border border-[var(--line-default)] bg-[var(--surface-sunken)] pl-9 pr-3.5 py-2 text-xs text-[var(--text-strong)] placeholder:text-[var(--text-faint)] focus:border-[var(--color-brand-blue)] focus:outline-none transition-colors"
          />
        </div>
      </div>

      {/* Requests Table */}
      {filteredLeaves.length === 0 ? (
        <div className="rounded-lg border border-[var(--line-default)] bg-[var(--surface-raised)] p-12 text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-lg bg-[var(--surface-sunken)] text-[var(--text-muted)] mb-3">
            <Icon name="calendar" className="h-6 w-6" />
          </div>
          <h3 className="text-base font-semibold text-[var(--text-strong)]">No leave requests found</h3>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            {query.trim()
              ? "No requests match your search criteria."
              : `No requests with status "${filter}".`}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-[var(--line-default)] bg-[var(--surface-raised)] shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[var(--line-soft)] bg-[var(--surface-sunken)] text-[var(--text-muted)] uppercase tracking-wider font-semibold">
                <tr>
                  <th className="px-5 py-3.5">Student</th>
                  <th className="px-4 py-3.5">Leave Type</th>
                  <th className="px-4 py-3.5">From & To</th>
                  <th className="px-4 py-3.5">Duration</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-4 py-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line-soft)]">
                {filteredLeaves.map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-[var(--surface-sunken)]/60 transition-colors cursor-pointer"
                    onClick={() => setSelectedLeave(item)}
                  >
                    <td className="px-5 py-4">
                      <div className="font-bold text-[var(--text-strong)]">
                        {item.user?.name || item.name || "Student"}
                      </div>
                      <div className="text-[11px] text-[var(--text-muted)]">
                        {item.user?.rollNo || item.rollNo} • {item.user?.department || item.department || item.user?.year || ""}
                      </div>
                    </td>
                    <td className="px-4 py-4">{getTypeBadge(item.leaveType)}</td>
                    <td className="px-4 py-4 space-y-0.5">
                      <div className="font-medium text-[var(--text-strong)]">
                        {formatLeaveDateTime(item.fromDate)}
                      </div>
                      <div className="text-[11px] text-[var(--text-muted)]">
                        to {formatLeaveDateTime(item.toDate)}
                      </div>
                    </td>
                    <td className="px-4 py-4 font-semibold text-[var(--text-strong)]">
                      {item.duration || "1 day"}
                    </td>
                    <td className="px-4 py-4">{getStatusBadge(item.status)}</td>
                    <td className="px-4 py-4 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedLeave(item);
                        }}
                        className="inline-flex items-center gap-1 rounded-lg border border-[var(--line-default)] bg-[var(--surface-sunken)] px-3 py-1.5 font-semibold text-[var(--text-strong)] hover:border-[var(--color-brand-blue)] hover:text-[var(--color-brand-blue)] transition-colors"
                      >
                        {item.status === "PENDING" ? "Review" : "Details"}
                        <Icon name="chevron-right" className="h-3 w-3" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Leave Details / Approval Modal */}
      {selectedLeave && (
        <LeaveDetailsModal
          leave={selectedLeave}
          isOwner={false}
          canReview={isStaff}
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
