import type { Metadata } from "next";

import { PageHeader } from "@/components/shell/PageHeader";
import { StatGrid, StatTile } from "@/components/ui/StatTile";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { toDayKey } from "@/lib/dates";
import { markSectionViewed } from "@/lib/badge-tracking";

import { TasksClient, type TaskRow } from "./TasksClient";

export const metadata: Metadata = { title: "Tasks" };
export const dynamic = "force-dynamic";

export default async function TasksPage() {
  const user = await requireUser();
  await markSectionViewed(user.id, "tasks");
  const today = toDayKey();

  const tasks = await prisma.task.findMany({
    where: { assigneeId: user.id },
    orderBy: [{ status: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      priority: true,
      dueDate: true,
      points: true,
      author: { select: { name: true } },
    },
  });

  const rows: TaskRow[] = tasks.map((task) => ({
    id: task.id,
    title: task.title,
    description: task.description,
    status: task.status,
    priority: task.priority,
    dueDate: task.dueDate,
    points: task.points,
    authorName: task.author.name,
  }));

  const done = rows.filter((t) => t.status === "DONE");
  const open = rows.filter((t) => t.status !== "DONE");
  const overdue = open.filter((t) => t.dueDate && t.dueDate < today);
  const earned = done.reduce((sum, t) => sum + t.points, 0);

  return (
    <div>
      <PageHeader
        title="Tasks"
        description="Sprint deliverables assigned by your mentor. Move a task along as you work on it — submitting it puts it in your mentor's review queue, and they close it out."
      />

      {/* Desktop StatGrid */}
      <div className="hidden md:block">
        <StatGrid>
          <StatTile label="Open" value={open.length} icon="target" tone={open.length > 3 ? "amber" : "blue"} caption="Assigned to you" />
          <StatTile
            label="Overdue"
            value={overdue.length}
            icon="alert"
            tone={overdue.length > 0 ? "red" : "green"}
            caption={overdue.length > 0 ? "Past the due date" : "Nothing late"}
          />
          <StatTile label="Completed" value={done.length} icon="check-circle" tone="green" caption="Signed off by a mentor" />
          <StatTile label="Points earned" value={earned} icon="trophy" tone="amber" caption="From completed tasks" />
        </StatGrid>
      </div>

      {/* Mobile-Only Android-Style Compact Metric Bar */}
      <div className="md:hidden grid grid-cols-4 gap-1 rounded-2xl bg-[var(--surface-raised)] border border-[var(--line-default)] p-2.5 shadow-xs">
        <div className="flex flex-col items-center justify-center text-center">
          <span className="text-[10px] font-bold uppercase tracking-wider text-blue-500 truncate w-full">Open</span>
          <span className="text-[16px] font-extrabold text-[var(--text-strong)] tabular-nums leading-tight mt-0.5">{open.length}</span>
          <span className="text-[9.5px] font-medium text-[var(--text-faint)] truncate w-full">Active</span>
        </div>
        <div className="flex flex-col items-center justify-center text-center border-l border-[var(--line-soft)]">
          <span className="text-[10px] font-bold uppercase tracking-wider text-rose-500 truncate w-full">Overdue</span>
          <span className="text-[16px] font-extrabold text-[var(--text-strong)] tabular-nums leading-tight mt-0.5">{overdue.length}</span>
          <span className="text-[9.5px] font-medium text-[var(--text-faint)] truncate w-full">Late</span>
        </div>
        <div className="flex flex-col items-center justify-center text-center border-l border-[var(--line-soft)]">
          <span className="text-[10px] font-bold uppercase tracking-wider text-green-500 truncate w-full">Done</span>
          <span className="text-[16px] font-extrabold text-[var(--text-strong)] tabular-nums leading-tight mt-0.5">{done.length}</span>
          <span className="text-[9.5px] font-medium text-[var(--text-faint)] truncate w-full">Completed</span>
        </div>
        <div className="flex flex-col items-center justify-center text-center border-l border-[var(--line-soft)]">
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-500 truncate w-full">Points</span>
          <span className="text-[16px] font-extrabold text-[var(--text-strong)] tabular-nums leading-tight mt-0.5">{earned}<span className="text-[10px] font-semibold text-[var(--text-muted)] ml-0.5">pts</span></span>
          <span className="text-[9.5px] font-medium text-[var(--text-faint)] truncate w-full">Earned</span>
        </div>
      </div>

      <TasksClient tasks={rows} />
    </div>
  );
}
