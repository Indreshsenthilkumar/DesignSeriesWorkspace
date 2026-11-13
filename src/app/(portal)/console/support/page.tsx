import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/PageHeader";
import { StatTile } from "@/components/ui/StatTile";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdminLike } from "@/lib/permissions";
import { markSectionViewed } from "@/lib/badge-tracking";
import { AdminSupportClient } from "./AdminSupportClient";

export const metadata: Metadata = { title: "Support Operations Console" };
export const dynamic = "force-dynamic";

export default async function ConsoleSupportPage() {
  const user = await requireUser();
  const isAuthorized =
    isAdminLike(user) ||
    user.role === "ADMIN" ||
    user.role === "SUPER_ADMIN" ||
    user.role === "STUDENT_ADMIN" ||
    user.role === "MENTOR";

  if (!isAuthorized) {
    throw new Error("You do not have permission to access the Support Operations Console.");
  }

  await markSectionViewed(user.id, "console_support");

  const [tickets, staffList] = await Promise.all([
    prisma.supportTicket.findMany({
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      include: {
        user: {
          select: {
            id: true,
            name: true,
            rollNo: true,
            email: true,
            department: true,
            year: true,
            domain: true,
            mentorName: true,
            mobile: true,
          },
        },
        assignedTo: { select: { id: true, name: true, role: true, email: true } },
        messages: {
          orderBy: { createdAt: "asc" },
        },
        activities: {
          orderBy: { createdAt: "desc" },
        },
      },
      take: 200,
    }),
    prisma.user.findMany({
      where: {
        role: { in: ["ADMIN", "SUPER_ADMIN", "MENTOR", "STUDENT_ADMIN"] },
        systemStatus: "ACTIVE",
      },
      select: { id: true, name: true, role: true, email: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const total = tickets.length;
  const newCount = tickets.filter((t) => t.status === "NEW").length;
  const inProgress = tickets.filter((t) => t.status === "IN_PROGRESS" || t.status === "ASSIGNED").length;
  const waitingStudent = tickets.filter((t) => t.status === "WAITING_STUDENT").length;
  const resolved = tickets.filter((t) => t.status === "RESOLVED").length;
  const unassigned = tickets.filter((t) => !t.assignedToId && t.status !== "RESOLVED" && t.status !== "CLOSED").length;
  const overdue = tickets.filter(
    (t) => t.status !== "RESOLVED" && t.status !== "CLOSED" && t.slaDueAt && new Date(t.slaDueAt) < new Date()
  ).length;

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

  return (
    <div>
      <PageHeader
        title="Support Operations Console"
        description="Centralized ticket queue, asynchronous communication with students, internal collaboration, SLA monitoring and bulk operations."
      />

      {/* KPI Stat Tiles */}
      <div className="stagger mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatTile
          label="Total Tickets"
          value={total}
          icon="book"
          tone="blue"
          caption="All time volume"
        />
        <StatTile
          label="Unassigned"
          value={unassigned}
          icon="user"
          tone={unassigned > 0 ? "amber" : "slate"}
          caption="Needs team owner"
        />
        <StatTile
          label="In Progress"
          value={inProgress}
          icon="clock"
          tone="blue"
          caption="Active tickets"
        />
        <StatTile
          label="Waiting Student"
          value={waitingStudent}
          icon="mail"
          tone="slate"
          caption="Info requested"
        />
        <StatTile
          label="SLA Overdue"
          value={overdue}
          icon="alert"
          tone={overdue > 0 ? "red" : "green"}
          caption={overdue > 0 ? "Action required" : "100% compliant"}
        />
        <StatTile
          label="Resolved"
          value={resolved}
          icon="check-circle"
          tone="green"
          caption="Completed"
        />
      </div>

      <AdminSupportClient
        currentUser={{
          id: user.id,
          name: user.name,
          role: user.role,
        }}
        initialTickets={serializableTickets}
        staffList={staffList}
      />
    </div>
  );
}
