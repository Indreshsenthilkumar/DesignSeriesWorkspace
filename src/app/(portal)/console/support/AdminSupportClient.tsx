"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatusBadge, Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import { formatDay, relativeTime } from "@/lib/dates";
import {
  CATEGORIES_CONFIG,
  MODULES_CONFIG,
  PRIORITY_CONFIG,
  type TicketCategory,
  type TicketModule,
  type TicketPriority,
  type TicketStatus,
} from "@/lib/support";
import { AdminTicketDrawer, type AdminTicketDetail } from "./AdminTicketDrawer";

export function AdminSupportClient({
  currentUser,
  initialTickets,
  staffList,
}: {
  currentUser: { id: string; name: string; role: string };
  initialTickets: any[];
  staffList: Array<{ id: string; name: string; role: string }>;
}) {
  const router = useRouter();
  const toast = useToast();

  const [activeTab, setActiveTab] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [priorityFilter, setPriorityFilter] = useState("ALL");
  const [assigneeFilter, setAssigneeFilter] = useState("ALL");

  // Selection for bulk actions
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkActionBusy, setBulkActionBusy] = useState(false);

  // Selected ticket for modal
  const [activeTicketId, setActiveTicketId] = useState<string | null>(null);

  const activeTicket = useMemo(() => {
    if (!activeTicketId) return null;
    return (initialTickets.find((t) => t.id === activeTicketId) as AdminTicketDetail) || null;
  }, [activeTicketId, initialTickets]);

  // Tab counts
  const tabCounts = useMemo(() => {
    const now = new Date();
    return {
      ALL: initialTickets.length,
      UNASSIGNED: initialTickets.filter((t) => !t.assignedToId && t.status !== "RESOLVED" && t.status !== "CLOSED").length,
      IN_PROGRESS: initialTickets.filter((t) => t.status === "IN_PROGRESS" || t.status === "ASSIGNED").length,
      WAITING_STUDENT: initialTickets.filter((t) => t.status === "WAITING_STUDENT").length,
      OVERDUE: initialTickets.filter(
        (t) => t.status !== "RESOLVED" && t.status !== "CLOSED" && t.slaDueAt && new Date(t.slaDueAt) < now
      ).length,
      RESOLVED: initialTickets.filter((t) => t.status === "RESOLVED" || t.status === "CLOSED").length,
    };
  }, [initialTickets]);

  // Filtered tickets
  const filteredTickets = useMemo(() => {
    const now = new Date();

    return initialTickets.filter((t) => {
      // Tab filter
      if (activeTab === "UNASSIGNED" && (t.assignedToId || t.status === "RESOLVED" || t.status === "CLOSED")) return false;
      if (activeTab === "IN_PROGRESS" && t.status !== "IN_PROGRESS" && t.status !== "ASSIGNED") return false;
      if (activeTab === "WAITING_STUDENT" && t.status !== "WAITING_STUDENT") return false;
      if (activeTab === "OVERDUE" && (t.status === "RESOLVED" || t.status === "CLOSED" || !t.slaDueAt || new Date(t.slaDueAt) >= now)) return false;
      if (activeTab === "RESOLVED" && t.status !== "RESOLVED" && t.status !== "CLOSED") return false;

      // Category filter
      if (categoryFilter !== "ALL" && t.category !== categoryFilter) return false;

      // Priority filter
      if (priorityFilter !== "ALL" && t.priority !== priorityFilter) return false;

      // Assignee filter
      if (assigneeFilter === "ME" && t.assignedToId !== currentUser.id) return false;
      if (assigneeFilter === "UNASSIGNED" && t.assignedToId) return false;
      if (assigneeFilter !== "ALL" && assigneeFilter !== "ME" && assigneeFilter !== "UNASSIGNED" && t.assignedToId !== assigneeFilter) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const hay = `${t.ticketNumber} ${t.subject} ${t.name} ${t.rollNo} ${t.department}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }

      return true;
    });
  }, [initialTickets, activeTab, categoryFilter, priorityFilter, assigneeFilter, searchQuery, currentUser.id]);

  // Bulk Actions
  const handleBulkStatus = async (status: string) => {
    if (selectedIds.length === 0 || bulkActionBusy) return;
    setBulkActionBusy(true);

    try {
      const res = await fetch("/api/support/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticketIds: selectedIds,
          action: "STATUS_UPDATE",
          status,
        }),
      });

      const data = await res.json();
      if (!data.ok) {
        toast.error("Bulk action failed", data.error);
        return;
      }

      toast.success(`Updated ${selectedIds.length} tickets to ${status}`);
      setSelectedIds([]);
      router.refresh();
    } catch {
      toast.error("Network problem");
    } finally {
      setBulkActionBusy(false);
    }
  };

  const handleBulkAssign = async (assigneeId: string) => {
    if (selectedIds.length === 0 || bulkActionBusy) return;
    setBulkActionBusy(true);

    try {
      const res = await fetch("/api/support/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticketIds: selectedIds,
          action: "ASSIGN",
          assignedToId: assigneeId || null,
        }),
      });

      const data = await res.json();
      if (!data.ok) {
        toast.error("Bulk assign failed", data.error);
        return;
      }

      toast.success(`Reassigned ${selectedIds.length} tickets`);
      setSelectedIds([]);
      router.refresh();
    } catch {
      toast.error("Network problem");
    } finally {
      setBulkActionBusy(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredTickets.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredTickets.map((t) => t.id));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  return (
    <>
      <div className="flex flex-col gap-4">
        {/* Status Queue Tabs */}
        <div
          className="flex flex-wrap items-center gap-1 rounded-[12px] p-1.5"
          style={{ background: "var(--surface-sunken)", border: "1px solid var(--line-soft)" }}
        >
          <TabButton
            active={activeTab === "ALL"}
            onClick={() => setActiveTab("ALL")}
            label="All Tickets"
            count={tabCounts.ALL}
          />
          <TabButton
            active={activeTab === "UNASSIGNED"}
            onClick={() => setActiveTab("UNASSIGNED")}
            label="Unassigned"
            count={tabCounts.UNASSIGNED}
            alert={tabCounts.UNASSIGNED > 0}
          />
          <TabButton
            active={activeTab === "IN_PROGRESS"}
            onClick={() => setActiveTab("IN_PROGRESS")}
            label="In Progress"
            count={tabCounts.IN_PROGRESS}
          />
          <TabButton
            active={activeTab === "WAITING_STUDENT"}
            onClick={() => setActiveTab("WAITING_STUDENT")}
            label="Waiting for Student"
            count={tabCounts.WAITING_STUDENT}
          />
          <TabButton
            active={activeTab === "OVERDUE"}
            onClick={() => setActiveTab("OVERDUE")}
            label="SLA Overdue"
            count={tabCounts.OVERDUE}
            alert={tabCounts.OVERDUE > 0}
          />
          <TabButton
            active={activeTab === "RESOLVED"}
            onClick={() => setActiveTab("RESOLVED")}
            label="Resolved / Closed"
            count={tabCounts.RESOLVED}
          />
        </div>

        {/* Search & Multi-Filters Card */}
        <Card>
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            <div className="relative">
              <span
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
                style={{ color: "var(--text-faint)" }}
              >
                <Icon name="search" className="h-3.5 w-3.5" />
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search ticket, roll no, or student…"
                className="h-9 w-full rounded-[8px] border pl-8 pr-3 text-[12.5px] focus:outline-none"
                style={{
                  borderColor: "var(--line-default)",
                  background: "var(--surface-sunken)",
                  color: "var(--text-default)",
                }}
              />
            </div>

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="h-9 w-full rounded-[8px] border px-3 text-[12.5px] focus:outline-none"
              style={{
                borderColor: "var(--line-default)",
                background: "var(--surface-sunken)",
                color: "var(--text-default)",
              }}
            >
              <option value="ALL">All Categories</option>
              {(Object.keys(CATEGORIES_CONFIG) as TicketCategory[]).map((cat) => (
                <option key={cat} value={cat}>
                  {CATEGORIES_CONFIG[cat].label}
                </option>
              ))}
            </select>

            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="h-9 w-full rounded-[8px] border px-3 text-[12.5px] focus:outline-none"
              style={{
                borderColor: "var(--line-default)",
                background: "var(--surface-sunken)",
                color: "var(--text-default)",
              }}
            >
              <option value="ALL">All Priorities</option>
              <option value="CRITICAL">Critical</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>

            <select
              value={assigneeFilter}
              onChange={(e) => setAssigneeFilter(e.target.value)}
              className="h-9 w-full rounded-[8px] border px-3 text-[12.5px] focus:outline-none"
              style={{
                borderColor: "var(--line-default)",
                background: "var(--surface-sunken)",
                color: "var(--text-default)",
              }}
            >
              <option value="ALL">All Assignees</option>
              <option value="ME">Assigned to Me</option>
              <option value="UNASSIGNED">Unassigned Only</option>
              {staffList.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        </Card>

        {/* Bulk Action Toolbar if items selected */}
        {selectedIds.length > 0 ? (
          <div
            className="flex flex-wrap items-center justify-between gap-3 rounded-[12px] border p-3 shadow-sm animate-fade"
            style={{ background: "#EFF6FF", borderColor: "#BFDBFE" }}
          >
            <div className="flex items-center gap-2 text-[13px] font-semibold text-blue-900">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-[11px] text-white">
                {selectedIds.length}
              </span>
              <span>Tickets Selected</span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant="secondary"
                disabled={bulkActionBusy}
                onClick={() => handleBulkStatus("IN_PROGRESS")}
              >
                Mark In Progress
              </Button>
              <Button
                size="sm"
                variant="success"
                disabled={bulkActionBusy}
                onClick={() => handleBulkStatus("RESOLVED")}
              >
                Mark Resolved
              </Button>
              <select
                onChange={(e) => {
                  if (e.target.value) handleBulkAssign(e.target.value);
                  e.target.value = "";
                }}
                disabled={bulkActionBusy}
                className="h-8 rounded-[6px] border border-blue-300 bg-white px-2.5 text-[12px] font-medium text-blue-900 focus:outline-none"
              >
                <option value="">Assign To…</option>
                <option value={currentUser.id}>Assign to Me</option>
                {staffList.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSelectedIds([])}
              >
                Deselect
              </Button>
            </div>
          </div>
        ) : null}

        {/* Ticket List Table */}
        <Card>
          <div className="flex items-center justify-between pb-3">
            <span className="text-[12.5px] font-medium" style={{ color: "var(--text-muted)" }}>
              Showing {filteredTickets.length} of {initialTickets.length} support requests
            </span>
            {filteredTickets.length > 0 ? (
              <button
                type="button"
                onClick={toggleSelectAll}
                className="text-[12px] font-semibold text-[var(--accent)] hover:underline"
              >
                {selectedIds.length === filteredTickets.length ? "Deselect All" : "Select All"}
              </button>
            ) : null}
          </div>

          {filteredTickets.length === 0 ? (
            <EmptyState
              title="No tickets in this queue"
              description="No support requests match your selected tab and search criteria."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-[12.5px]">
                <thead>
                  <tr
                    className="border-b text-[10.5px] font-bold uppercase tracking-[0.08em]"
                    style={{ borderColor: "var(--line-soft)", color: "var(--text-faint)" }}
                  >
                    <th className="py-2.5 pl-2 pr-3 w-8">
                      <input
                        type="checkbox"
                        checked={selectedIds.length > 0 && selectedIds.length === filteredTickets.length}
                        onChange={toggleSelectAll}
                        className="rounded"
                      />
                    </th>
                    <th className="py-2.5 px-3">Ticket ID</th>
                    <th className="py-2.5 px-3">Student</th>
                    <th className="py-2.5 px-3">Category & Subject</th>
                    <th className="py-2.5 px-3">Priority</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Assignee</th>
                    <th className="py-2.5 px-3 text-right">Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTickets.map((t, idx) => {
                    const isSelected = selectedIds.includes(t.id);
                    const priConfig = PRIORITY_CONFIG[t.priority as TicketPriority];
                    const catConfig = CATEGORIES_CONFIG[t.category as TicketCategory];
                    const isOverdue = t.slaDueAt && new Date(t.slaDueAt) < new Date() && t.status !== "RESOLVED" && t.status !== "CLOSED";

                    return (
                      <tr
                        key={t.id}
                        className="group border-b transition-colors hover:bg-[var(--surface-hover)] cursor-pointer"
                        style={{
                          borderColor: "var(--line-soft)",
                          background: isSelected ? "#F0F7FF" : idx % 2 === 0 ? "var(--surface-raised)" : "var(--surface-sunken)",
                        }}
                        onClick={() => setActiveTicketId(t.id)}
                      >
                        <td
                          className="py-3 pl-2 pr-3"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleSelect(t.id);
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelect(t.id)}
                            className="rounded"
                          />
                        </td>

                        <td className="py-3 px-3 font-mono font-bold text-[var(--accent)]">
                          {t.ticketNumber}
                        </td>

                        <td className="py-3 px-3">
                          <div className="flex flex-col">
                            <span className="font-semibold text-[var(--text-strong)]">{t.name}</span>
                            <span className="font-mono text-[10.5px] text-[var(--text-faint)]">{t.rollNo}</span>
                          </div>
                        </td>

                        <td className="py-3 px-3 max-w-[280px]">
                          <div className="flex flex-col">
                            <span className="truncate font-medium text-[var(--text-strong)]">{t.subject}</span>
                            <span className="truncate text-[10.5px] text-[var(--text-faint)]">
                              {catConfig?.label || t.category} · {t.module}
                            </span>
                          </div>
                        </td>

                        <td className="py-3 px-3">
                          <Badge tone={priConfig?.tone || "slate"}>
                            {priConfig?.label || t.priority}
                          </Badge>
                        </td>

                        <td className="py-3 px-3">
                          <div className="flex items-center gap-1.5">
                            <StatusBadge status={t.status} />
                            {isOverdue ? (
                              <span
                                className="rounded px-1.5 py-0.2 text-[9px] font-bold text-red-700 bg-red-100"
                                title="SLA Overdue"
                              >
                                OVERDUE
                              </span>
                            ) : null}
                          </div>
                        </td>

                        <td className="py-3 px-3 text-[12px]">
                          {t.assignedTo ? (
                            <span className="font-medium text-emerald-700">{t.assignedTo.name}</span>
                          ) : (
                            <span className="text-amber-600 font-medium">Unassigned</span>
                          )}
                        </td>

                        <td className="py-3 px-3 text-right text-[11px] text-[var(--text-faint)]">
                          {relativeTime(t.updatedAt)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {/* Ticket Drawer */}
      {activeTicket ? (
        <AdminTicketDrawer
          ticket={activeTicket}
          staffList={staffList}
          currentUserId={currentUser.id}
          onClose={() => setActiveTicketId(null)}
          onUpdated={() => router.refresh()}
        />
      ) : null}
    </>
  );
}

function TabButton({
  active,
  onClick,
  label,
  count,
  alert = false,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  alert?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className="flex items-center gap-1.5 rounded-[8px] px-3 py-1.5 text-[12.5px] font-medium transition-all"
      style={{
        background: active ? "var(--surface-raised)" : "transparent",
        color: active ? "var(--text-strong)" : "var(--text-muted)",
        boxShadow: active ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
      }}
    >
      <span>{label}</span>
      <span
        className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
          alert && count > 0 ? "bg-red-500 text-white" : "bg-slate-200 text-slate-700"
        }`}
      >
        {count}
      </span>
    </button>
  );
}
