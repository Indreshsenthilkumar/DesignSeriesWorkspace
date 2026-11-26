import type { Metadata } from "next";

import { PageHeader } from "@/components/shell/PageHeader";
import { StatGrid, StatTile } from "@/components/ui/StatTile";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { markSectionViewed } from "@/lib/badge-tracking";
import { LeavesClient } from "./LeavesClient";

export const metadata: Metadata = { title: "My Leave" };
export const dynamic = "force-dynamic";

export default async function LeavesPage() {
  const user = await requireUser();
  await markSectionViewed(user.id, "leaves");

  const leaves = await prisma.leaveRequest.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: {
      user: {
        select: { id: true, name: true, rollNo: true, department: true, year: true, mentorName: true, mobile: true },
      },
      reviewer: {
        select: { id: true, name: true, role: true },
      },
    },
  });

  const formatted = leaves.map((l) => ({
    id: l.id,
    userId: l.userId,
    rollNo: l.rollNo,
    email: l.email,
    name: l.name,
    department: l.department,
    year: l.year,
    leaveType: l.leaveType,
    fromDate: l.fromDate,
    toDate: l.toDate,
    gateOut: l.gateOut,
    gateIn: l.gateIn,
    duration: l.duration,
    reason: l.reason,
    remarks: l.remarks,
    venueDetails: l.venueDetails,
    companyDetails: l.companyDetails,
    status: l.status,
    reviewerId: l.reviewerId,
    reviewedAt: l.reviewedAt?.toISOString() ?? null,
    reviewerRemark: l.reviewerRemark,
    createdAt: l.createdAt.toISOString(),
    user: l.user,
    reviewer: l.reviewer,
  }));

  const total = formatted.length;
  const pending = formatted.filter((l) => l.status === "PENDING").length;
  const approved = formatted.filter((l) => l.status === "APPROVED").length;
  const rejected = formatted.filter((l) => l.status === "REJECTED").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Leave"
        description="Apply for Leave or OnDuty (OD) permissions, track mentor approval status, and view detailed gate slips."
      />

      {/* Desktop StatGrid */}
      <div className="hidden md:block">
        <StatGrid>
          <StatTile
            label="Total Requests"
            value={total}
            icon="calendar"
            tone="blue"
            caption="All time submitted"
          />
          <StatTile
            label="Awaiting Approval"
            value={pending}
            icon="clock"
            tone={pending > 0 ? "amber" : "slate"}
            caption="In mentor review queue"
          />
          <StatTile
            label="Approved"
            value={approved}
            icon="check-circle"
            tone={approved > 0 ? "green" : "slate"}
            caption="Granted leave permissions"
          />
          <StatTile
            label="Rejected"
            value={rejected}
            icon="alert"
            tone={rejected > 0 ? "red" : "slate"}
            caption={rejected > 0 ? "Check remarks" : "None"}
          />
        </StatGrid>
      </div>

      {/* Mobile-Only Android-Style Compact Metric Bar */}
      <div className="md:hidden grid grid-cols-4 gap-1 rounded-2xl bg-[var(--surface-raised)] border border-[var(--line-default)] p-2.5 shadow-xs">
        <div className="flex flex-col items-center justify-center text-center">
          <span className="text-[10px] font-bold uppercase tracking-wider text-blue-500 truncate w-full">Total</span>
          <span className="text-[16px] font-extrabold text-[var(--text-strong)] tabular-nums leading-tight mt-0.5">{total}</span>
          <span className="text-[9.5px] font-medium text-[var(--text-faint)] truncate w-full">Requests</span>
        </div>
        <div className="flex flex-col items-center justify-center text-center border-l border-[var(--line-soft)]">
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-500 truncate w-full">Pending</span>
          <span className="text-[16px] font-extrabold text-[var(--text-strong)] tabular-nums leading-tight mt-0.5">{pending}</span>
          <span className="text-[9.5px] font-medium text-[var(--text-faint)] truncate w-full">Review</span>
        </div>
        <div className="flex flex-col items-center justify-center text-center border-l border-[var(--line-soft)]">
          <span className="text-[10px] font-bold uppercase tracking-wider text-green-500 truncate w-full">Approved</span>
          <span className="text-[16px] font-extrabold text-[var(--text-strong)] tabular-nums leading-tight mt-0.5">{approved}</span>
          <span className="text-[9.5px] font-medium text-[var(--text-faint)] truncate w-full">Granted</span>
        </div>
        <div className="flex flex-col items-center justify-center text-center border-l border-[var(--line-soft)]">
          <span className="text-[10px] font-bold uppercase tracking-wider text-rose-500 truncate w-full">Rejected</span>
          <span className="text-[16px] font-extrabold text-[var(--text-strong)] tabular-nums leading-tight mt-0.5">{rejected}</span>
          <span className="text-[9.5px] font-medium text-[var(--text-faint)] truncate w-full">Declined</span>
        </div>
      </div>

      <LeavesClient
        initialLeaves={formatted}
        currentUser={{
          id: user.id,
          name: user.name,
          rollNo: user.rollNo,
          department: user.department,
          year: user.year,
          mentorName: user.mentorName,
        }}
      />
    </div>
  );
}
