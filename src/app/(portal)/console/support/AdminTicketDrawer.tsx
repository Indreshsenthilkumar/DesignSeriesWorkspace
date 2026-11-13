"use client";

import { useState } from "react";
import Link from "next/link";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { StatusBadge, Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import { formatDay, relativeTime } from "@/lib/dates";
import {
  CANNED_RESPONSES,
  CATEGORIES_CONFIG,
  MODULES_CONFIG,
  PRIORITY_CONFIG,
  STATUS_CONFIG,
  type TicketCategory,
  type TicketModule,
  type TicketPriority,
  type TicketStatus,
} from "@/lib/support";

export type AdminTicketDetail = {
  id: string;
  ticketNumber: string;
  userId: string;
  name: string;
  rollNo: string;
  email: string;
  department: string;
  year: string;
  category: string;
  subcategory: string;
  subject: string;
  description: string;
  module: string;
  priority: string;
  status: string;
  assignedToId: string | null;
  firstResponseAt: string | null;
  resolvedAt: string | null;
  closedAt: string | null;
  reopenedAt: string | null;
  slaDueAt: string | null;
  isEscalated: boolean;
  rating: number | null;
  feedback: string | null;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    name: string;
    rollNo: string;
    email: string;
    department: string;
    year: string;
    domain: string;
    mentorName: string;
    mobile: string;
  };
  assignedTo?: { id: string; name: string; role: string; email: string } | null;
  messages: Array<{
    id: string;
    senderId: string;
    senderName: string;
    senderRole: string;
    message: string;
    isInternalNote: boolean;
    isEdited: boolean;
    createdAt: string;
    readAt: string | null;
  }>;
  activities: Array<{
    id: string;
    action: string;
    actorName: string;
    meta: string;
    createdAt: string;
  }>;
};

