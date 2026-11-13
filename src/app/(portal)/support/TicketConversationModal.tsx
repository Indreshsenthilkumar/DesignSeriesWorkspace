"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { StatusBadge, Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import { formatDay, relativeTime } from "@/lib/dates";
import { CATEGORIES_CONFIG, MODULES_CONFIG, PRIORITY_CONFIG, STATUS_CONFIG, type TicketCategory, type TicketModule, type TicketPriority, type TicketStatus } from "@/lib/support";

export type TicketDetail = {
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
  assignedTo?: { id: string; name: string; role: string } | null;
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

export function TicketConversationModal({
  ticket,
  currentUserId,
  onClose,
  onTicketUpdated,
}: {
  ticket: TicketDetail;
  currentUserId: string;
  onClose: () => void;
  onTicketUpdated: () => void;
}) {
  const toast = useToast();
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [reopening, setReopening] = useState(false);
  const [reopenReason, setReopenReason] = useState("");
  const [rating, setRating] = useState<number>(ticket.rating || 5);
  const [feedback, setFeedback] = useState<string>(ticket.feedback || "");
  const [submittingFeedback, setSubmittingFeedback] = useState(false);

  const categoryConfig = CATEGORIES_CONFIG[ticket.category as TicketCategory];
  const moduleConfig = MODULES_CONFIG[ticket.module as TicketModule];
  const priorityConfig = PRIORITY_CONFIG[ticket.priority as TicketPriority];
  const statusConfig = STATUS_CONFIG[ticket.status as TicketStatus];

  const isResolvedOrClosed = ticket.status === "RESOLVED" || ticket.status === "CLOSED";

  // Send message
  const handleSendMessage = async () => {
    if (!replyText.trim() || sending) return;
    setSending(true);

    try {
      const res = await fetch(`/api/support/tickets/${ticket.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: replyText.trim() }),
      });
      const data = await res.json();
      if (!data.ok) {
        toast.error("Failed to send reply", data.error);
        return;
      }
      setReplyText("");
      toast.success("Reply sent", "Staff has been notified.");
      onTicketUpdated();
    } catch {
      toast.error("Network error");
    } finally {
      setSending(false);
    }
  };

  // Reopen ticket
  const handleReopen = async () => {
    if (!reopenReason.trim() || sending) return;
    setSending(true);

    try {
      const res = await fetch(`/api/support/tickets/${ticket.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "OPEN", reopenReason: reopenReason.trim() }),
      });
      const data = await res.json();
      if (!data.ok) {
        toast.error("Could not reopen ticket", data.error);
        return;
      }
      setReopening(false);
      setReopenReason("");
      toast.success("Request Reopened", "Your ticket has been sent back to the queue.");
      onTicketUpdated();
    } catch {
      toast.error("Network error");
    } finally {
      setSending(false);
    }
  };

  // Submit satisfaction feedback
  const handleFeedback = async () => {
    setSubmittingFeedback(true);
    try {
      const res = await fetch(`/api/support/tickets/${ticket.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, feedback }),
      });
      const data = await res.json();
      if (!data.ok) {
        toast.error("Feedback error", data.error);
        return;
      }
      toast.success("Thank you for your feedback!");
      onTicketUpdated();
    } catch {
      toast.error("Network error");
    } finally {
      setSubmittingFeedback(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="xl"
      title={`${ticket.ticketNumber} — ${ticket.subject}`}
      description={`Category: ${categoryConfig?.label || ticket.category} · Module: ${moduleConfig?.label || ticket.module}`}
      footer={
        <div className="flex w-full items-center justify-between">
          <div className="flex items-center gap-2">
            {isResolvedOrClosed ? (
              <Button
                size="sm"
                variant="secondary"
                icon="refresh"
                onClick={() => setReopening(true)}
              >
                Reopen Request
              </Button>
            ) : null}
          </div>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        {/* Header Metadata Chips */}
        <div
          className="flex flex-wrap items-center justify-between gap-2.5 rounded-[12px] border p-3"
          style={{ background: "var(--surface-sunken)", borderColor: "var(--line-soft)" }}
        >
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={ticket.status} />
            <Badge tone={priorityConfig?.tone || "slate"}>
              Priority: {priorityConfig?.label || ticket.priority}
            </Badge>
            {ticket.subcategory ? (
              <Badge tone="slate">{ticket.subcategory}</Badge>
            ) : null}
          </div>

          <div className="flex items-center gap-2 text-[11px]" style={{ color: "var(--text-faint)" }}>
            <Icon name="clock" className="h-3.5 w-3.5" />
            <span>Opened {formatDay(ticket.createdAt.slice(0, 10), "medium")}</span>
            {ticket.assignedTo ? (
              <span className="font-medium text-emerald-600">· Assigned to {ticket.assignedTo.name}</span>
            ) : (
              <span className="text-amber-600">· Pending Assignment</span>
            )}
          </div>
        </div>

        {/* Reopen Drawer if toggled */}
        {reopening ? (
          <div
            className="rounded-[12px] border p-3.5"
            style={{ background: "var(--tone-soft)", borderColor: "var(--line-default)" }}
            data-accent="amber"
          >
            <h4 className="text-[13px] font-semibold text-amber-800">Reopen Request</h4>
            <p className="mt-0.5 text-[11.5px] text-amber-700">
              Please explain why the resolution was not satisfactory or what remains unaddressed.
            </p>
            <textarea
              value={reopenReason}
              onChange={(e) => setReopenReason(e.target.value)}
              placeholder="e.g. My attendance hours for slot 4 are still missing..."
              rows={2}
              className="mt-2 w-full rounded-[8px] border bg-white p-2.5 text-[12.5px] focus:outline-none"
              style={{ borderColor: "var(--line-default)" }}
            />
            <div className="mt-2 flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => setReopening(false)}>
                Cancel
              </Button>
              <Button size="sm" variant="primary" loading={sending} onClick={handleReopen}>
                Submit Reopen
              </Button>
            </div>
          </div>
        ) : null}

        {/* Satisfaction Rating Form if Resolved */}
        {ticket.status === "RESOLVED" && !ticket.rating ? (
          <div
            className="rounded-[12px] border p-3.5"
            style={{ background: "var(--tone-soft)", borderColor: "var(--line-default)" }}
            data-accent="green"
          >
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-[13px] font-semibold text-emerald-900">How was your support experience?</h4>
                <p className="text-[11.5px] text-emerald-800">Your feedback helps improve resolution quality.</p>
              </div>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    className="text-[18px] transition-transform hover:scale-125"
                  >
                    {star <= rating ? "★" : "☆"}
                  </button>
                ))}
              </div>
            </div>
            <input
              type="text"
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Optional comments on how we can improve..."
              className="mt-2.5 w-full rounded-[8px] border bg-white px-3 py-1.5 text-[12px] focus:outline-none"
              style={{ borderColor: "var(--line-default)" }}
            />
            <div className="mt-2 flex justify-end">
              <Button size="sm" variant="success" loading={submittingFeedback} onClick={handleFeedback}>
                Submit Rating
              </Button>
            </div>
          </div>
        ) : null}

        {/* Conversation Thread */}
        <div className="flex flex-col gap-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.08em]" style={{ color: "var(--text-faint)" }}>
            Conversation History ({ticket.messages.length} messages)
          </p>

          <div
            className="flex max-h-[380px] flex-col gap-3 overflow-y-auto rounded-[12px] border p-3.5"
            style={{ background: "var(--surface-sunken)", borderColor: "var(--line-soft)" }}
          >
            {ticket.messages.map((msg, i) => {
              const isMe = msg.senderId === currentUserId;

              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
                >
                  <div className="flex items-center gap-1.5 pb-1 text-[11px]" style={{ color: "var(--text-faint)" }}>
                    <span className="font-semibold" style={{ color: isMe ? "var(--text-strong)" : "var(--accent)" }}>
                      {msg.senderName}
                    </span>
                    <span>·</span>
                    <span>{relativeTime(msg.createdAt)}</span>
                    {!isMe && msg.senderRole !== "STUDENT" ? (
                      <span className="rounded bg-blue-100 px-1 py-0.2 text-[9.5px] font-bold uppercase text-blue-800">
                        Staff
                      </span>
                    ) : null}
                  </div>

                  <div
                    className={`max-w-[85%] rounded-[14px] px-3.5 py-2.5 text-[12.8px] leading-relaxed shadow-sm ${
                      isMe
                        ? "rounded-tr-xs bg-[var(--accent)] text-white"
                        : "rounded-tl-xs border bg-[var(--surface-raised)] text-[var(--text-default)]"
                    }`}
                    style={!isMe ? { borderColor: "var(--line-default)" } : {}}
                  >
                    <p className="whitespace-pre-wrap">{msg.message}</p>
                  </div>

                  {isMe ? (
                    <span className="mt-0.5 text-[10px]" style={{ color: "var(--text-faint)" }}>
                      {msg.readAt ? `Read ${relativeTime(msg.readAt)}` : "Sent"}
                    </span>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>

        {/* Reply Box (Active when not closed) */}
        {!isResolvedOrClosed ? (
          <div className="flex flex-col gap-2">
            <div className="relative">
              <textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Type your reply here… (Press Shift+Enter for newline)"
                rows={3}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                className="w-full rounded-[10px] border p-3 text-[13px] focus:outline-none focus:ring-2"
                style={{
                  background: "var(--surface-raised)",
                  borderColor: "var(--line-default)",
                  color: "var(--text-default)",
                }}
              />
            </div>

            <div className="flex items-center justify-between text-[11.5px]" style={{ color: "var(--text-faint)" }}>
              <span>Messages are saved securely and delivered asynchronously to support mentors.</span>
              <Button
                size="sm"
                variant="primary"
                icon="arrow-right"
                loading={sending}
                disabled={!replyText.trim()}
                onClick={handleSendMessage}
              >
                Send Reply
              </Button>
            </div>
          </div>
        ) : (
          <div
            className="flex items-center justify-between rounded-[10px] border p-3 text-[12.5px]"
            style={{ background: "var(--surface-sunken)", borderColor: "var(--line-soft)", color: "var(--text-muted)" }}
          >
            <span>This ticket is {ticket.status.toLowerCase()}. You can reopen it if you require further assistance.</span>
          </div>
        )}
      </div>
    </Modal>
  );
}
