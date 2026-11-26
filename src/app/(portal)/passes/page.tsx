import type { Metadata } from "next";

import { PageHeader } from "@/components/shell/PageHeader";
import { StatGrid, StatTile } from "@/components/ui/StatTile";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { toDayKey } from "@/lib/dates";
import { markSectionViewed } from "@/lib/badge-tracking";

import { PassesClient, type PassRow } from "./PassesClient";

export const metadata: Metadata = { title: "Activity passes" };
export const dynamic = "force-dynamic";

export default async function PassesPage() {
  const user = await requireUser();
  await markSectionViewed(user.id, "passes");

  const passes = await prisma.activityPass.findMany({
    where: { userId: user.id },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      date: true,
      fromTime: true,
      toTime: true,
      destination: true,
      reason: true,
      category: true,
      status: true,
      passCode: true,
      remark: true,
      reviewedAt: true,
      createdAt: true,
      reviewer: { select: { name: true } },
    },
  });

  const rows: PassRow[] = passes.map((pass) => ({
    id: pass.id,
    date: pass.date,
    fromTime: pass.fromTime,
    toTime: pass.toTime,
    destination: pass.destination,
    reason: pass.reason,
    category: pass.category,
    status: pass.status,
    passCode: pass.passCode,
    remark: pass.remark,
    reviewerName: pass.reviewer?.name ?? null,
    reviewedAt: pass.reviewedAt?.toISOString() ?? null,
    createdAt: pass.createdAt.toISOString(),
  }));

  const today = toDayKey();
  const pending = rows.filter((p) => p.status === "PENDING").length;
  const approved = rows.filter((p) => p.status === "APPROVED").length;
  const rejected = rows.filter((p) => p.status === "REJECTED").length;
  const active = rows.filter((p) => p.status === "APPROVED" && p.date >= today).length;

  return (
    <div>
      <PageHeader
        title="Activity passes"
        description="Request permission to be away from the studio during session hours. An approved request becomes a signed slip with a scannable code you can show at the gate."
      />

      {/* Desktop StatGrid */}
      <div className="hidden md:block">
        <StatGrid>
          <StatTile
            label="Active passes"
            value={active}
            icon="ticket"
            tone={active > 0 ? "green" : "slate"}
            caption="Approved and upcoming"
          />
          <StatTile
            label="Awaiting approval"
            value={pending}
            icon="clock"
            tone={pending > 0 ? "amber" : "slate"}
            caption="Sitting in the mentor queue"
          />
          <StatTile label="Approved (all time)" value={approved} icon="check-circle" tone="blue" />
          <StatTile
            label="Rejected"
            value={rejected}
            icon="alert"
            tone={rejected > 0 ? "red" : "slate"}
            caption={rejected > 0 ? "Read the remark before re-requesting" : "None"}
          />
        </StatGrid>
      </div>

      {/* Mobile-Only Android-Style Compact Metric Bar */}
      <div className="md:hidden grid grid-cols-4 gap-1 rounded-2xl bg-[var(--surface-raised)] border border-[var(--line-default)] p-2.5 shadow-xs">
        <div className="flex flex-col items-center justify-center text-center">
          <span className="text-[10px] font-bold uppercase tracking-wider text-green-500 truncate w-full">Active</span>
          <span className="text-[16px] font-extrabold text-[var(--text-strong)] tabular-nums leading-tight mt-0.5">{active}</span>
          <span className="text-[9.5px] font-medium text-[var(--text-faint)] truncate w-full">Current</span>
        </div>
        <div className="flex flex-col items-center justify-center text-center border-l border-[var(--line-soft)]">
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-500 truncate w-full">Pending</span>
          <span className="text-[16px] font-extrabold text-[var(--text-strong)] tabular-nums leading-tight mt-0.5">{pending}</span>
          <span className="text-[9.5px] font-medium text-[var(--text-faint)] truncate w-full">Review</span>
        </div>
        <div className="flex flex-col items-center justify-center text-center border-l border-[var(--line-soft)]">
          <span className="text-[10px] font-bold uppercase tracking-wider text-blue-500 truncate w-full">Approved</span>
          <span className="text-[16px] font-extrabold text-[var(--text-strong)] tabular-nums leading-tight mt-0.5">{approved}</span>
          <span className="text-[9.5px] font-medium text-[var(--text-faint)] truncate w-full">Total</span>
        </div>
        <div className="flex flex-col items-center justify-center text-center border-l border-[var(--line-soft)]">
          <span className="text-[10px] font-bold uppercase tracking-wider text-rose-500 truncate w-full">Rejected</span>
          <span className="text-[16px] font-extrabold text-[var(--text-strong)] tabular-nums leading-tight mt-0.5">{rejected}</span>
          <span className="text-[9.5px] font-medium text-[var(--text-faint)] truncate w-full">Declined</span>
        </div>
      </div>

      <div className="mt-4 sm:mt-5">
        <PassesClient
          passes={rows}
          holder={{
            name: user.name,
            rollNo: user.rollNo,
            department: user.department,
            year: user.year,
            domain: user.domain,
            mentorName: user.mentorName,
          }}
        />
      </div>
    </div>
  );
}