export function AdminTicketDrawer({
  ticket,
  staffList,
  currentUserId,
  onClose,
  onUpdated,
}: {
  ticket: AdminTicketDetail;
  staffList: Array<{ id: string; name: string; role: string }>;
  currentUserId: string;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const toast = useToast();

  const [messageText, setMessageText] = useState("");
  const [isInternalNote, setIsInternalNote] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [updating, setUpdating] = useState(false);

  const [status, setStatus] = useState<TicketStatus>(ticket.status as TicketStatus);
  const [priority, setPriority] = useState<TicketPriority>(ticket.priority as TicketPriority);
  const [assignedToId, setAssignedToId] = useState<string>(ticket.assignedToId || "");

  const categoryConfig = CATEGORIES_CONFIG[ticket.category as TicketCategory];
  const moduleConfig = MODULES_CONFIG[ticket.module as TicketModule];
  const isOverdue = ticket.slaDueAt && new Date(ticket.slaDueAt) < new Date() && ticket.status !== "RESOLVED" && ticket.status !== "CLOSED";

  // Send reply or internal note
  const handleSendMessage = async () => {
    if (!messageText.trim() || sendingMessage) return;
    setSendingMessage(true);

    try {
      const res = await fetch(`/api/support/tickets/${ticket.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: messageText.trim(),
          isInternalNote,
        }),
      });

      const data = await res.json();
      if (!data.ok) {
        toast.error("Failed to post message", data.error);
        return;
      }

      setMessageText("");
      toast.success(
        isInternalNote ? "Internal Note Saved" : "Reply Sent to Student",
        isInternalNote ? "Visible only to staff." : "Student has been notified."
      );
      onUpdated();
    } catch {
      toast.error("Network error");
    } finally {
      setSendingMessage(false);
    }
  };

  // Update Ticket attributes (Status, Priority, Assignee)
  const handleUpdateAttributes = async (newStatus?: string, newPriority?: string, newAssignee?: string) => {
    setUpdating(true);
    try {
      const res = await fetch(`/api/support/tickets/${ticket.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: newStatus !== undefined ? newStatus : status,
          priority: newPriority !== undefined ? newPriority : priority,
          assignedToId: newAssignee !== undefined ? (newAssignee || null) : (assignedToId || null),
        }),
      });

      const data = await res.json();
      if (!data.ok) {
        toast.error("Update failed", data.error);
        return;
      }

      toast.success("Ticket Updated");
      onUpdated();
    } catch {
      toast.error("Network error");
    } finally {
      setUpdating(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="xl"
      title={`${ticket.ticketNumber} — ${ticket.subject}`}
      description={`${categoryConfig?.label || ticket.category} · Opened by ${ticket.name} (${ticket.rollNo})`}
      footer={
        <div className="flex w-full items-center justify-between">
          <div className="flex items-center gap-2">
            {ticket.status !== "RESOLVED" && ticket.status !== "CLOSED" ? (
              <Button
                size="sm"
                variant="success"
                icon="check"
                loading={updating}
                onClick={() => {
                  setStatus("RESOLVED");
                  handleUpdateAttributes("RESOLVED");
                }}
              >
                Mark as Resolved
              </Button>
            ) : null}
          </div>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      }
    >
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Left Column (2 spans): Conversation & Messages */}
        <div className="flex flex-col gap-3 lg:col-span-2">
          {/* SLA and Status Banner */}
          <div
            className="flex flex-wrap items-center justify-between gap-2 rounded-[10px] border p-2.5 text-[12px]"
            style={{
              background: isOverdue ? "#FEE2E2" : "var(--surface-sunken)",
              borderColor: isOverdue ? "#FCA5A5" : "var(--line-soft)",
            }}
          >
            <div className="flex items-center gap-2">
              <StatusBadge status={ticket.status} />
              <Badge tone={PRIORITY_CONFIG[ticket.priority as TicketPriority]?.tone || "slate"}>
                {ticket.priority} Priority
              </Badge>
              {isOverdue ? (
                <span className="font-bold text-red-700">⚠️ Overdue SLA Target</span>
              ) : ticket.slaDueAt ? (
                <span className="text-[11px] text-[var(--text-faint)]">
                  Target resolution: {formatDay(ticket.slaDueAt.slice(0, 10), "medium")}
                </span>
              ) : null}
            </div>

            <div className="text-[11px] text-[var(--text-faint)]">
              {ticket.firstResponseAt ? (
                <span>First reply {relativeTime(ticket.firstResponseAt)}</span>
              ) : (
                <span className="text-amber-600 font-medium">Awaiting First Response</span>
              )}
            </div>
          </div>

          {/* Conversation Messages */}
          <div
            className="flex max-h-[400px] flex-col gap-3 overflow-y-auto rounded-[12px] border p-3.5"
            style={{ background: "var(--surface-sunken)", borderColor: "var(--line-soft)" }}
          >
            {ticket.messages.map((msg) => {
              const isStaffMsg = msg.senderRole !== "STUDENT";
              const isInternal = msg.isInternalNote;

              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${
                    isInternal
                      ? "items-center"
                      : isStaffMsg
                      ? "items-end"
                      : "items-start"
                  }`}
                >
                  <div className="flex items-center gap-1.5 pb-1 text-[11px]" style={{ color: "var(--text-faint)" }}>
                    <span className="font-semibold" style={{ color: isStaffMsg ? "var(--accent)" : "var(--text-strong)" }}>
                      {msg.senderName}
                    </span>
                    <span>·</span>
                    <span>{relativeTime(msg.createdAt)}</span>
                    {isStaffMsg && !isInternal ? (
                      <span className="rounded bg-blue-100 px-1 text-[9.5px] font-bold text-blue-800">
                        Staff
                      </span>
                    ) : null}
                    {isInternal ? (
                      <span className="rounded bg-amber-100 px-1.5 py-0.2 text-[9.5px] font-bold uppercase text-amber-800">
                        🔒 Internal Note
                      </span>
                    ) : null}
                  </div>

                  <div
                    className={`max-w-[90%] rounded-[14px] px-3.5 py-2.5 text-[12.8px] leading-relaxed shadow-sm ${
                      isInternal
                        ? "w-full border border-amber-300 bg-amber-50 text-amber-950"
                        : isStaffMsg
                        ? "rounded-tr-xs bg-[var(--accent)] text-white"
                        : "rounded-tl-xs border bg-[var(--surface-raised)] text-[var(--text-default)]"
                    }`}
                    style={!isStaffMsg && !isInternal ? { borderColor: "var(--line-default)" } : {}}
                  >
                    <p className="whitespace-pre-wrap">{msg.message}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Reply Box with Public vs Internal Note Toggle */}
          <div className="flex flex-col gap-2 rounded-[12px] border p-3" style={{ borderColor: "var(--line-soft)", background: "var(--surface-raised)" }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-0.5 text-[12px]">
                <button
                  type="button"
                  onClick={() => setIsInternalNote(false)}
                  className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                    !isInternalNote ? "bg-white text-blue-700 shadow-sm" : "text-slate-600"
                  }`}
                >
                  Reply to Student
                </button>
                <button
                  type="button"
                  onClick={() => setIsInternalNote(true)}
                  className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                    isInternalNote ? "bg-amber-100 text-amber-900 shadow-sm" : "text-slate-600"
                  }`}
                >
                  🔒 Private Internal Note
                </button>
              </div>

              {/* Quick Canned responses dropdown */}
              <select
                onChange={(e) => {
                  if (e.target.value) {
                    setMessageText((prev) => (prev ? `${prev}\n${e.target.value}` : e.target.value));
                    e.target.value = "";
                  }
                }}
                className="rounded-md border bg-transparent px-2 py-1 text-[11px] text-[var(--text-muted)] focus:outline-none"
              >
                <option value="">Insert Template…</option>
                {CANNED_RESPONSES.map((r, i) => (
                  <option key={i} value={r.text}>
                    {r.title}
                  </option>
                ))}
              </select>
            </div>

            <textarea
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              placeholder={
                isInternalNote
                  ? "Write private internal note visible ONLY to administrators and mentors…"
                  : "Type your public reply to the student…"
              }
              rows={3}
              className={`w-full rounded-[8px] border p-2.5 text-[12.8px] focus:outline-none focus:ring-2 ${
                isInternalNote ? "border-amber-300 bg-amber-50/50" : "bg-white"
              }`}
              style={{ borderColor: isInternalNote ? undefined : "var(--line-default)" }}
            />

            <div className="flex items-center justify-between">
              <span className="text-[11px]" style={{ color: "var(--text-faint)" }}>
                {isInternalNote ? "Hidden from students." : "Student receives in-app notification."}
              </span>
              <Button
                size="sm"
                variant={isInternalNote ? "secondary" : "primary"}
                icon={isInternalNote ? "lock" : "arrow-right"}
                loading={sendingMessage}
                disabled={!messageText.trim()}
                onClick={handleSendMessage}
              >
                {isInternalNote ? "Add Note" : "Send Reply"}
              </Button>
            </div>
          </div>
        </div>

        {/* Right Column: Student Details & Operations Controls */}
        <div className="flex flex-col gap-3">
          {/* Student Profile Card */}
          <div
            className="rounded-[12px] border p-3.5 text-[12px]"
            style={{ background: "var(--surface-sunken)", borderColor: "var(--line-soft)" }}
          >
            <div className="flex items-center justify-between pb-2 border-b border-[var(--line-soft)]">
              <h4 className="font-semibold text-[13px] text-[var(--text-strong)]">Student Details</h4>
              <Link
                href={`/console/people/${ticket.user.id}`}
                target="_blank"
                className="text-[11px] font-medium text-[var(--accent)] hover:underline"
              >
                Profile ↗
              </Link>
            </div>

            <div className="mt-2.5 flex flex-col gap-1.5 text-[11.5px]">
              <div>
                <span className="text-[10px] uppercase font-bold text-[var(--text-faint)]">Name: </span>
                <span className="font-semibold text-[var(--text-strong)]">{ticket.user.name}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-[var(--text-faint)]">Roll No: </span>
                <span className="font-mono text-[var(--text-default)]">{ticket.user.rollNo}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-[var(--text-faint)]">Dept & Year: </span>
                <span className="text-[var(--text-default)]">{ticket.user.department} ({ticket.user.year})</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-[var(--text-faint)]">Domain: </span>
                <span className="text-[var(--text-default)]">{ticket.user.domain}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-[var(--text-faint)]">Mentor: </span>
                <span className="text-[var(--text-default)]">{ticket.user.mentorName || "Unassigned"}</span>
              </div>
            </div>

            {/* Contextual Link to Existing Module */}
            <div className="mt-3 border-t border-[var(--line-soft)] pt-2.5">
              <span className="text-[10.5px] uppercase font-bold text-[var(--text-faint)]">Related Module:</span>
              <div className="mt-1 flex items-center justify-between">
                <Badge tone="blue">{moduleConfig?.label || ticket.module}</Badge>
                {ticket.module === "ATTENDANCE" ? (
                  <Link
                    href={`/console/attendance?search=${ticket.user.rollNo}`}
                    target="_blank"
                    className="text-[11px] font-semibold text-[var(--accent)] hover:underline"
                  >
                    View Attendance ↗
                  </Link>
                ) : ticket.module === "WORKLOG" ? (
                  <Link
                    href={`/console/worklogs?search=${ticket.user.rollNo}`}
                    target="_blank"
                    className="text-[11px] font-semibold text-[var(--accent)] hover:underline"
                  >
                    View Worklogs ↗
                  </Link>
                ) : null}
              </div>
            </div>
          </div>

          {/* Ticket Management Controls */}
          <div
            className="flex flex-col gap-3 rounded-[12px] border p-3.5 text-[12px]"
            style={{ background: "var(--surface-raised)", borderColor: "var(--line-soft)" }}
          >
            <h4 className="font-semibold text-[13px] text-[var(--text-strong)]">Operational Controls</h4>

            {/* Status Selector */}
            <div>
              <label className="text-[10.5px] font-bold uppercase tracking-wider text-[var(--text-faint)]">
                Workflow Status
              </label>
              <select
                value={status}
                onChange={(e) => {
                  const s = e.target.value as TicketStatus;
                  setStatus(s);
                  handleUpdateAttributes(s);
                }}
                className="mt-1 h-8 w-full rounded-[6px] border bg-transparent px-2 text-[12px] focus:outline-none"
                style={{ borderColor: "var(--line-default)" }}
              >
                <option value="NEW">New (Unreviewed)</option>
                <option value="OPEN">Open (Acknowledged)</option>
                <option value="ASSIGNED">Assigned</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="WAITING_STUDENT">Waiting for Student</option>
                <option value="RESOLVED">Resolved</option>
                <option value="CLOSED">Closed</option>
              </select>
            </div>

            {/* Assignee Selector */}
            <div>
              <label className="text-[10.5px] font-bold uppercase tracking-wider text-[var(--text-faint)]">
                Assigned Team Member
              </label>
              <select
                value={assignedToId}
                onChange={(e) => {
                  const val = e.target.value;
                  setAssignedToId(val);
                  handleUpdateAttributes(undefined, undefined, val);
                }}
                className="mt-1 h-8 w-full rounded-[6px] border bg-transparent px-2 text-[12px] focus:outline-none"
                style={{ borderColor: "var(--line-default)" }}
              >
                <option value="">Unassigned</option>
                {staffList.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.role})
                  </option>
                ))}
              </select>
            </div>

            {/* Priority Selector */}
            <div>
              <label className="text-[10.5px] font-bold uppercase tracking-wider text-[var(--text-faint)]">
                Priority Tier
              </label>
              <select
                value={priority}
                onChange={(e) => {
                  const p = e.target.value as TicketPriority;
                  setPriority(p);
                  handleUpdateAttributes(undefined, p);
                }}
                className="mt-1 h-8 w-full rounded-[6px] border bg-transparent px-2 text-[12px] focus:outline-none"
                style={{ borderColor: "var(--line-default)" }}
              >
                <option value="LOW">Low (96h resolution)</option>
                <option value="MEDIUM">Medium (72h resolution)</option>
                <option value="HIGH">High (36h resolution)</option>
                <option value="CRITICAL">Critical (24h resolution)</option>
              </select>
            </div>
          </div>

          {/* Satisfaction Rating if resolved */}
          {ticket.rating ? (
            <div
              className="rounded-[10px] border p-3 text-[12px]"
              style={{ background: "var(--surface-sunken)", borderColor: "var(--line-soft)" }}
            >
              <p className="font-semibold text-emerald-800">Student Satisfaction</p>
              <div className="mt-1 flex items-center gap-1 text-amber-500">
                {"★".repeat(ticket.rating)}
                {"☆".repeat(5 - ticket.rating)}
                <span className="ml-1 text-[11px] text-[var(--text-muted)]">({ticket.rating}/5)</span>
              </div>
              {ticket.feedback ? (
                <p className="mt-1 text-[11.5px] text-[var(--text-default)] italic">"{ticket.feedback}"</p>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </Modal>
  );
}
