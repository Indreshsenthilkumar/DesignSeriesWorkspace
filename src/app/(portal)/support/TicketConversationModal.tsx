"use client";

import { useEffect, useRef, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import { formatDay, relativeTime } from "@/lib/dates";
import { CATEGORIES_CONFIG, type TicketCategory } from "@/lib/support";

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

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const categoryConfig = CATEGORIES_CONFIG[ticket.category as TicketCategory];
  const isResolvedOrClosed = ticket.status === "RESOLVED" || ticket.status === "CLOSED";

  // Auto scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [ticket.messages]);

  // Send message
  const handleSendMessage = async () => {
    if (!replyText.trim() || sending) return;
    const textToSend = replyText.trim();
    setSending(true);

    try {
      const res = await fetch(`/api/support/tickets/${ticket.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: textToSend }),
      });
      const data = await res.json();
      if (!data.ok) {
        toast.error("Failed to send message", data.error);
        return;
      }
      setReplyText("");
      onTicketUpdated();
    } catch {
      toast.error("Network error", "Please check your connection.");
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
      toast.success("Ticket Reopened", "Your ticket has been reopened for mentor review.");
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
      toast.success("Thank you!", "Your feedback has been saved.");
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
      size="lg"
      title={`${ticket.ticketNumber} · ${ticket.subject}`}
      description={categoryConfig?.label || ticket.category}
      footer={
        <div className="flex w-full items-center justify-between">
          <div className="flex items-center gap-2">
            <StatusBadge status={ticket.status} />
            {ticket.assignedTo ? (
              <span className="text-[12px] font-medium text-emerald-700 dark:text-emerald-400">
                Mentor: {ticket.assignedTo.name}
              </span>
            ) : (
              <span className="text-[12px] text-amber-600 dark:text-amber-400">
                Pending Mentor Assignment
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isResolvedOrClosed && !reopening ? (
              <Button
                size="sm"
                variant="secondary"
                icon="refresh"
                onClick={() => setReopening(true)}
              >
                Reopen
              </Button>
            ) : null}
            <Button variant="secondary" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        {/* Reopen Drawer if toggled */}
        {reopening ? (
          <div
            className="rounded-[12px] border p-3"
            style={{ background: "#FEF3C7", borderColor: "#FCD34D" }}
          >
            <h4 className="text-[13px] font-bold text-amber-900">Reopen Support Ticket</h4>
            <p className="mt-0.5 text-[11.5px] text-amber-800">
              Please explain what issue remains unresolved.
            </p>
            <textarea
              value={reopenReason}
              onChange={(e) => setReopenReason(e.target.value)}
              placeholder="e.g. My attendance hours for slot 4 are still missing..."
              rows={2}
              className="mt-2 w-full rounded-[8px] border border-amber-300 bg-white p-2.5 text-[12.5px] text-gray-900 focus:outline-none"
            />
            <div className="mt-2 flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => setReopening(false)}>
                Cancel
              </Button>
              <Button size="sm" variant="primary" loading={sending} onClick={handleReopen}>
                Reopen Ticket
              </Button>
            </div>
          </div>
        ) : null}

        {/* Satisfaction Rating Form if Resolved */}
        {ticket.status === "RESOLVED" && !ticket.rating ? (
          <div
            className="rounded-[12px] border p-3 text-emerald-950"
            style={{ background: "#ECFDF5", borderColor: "#A7F3D0" }}
          >
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-[13px] font-bold text-emerald-900">How was your support experience?</h4>
                <p className="text-[11.5px] text-emerald-800">Rate your resolution to help improve mentor assistance.</p>
              </div>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    className="text-[20px] transition-transform hover:scale-125"
                    style={{ color: star <= rating ? "#F59E0B" : "#D1D5DB" }}
                  >
                    ★
                  </button>
                ))}
              </div>
            </div>
            <input
              type="text"
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Optional comments for the mentor..."
              className="mt-2 w-full rounded-[8px] border border-emerald-300 bg-white px-3 py-1.5 text-[12px] text-gray-900 focus:outline-none"
            />
            <div className="mt-2 flex justify-end">
              <Button size="sm" variant="success" loading={submittingFeedback} onClick={handleFeedback}>
                Submit Rating
              </Button>
            </div>
          </div>
        ) : null}

        {/* WhatsApp-Style Chat Area */}
        <div
          className="flex flex-col rounded-[16px] border overflow-hidden shadow-inner"
          style={{
            background: "var(--surface-sunken)",
            borderColor: "var(--line-soft)",
          }}
        >
          {/* Messages Scroll Container */}
          <div className="flex flex-col gap-3 p-4 overflow-y-auto max-h-[380px] min-h-[220px]">
            {/* Conversation start notice */}
            <div className="flex justify-center my-1">
              <span className="rounded-full bg-black/5 dark:bg-white/10 px-3 py-1 text-[11px] font-medium text-gray-600 dark:text-gray-300">
                Ticket opened on {formatDay(ticket.createdAt.slice(0, 10), "medium")}
              </span>
            </div>

            {ticket.messages.map((msg) => {
              // WhatsApp Rule:
              // - Outgoing user messages: on the RIGHT
              // - Incoming admin/mentor messages: on the LEFT
              const isOutgoing = msg.senderId === currentUserId;

              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isOutgoing ? "items-end" : "items-start"}`}
                >
                  <div
                    className={`relative max-w-[82%] px-3.5 py-2.5 shadow-sm transition-all ${
                      isOutgoing
                        ? "rounded-2xl rounded-tr-xs bg-[#DCF8C6] dark:bg-[#005C4B] border border-[#BDE5A7] dark:border-transparent text-[#111827] dark:text-[#E9EDEF]"
                        : "rounded-2xl rounded-tl-xs bg-white dark:bg-[#202C33] border border-gray-200 dark:border-gray-700/80 text-[#111827] dark:text-[#E9EDEF]"
                    }`}
                  >
                    {/* Header for incoming mentor messages */}
                    {!isOutgoing ? (
                      <div className="flex items-center gap-1.5 pb-1">
                        <span className="text-[11.5px] font-bold text-[#1A73E8] dark:text-[#53BDEB]">
                          {msg.senderName}
                        </span>
                        <span className="rounded bg-blue-100 dark:bg-blue-900/60 px-1 py-0.5 text-[9px] font-bold uppercase text-blue-800 dark:text-blue-300">
                          Mentor
                        </span>
                      </div>
                    ) : null}

                    {/* Message Body with guaranteed high-contrast legible text */}
                    <p className="whitespace-pre-wrap text-[13.5px] leading-relaxed break-words font-normal text-[#111827] dark:text-[#E9EDEF]">
                      {msg.message}
                    </p>

                    {/* Timestamp & status inside the bubble footer */}
                    <div
                      className={`mt-1 flex items-center justify-end gap-1 text-[10px] ${
                        isOutgoing
                          ? "text-[#4B5563] dark:text-[#9CA3AF]"
                          : "text-gray-400 dark:text-gray-400"
                      }`}
                    >
                      <span>{relativeTime(msg.createdAt)}</span>
                      {isOutgoing ? (
                        <span title={msg.readAt ? `Read ${relativeTime(msg.readAt)}` : "Delivered"}>
                          {msg.readAt ? (
                            <span className="text-[#0284C7] dark:text-[#38BDF8] font-bold">✓✓</span>
                          ) : (
                            <span>✓</span>
                          )}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* WhatsApp-Style Bottom Chat Input Bar */}
          {!isResolvedOrClosed ? (
            <div
              className="flex items-center gap-2 border-t p-2.5 sm:p-3"
              style={{
                background: "var(--surface-raised)",
                borderColor: "var(--line-soft)",
              }}
            >
              <input
                type="text"
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                placeholder="Type a message…"
                className="flex-1 rounded-full border px-4 py-2 text-[13.5px] transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                style={{
                  background: "var(--surface-sunken)",
                  borderColor: "var(--line-default)",
                  color: "var(--text-strong)",
                }}
              />

              <button
                type="button"
                onClick={handleSendMessage}
                disabled={!replyText.trim() || sending}
                aria-label="Send message"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#1A73E8] text-white shadow-sm transition-all hover:bg-[#1557B0] active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
              >
                <Icon name="arrow-right" className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div
              className="border-t p-3 text-center text-[12px]"
              style={{
                background: "var(--surface-raised)",
                borderColor: "var(--line-soft)",
                color: "var(--text-muted)",
              }}
            >
              <span>This ticket is resolved. Reopen if you need more help from your mentor.</span>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
