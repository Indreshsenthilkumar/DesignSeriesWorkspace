import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdminLike, type PermissionSubject } from "@/lib/permissions";
import { matchesMentor } from "@/lib/leaves";
import { LeaveDetailClient } from "./LeaveDetailClient";

export const metadata: Metadata = { title: "Leave Details" };
export const dynamic = "force-dynamic";

export default async function LeaveDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;

  const leave = await prisma.leaveRequest.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          rollNo: true,
          department: true,
          year: true,
          mentorName: true,
          mobile: true,
        },
      },
      reviewer: {
        select: {
          id: true,
          name: true,
          role: true,
        },
      },
    },
  });

  if (!leave) {
    return (
      <div className="mx-auto max-w-lg py-12 text-center">
        <div className="rounded-2xl border border-[var(--line-default)] bg-[var(--surface-raised)] p-8">
          <h2 className="text-lg font-bold text-[var(--text-strong)]">Leave Request Not Found</h2>
          <p className="mt-2 text-xs text-[var(--text-muted)]">
            This leave request does not exist or may have been removed.
          </p>
          <Link
            href="/leaves"
            className="mt-5 inline-flex items-center gap-1.5 rounded-xl bg-[var(--color-brand-blue)] px-4 py-2 text-xs font-semibold text-white"
          >
            Go to My Leaves
          </Link>
        </div>
      </div>
    );
  }

  const isStaff =
    user.role === "ADMIN" ||
    user.role === "SUPER_ADMIN" ||
    user.role === "MENTOR" ||
    user.role === "STUDENT_ADMIN" ||
    user.permLeaveRequests ||
    user.permActivityApproval;

  const isGlobalAdmin = isAdminLike(user as PermissionSubject);
  const isOwner = leave.userId === user.id;

  // Student can view their own leave, staff can view student leaves
  if (user.role === "STUDENT" && !isOwner && !isStaff) {
    return (
      <div className="mx-auto max-w-lg py-12 text-center">
        <div className="rounded-2xl border border-[var(--line-default)] bg-[var(--surface-raised)] p-8">
          <h2 className="text-lg font-bold text-[var(--text-strong)]">Access Restricted</h2>
          <p className="mt-2 text-xs text-[var(--text-muted)]">
            This leave request belongs to another student. Only mentors and administrators can review external leaves.
          </p>
          <Link
            href="/leaves"
            className="mt-5 inline-flex items-center gap-1.5 rounded-xl bg-[var(--color-brand-blue)] px-4 py-2 text-xs font-semibold text-white"
          >
            Go to My Leaves
          </Link>
        </div>
      </div>
    );
  }

  // A mentor can only view their own mentees' leaves
  if (!isGlobalAdmin && user.role === "MENTOR" && !isOwner) {
    if (!matchesMentor(leave.user?.mentorName, user.name)) {
      return (
        <div className="mx-auto max-w-lg py-12 text-center">
          <div className="rounded-2xl border border-[var(--line-default)] bg-[var(--surface-raised)] p-8">
            <h2 className="text-lg font-bold text-[var(--text-strong)]">Access Restricted</h2>
            <p className="mt-2 text-xs text-[var(--text-muted)]">
              This leave request belongs to a student who is not assigned to you as a mentee.
            </p>
            <Link
              href="/console/leaves"
              className="mt-5 inline-flex items-center gap-1.5 rounded-xl bg-[var(--color-brand-blue)] px-4 py-2 text-xs font-semibold text-white"
            >
              Back to Leave Requests
            </Link>
          </div>
        </div>
      );
    }
  }

  const formatted = {
    id: leave.id,
    userId: leave.userId,
    rollNo: leave.rollNo,
    email: leave.email,
    name: leave.name,
    department: leave.department,
    year: leave.year,
    leaveType: leave.leaveType,
    fromDate: leave.fromDate,
    toDate: leave.toDate,
    gateOut: leave.gateOut,
    gateIn: leave.gateIn,
    duration: leave.duration,
    reason: leave.reason,
    remarks: leave.remarks,
    venueDetails: leave.venueDetails,
    companyDetails: leave.companyDetails,
    status: leave.status,
    reviewerId: leave.reviewerId,
    reviewedAt: leave.reviewedAt?.toISOString() ?? null,
    reviewerRemark: leave.reviewerRemark,
    createdAt: leave.createdAt.toISOString(),
    user: leave.user,
    reviewer: leave.reviewer,
  };

  return (
    <div className="py-2">
      <LeaveDetailClient
        initialLeave={formatted}
        currentUser={{
          id: user.id,
          role: user.role,
          name: user.name,
        }}
        isStaff={isStaff}
        canApprove={isGlobalAdmin}
      />
    </div>
  );
}
