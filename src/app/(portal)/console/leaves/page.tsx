import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { PageHeader } from "@/components/shell/PageHeader";
import { StatTile } from "@/components/ui/StatTile";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdminLike, type PermissionSubject } from "@/lib/permissions";
import { matchesMentor } from "@/lib/leaves";
import { markSectionViewed } from "@/lib/badge-tracking";
import { ConsoleLeavesClient } from "./ConsoleLeavesClient";

export const metadata: Metadata = { title: "Leave Request" };
export const dynamic = "force-dynamic";

export default async function ConsoleLeavesPage() {
  const user = await requireUser();

  const isStaff =
    user.role === "ADMIN" ||
    user.role === "SUPER_ADMIN" ||
    user.role === "MENTOR" ||
    user.role === "STUDENT_ADMIN" ||
    user.permLeaveRequests ||
    user.permActivityApproval;

  if (!isStaff) {
    redirect("/dashboard?denied=1");
  }

  await markSectionViewed(user.id, "console_leaves");

  const isGlobalAdmin = isAdminLike(user as PermissionSubject);

  const rawLeaves = await prisma.leaveRequest.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      user: {
        select: { id: true, name: true, rollNo: true, department: true, year: true, mentorName: true, mobile: true },
      },
      reviewer: {
        select: { id: true, name: true, role: true },
      },
    },
    take: 500,
  });

  // If the user is a mentor (not a Super Admin / Admin / Student+ Admin),
  // they only see leave requests for students whose assigned mentor matches them.
  const leaves = isGlobalAdmin
    ? rawLeaves
    : rawLeaves.filter((l) => matchesMentor(l.user?.mentorName, user.name));

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

  const pending = formatted.filter((l) => l.status === "PENDING").length;
  const approved = formatted.filter((l) => l.status === "APPROVED").length;
  const rejected = formatted.filter((l) => l.status === "REJECTED").length;
  const total = formatted.length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Leave Request"
        description={
          !isGlobalAdmin
            ? `Viewing leave and on-duty requests for mentees assigned to ${user.name}.`
            : "Review student leave and on-duty applications, verify event and venue details, and grant gate release approvals."
        }
      />

      <div className="stagger grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Pending Approvals"
          value={pending}
          icon="clock"
          tone={pending > 0 ? "amber" : "slate"}
          caption={isGlobalAdmin ? "Action required" : "Under review"}
        />
        <StatTile
          label="Approved Leaves"
          value={approved}
          icon="check-circle"
          tone={approved > 0 ? "green" : "slate"}
          caption="Active & passed"
        />
        <StatTile
          label="Rejected"
          value={rejected}
          icon="alert"
          tone={rejected > 0 ? "red" : "slate"}
          caption="Declined requests"
        />
        <StatTile
          label="Total History"
          value={total}
          icon="calendar"
          tone="blue"
          caption={isGlobalAdmin ? "All cohort submissions" : "All mentee requests"}
        />
      </div>

      <ConsoleLeavesClient
        initialLeaves={formatted}
        isStaff={isStaff}
        isGlobalAdmin={isGlobalAdmin}
        canApprove={isGlobalAdmin}
        mentorName={user.name}
      />
    </div>
  );
}
