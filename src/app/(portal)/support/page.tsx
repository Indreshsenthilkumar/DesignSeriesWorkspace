import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/PageHeader";
import { StatGrid, StatTile } from "@/components/ui/StatTile";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { markSectionViewed } from "@/lib/badge-tracking";
import { ensureFaqArticles } from "@/lib/support-seed";
import { SupportClient } from "./SupportClient";

export const metadata: Metadata = { title: "Help & Support" };
export const dynamic = "force-dynamic";

export default async function SupportPage() {
  const user = await requireUser();
  await markSectionViewed(user.id, "support");
  await ensureFaqArticles();

  const [tickets, faqs] = await Promise.all([
    prisma.supportTicket.findMany({
      where: { userId: user.id },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      include: {
        assignedTo: { select: { id: true, name: true, role: true } },
        messages: {
          where: { isInternalNote: false },
          orderBy: { createdAt: "asc" },
        },
        activities: {
          orderBy: { createdAt: "desc" },
        },
      },
    }),
    prisma.faqArticle.findMany({
      orderBy: [{ helpfulCount: "desc" }, { createdAt: "asc" }],
    }),
  ]);

  const total = tickets.length;
  const openCount = tickets.filter((t) => t.status === "NEW" || t.status === "OPEN" || t.status === "ASSIGNED").length;
  const inProgress = tickets.filter((t) => t.status === "IN_PROGRESS").length;
  const waitingStudent = tickets.filter((t) => t.status === "WAITING_STUDENT").length;
  const resolved = tickets.filter((t) => t.status === "RESOLVED").length;

  const serializableTickets = tickets.map((t) => ({
    ...t,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
    slaDueAt: t.slaDueAt?.toISOString() ?? null,
    firstResponseAt: t.firstResponseAt?.toISOString() ?? null,
    resolvedAt: t.resolvedAt?.toISOString() ?? null,
    closedAt: t.closedAt?.toISOString() ?? null,
    reopenedAt: t.reopenedAt?.toISOString() ?? null,
    feedbackAt: t.feedbackAt?.toISOString() ?? null,
    messages: t.messages.map((m) => ({
      ...m,
      createdAt: m.createdAt.toISOString(),
      editedAt: m.editedAt?.toISOString() ?? null,
      readAt: m.readAt?.toISOString() ?? null,
    })),
    activities: t.activities.map((a) => ({
      ...a,
      createdAt: a.createdAt.toISOString(),
    })),
  }));

  const serializableFaqs = faqs.map((f) => ({
    ...f,
    createdAt: f.createdAt.toISOString(),
    updatedAt: f.updatedAt.toISOString(),
  }));

  return (
    <div>
      <PageHeader
        title="Help & Support"
        description="Raise support requests for portal modules, communicate asynchronously with mentors and staff, and find instant answers."
      />

      {/* Desktop StatGrid */}
      <div className="hidden md:block">
        <StatGrid className="sm:grid-cols-3 lg:grid-cols-5">
          <StatTile
            label="Total Requests"
            value={total}
            icon="book"
            tone="blue"
            caption="All time submitted"
          />
          <StatTile
            label="Open / In Review"
            value={openCount}
            icon="clock"
            tone={openCount > 0 ? "amber" : "slate"}
            caption="Awaiting staff action"
          />
          <StatTile
            label="In Progress"
            value={inProgress}
            icon="target"
            tone={inProgress > 0 ? "blue" : "slate"}
            caption="Under investigation"
          />
          <StatTile
            label="Action Required"
            value={waitingStudent}
            icon="alert"
            tone={waitingStudent > 0 ? "red" : "slate"}
            caption="Staff awaiting your reply"
          />
          <StatTile
            label="Resolved"
            value={resolved}
            icon="check-circle"
            tone="green"
            caption="Solutions delivered"
          />
        </StatGrid>
      </div>

      {/* Mobile-Only Android-Style Compact Metric Bar */}
      <div className="md:hidden grid grid-cols-4 gap-1 rounded-2xl bg-[var(--surface-raised)] border border-[var(--line-default)] p-2.5 shadow-xs">
        <div className="flex flex-col items-center justify-center text-center">
          <span className="text-[10px] font-bold uppercase tracking-wider text-blue-500 truncate w-full">Total</span>
          <span className="text-[16px] font-extrabold text-[var(--text-strong)] tabular-nums leading-tight mt-0.5">{total}</span>
          <span className="text-[9.5px] font-medium text-[var(--text-faint)] truncate w-full">Tickets</span>
        </div>
        <div className="flex flex-col items-center justify-center text-center border-l border-[var(--line-soft)]">
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-500 truncate w-full">Review</span>
          <span className="text-[16px] font-extrabold text-[var(--text-strong)] tabular-nums leading-tight mt-0.5">{openCount + inProgress}</span>
          <span className="text-[9.5px] font-medium text-[var(--text-faint)] truncate w-full">In Progress</span>
        </div>
        <div className="flex flex-col items-center justify-center text-center border-l border-[var(--line-soft)]">
          <span className="text-[10px] font-bold uppercase tracking-wider text-rose-500 truncate w-full">Reply</span>
          <span className="text-[16px] font-extrabold text-[var(--text-strong)] tabular-nums leading-tight mt-0.5">{waitingStudent}</span>
          <span className="text-[9.5px] font-medium text-[var(--text-faint)] truncate w-full">Waiting</span>
        </div>
        <div className="flex flex-col items-center justify-center text-center border-l border-[var(--line-soft)]">
          <span className="text-[10px] font-bold uppercase tracking-wider text-green-500 truncate w-full">Resolved</span>
          <span className="text-[16px] font-extrabold text-[var(--text-strong)] tabular-nums leading-tight mt-0.5">{resolved}</span>
          <span className="text-[9.5px] font-medium text-[var(--text-faint)] truncate w-full">Closed</span>
        </div>
      </div>

      <SupportClient
        user={{
          id: user.id,
          name: user.name,
          rollNo: user.rollNo,
          email: user.email,
          department: user.department,
          year: user.year,
          domain: user.domain,
          mentorName: user.mentorName,
        }}
        initialTickets={serializableTickets}
        faqs={serializableFaqs}
      />
    </div>
  );
}
