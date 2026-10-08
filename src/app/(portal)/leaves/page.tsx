import type { Metadata } from "next";

import { PageHeader } from "@/components/shell/PageHeader";
import { StatTile } from "@/components/ui/StatTile";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { LeavesClient } from "./LeavesClient";

export const metadata: Metadata = { title: "My Leave" };
export const dynamic = "force-dynamic";

export default async function LeavesPage() {
  const user = await requireUser();

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

      <div className="stagger grid grid-cols-2 gap-3 lg:grid-cols-4">
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
