"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatusBadge, Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/Icon";
import { formatDay, relativeTime } from "@/lib/dates";
import {
  CATEGORIES_CONFIG,
  MODULES_CONFIG,
  PRIORITY_CONFIG,
  type TicketCategory,
  type TicketModule,
  type TicketPriority,
} from "@/lib/support";
import { CreateTicketDialog, type StudentProfile, type FaqItem } from "./CreateTicketDialog";
import { TicketConversationModal, type TicketDetail } from "./TicketConversationModal";

export function SupportClient({
  user,
  initialTickets,
  faqs,
}: {
  user: StudentProfile;
  initialTickets: any[];
  faqs: FaqItem[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [activeTab, setActiveTab] = useState<"requests" | "faq">("requests");
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(
    searchParams.get("ticket") || null
  );

  // Filters for requests
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [categoryFilter, setCategoryFilter] = useState("ALL");

  // Filters for FAQ
  const [faqSearch, setFaqSearch] = useState("");
  const [faqCategory, setFaqCategory] = useState("ALL");

  // Selected ticket for conversation modal
  const activeTicket = useMemo(() => {
    if (!selectedTicketId) return null;
    return (initialTickets.find((t) => t.id === selectedTicketId) as TicketDetail) || null;
  }, [selectedTicketId, initialTickets]);

  // Filtered tickets
  const filteredTickets = useMemo(() => {
    return initialTickets.filter((t) => {
      if (statusFilter !== "ALL" && t.status !== statusFilter) return false;
      if (categoryFilter !== "ALL" && t.category !== categoryFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const hay = `${t.ticketNumber} ${t.subject} ${t.category} ${t.module}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [initialTickets, statusFilter, categoryFilter, searchQuery]);

  // Filtered FAQs
  const filteredFaqs = useMemo(() => {
    return faqs.filter((f) => {
      if (faqCategory !== "ALL" && f.category !== faqCategory) return false;
      if (faqSearch.trim()) {
        const q = faqSearch.trim().toLowerCase();
        const hay = `${f.title} ${f.question} ${f.answer} ${f.tags}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [faqs, faqCategory, faqSearch]);

  const handleFaqHelpful = async (faqId: string) => {
    try {
      await fetch("/api/support/faq", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: faqId }),
      });
      router.refresh();
    } catch {
      // Ignored
    }
  };

  return (
    <>
      <div className="flex flex-col gap-4">
        {/* Navigation Tabs & Primary Action */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div
            className="flex items-center gap-1 rounded-[10px] p-1"
            style={{ background: "var(--surface-sunken)", border: "1px solid var(--line-soft)" }}
          >
            <button
              onClick={() => setActiveTab("requests")}
              aria-pressed={activeTab === "requests"}
              className="flex items-center gap-1.5 rounded-[8px] px-3 py-1.5 text-[12.5px] font-medium transition-all"
              style={{
                background: activeTab === "requests" ? "var(--surface-raised)" : "transparent",
                color: activeTab === "requests" ? "var(--text-strong)" : "var(--text-muted)",
                boxShadow: activeTab === "requests" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
              }}
            >
              <Icon name="mail" className="h-4 w-4" />
              <span>My Requests</span>
              <span className="rounded-full bg-slate-200 px-1.5 py-0.2 text-[10px] font-bold">
                {initialTickets.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("faq")}
              aria-pressed={activeTab === "faq"}
              className="flex items-center gap-1.5 rounded-[8px] px-3 py-1.5 text-[12.5px] font-medium transition-all"
              style={{
                background: activeTab === "faq" ? "var(--surface-raised)" : "transparent",
                color: activeTab === "faq" ? "var(--text-strong)" : "var(--text-muted)",
                boxShadow: activeTab === "faq" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
              }}
            >
              <Icon name="book" className="h-4 w-4" />
              <span>Knowledge Base & FAQs</span>
            </button>
          </div>

          <Button
            variant="primary"
            icon="plus"
            onClick={() => setCreateOpen(true)}
          >
            Raise Support Request
          </Button>
        </div>

        {/* Tab 1: My Requests */}
        {activeTab === "requests" ? (
          <Card>
            <CardHeader
              icon="mail"
              title="Support Request Inbox"
              subtitle={`${filteredTickets.length} of ${initialTickets.length} tickets — click any request to view conversation.`}
            />

            {/* Filter Toolbar */}
            <div className="mb-4 grid gap-2.5 sm:grid-cols-3">
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
                  placeholder="Search by ticket ID or subject…"
                  className="h-9 w-full rounded-[8px] border pl-8 pr-3 text-[12.5px] transition-colors focus:outline-none"
                  style={{
                    borderColor: "var(--line-default)",
                    background: "var(--surface-sunken)",
                    color: "var(--text-default)",
                  }}
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-9 w-full rounded-[8px] border px-3 text-[12.5px] focus:outline-none"
                style={{
                  borderColor: "var(--line-default)",
                  background: "var(--surface-sunken)",
                  color: "var(--text-default)",
                }}
              >
                <option value="ALL">All Statuses</option>
                <option value="NEW">New</option>
                <option value="OPEN">Open</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="WAITING_STUDENT">Waiting for Student</option>
                <option value="RESOLVED">Resolved</option>
                <option value="CLOSED">Closed</option>
              </select>

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
            </div>

            {filteredTickets.length === 0 ? (
              <EmptyState
                title="No support tickets found"
                description={
                  initialTickets.length === 0
                    ? "You haven't submitted any support requests yet. If you face any issues with Missed OTP, Worklogs, or Tasks, raise a ticket."
                    : "No requests match your current filters. Try clearing the search."
                }
                action={
                  initialTickets.length === 0 ? (
                    <Button onClick={() => setCreateOpen(true)} icon="plus">
                      Raise Support Request
                    </Button>
                  ) : (
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setSearchQuery("");
                        setStatusFilter("ALL");
                        setCategoryFilter("ALL");
                      }}
                    >
                      Clear Filters
                    </Button>
                  )
                }
              />
            ) : (
              <ul className="flex flex-col gap-2.5">
                {filteredTickets.map((t) => {
                  const catConfig = CATEGORIES_CONFIG[t.category as TicketCategory];
                  const modConfig = MODULES_CONFIG[t.module as TicketModule];
                  const priConfig = PRIORITY_CONFIG[t.priority as TicketPriority];

                  return (
                    <li
                      key={t.id}
                      onClick={() => setSelectedTicketId(t.id)}
                      className="cursor-pointer overflow-hidden rounded-[12px] border p-3.5 transition-all hover:border-[var(--accent)] hover:shadow-sm"
                      style={{
                        background: "var(--surface-raised)",
                        borderColor: "var(--line-soft)",
                      }}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2.5">
                        <div className="flex min-w-0 flex-1 flex-col gap-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-[12px] font-bold text-[var(--accent)]">
                              {t.ticketNumber}
                            </span>
                            <StatusBadge status={t.status} />
                            <Badge tone={priConfig?.tone || "slate"}>
                              {priConfig?.label || t.priority}
                            </Badge>
                            <Badge tone="slate">{catConfig?.label || t.category}</Badge>
                          </div>

                          <h3 className="mt-0.5 text-[14px] font-semibold text-[var(--text-strong)]">
                            {t.subject}
                          </h3>

                          <p className="line-clamp-2 text-[12px] text-[var(--text-muted)]">
                            {t.description}
                          </p>
                        </div>

                        <div className="flex shrink-0 flex-col items-end gap-1 text-[11px] text-[var(--text-faint)]">
                          <span>Updated {relativeTime(t.updatedAt)}</span>
                          <span className="flex items-center gap-1 font-medium text-[var(--accent)]">
                            <Icon name="mail" className="h-3 w-3" />
                            {t.messages.length} messages
                          </span>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        ) : (
          /* Tab 2: Knowledge Base & FAQ */
          <Card>
            <CardHeader
              icon="book"
              title="Portal Knowledge Base & Frequently Asked Questions"
              subtitle="Browse solutions and policies across attendance, worklog and sprint modules."
            />

            {/* FAQ Search Toolbar */}
            <div className="mb-4 grid gap-2.5 sm:grid-cols-2">
              <div className="relative">
                <span
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
                  style={{ color: "var(--text-faint)" }}
                >
                  <Icon name="search" className="h-3.5 w-3.5" />
                </span>
                <input
                  type="text"
                  value={faqSearch}
                  onChange={(e) => setFaqSearch(e.target.value)}
                  placeholder="Search questions or keywords…"
                  className="h-9 w-full rounded-[8px] border pl-8 pr-3 text-[12.5px] focus:outline-none"
                  style={{
                    borderColor: "var(--line-default)",
                    background: "var(--surface-sunken)",
                    color: "var(--text-default)",
                  }}
                />
              </div>

              <select
                value={faqCategory}
                onChange={(e) => setFaqCategory(e.target.value)}
                className="h-9 w-full rounded-[8px] border px-3 text-[12.5px] focus:outline-none"
                style={{
                  borderColor: "var(--line-default)",
                  background: "var(--surface-sunken)",
                  color: "var(--text-default)",
                }}
              >
                <option value="ALL">All Categories</option>
                <option value="MISSED_OTP">Missed OTP / Attendance</option>
                <option value="WORKLOG">Worklog & Extensions</option>
                <option value="DASHBOARD">Dashboard & Points</option>
                <option value="TASK">Task Management</option>
                <option value="ACCOUNT">Account & Profile</option>
                <option value="GENERAL">General Guidelines</option>
              </select>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {filteredFaqs.map((faq) => (
                <div
                  key={faq.id}
                  className="flex flex-col justify-between rounded-[12px] border p-4"
                  style={{ background: "var(--surface-sunken)", borderColor: "var(--line-soft)" }}
                >
                  <div>
                    <h4 className="text-[13.5px] font-semibold text-[var(--text-strong)]">
                      {faq.title}
                    </h4>
                    <p className="mt-1 text-[12px] font-medium text-[var(--accent)]">
                      Q: {faq.question}
                    </p>
                    <p className="mt-2 text-[12.5px] leading-relaxed text-[var(--text-muted)]">
                      {faq.answer}
                    </p>
                  </div>

                  <div className="mt-3 flex items-center justify-between border-t border-[var(--line-soft)] pt-2.5 text-[11px] text-[var(--text-faint)]">
                    <span>Helpful to {faq.helpfulCount} students</span>
                    <button
                      type="button"
                      onClick={() => handleFaqHelpful(faq.id)}
                      className="flex items-center gap-1 rounded-md px-2 py-1 font-semibold transition-colors hover:bg-slate-200"
                    >
                      <Icon name="check" className="h-3 w-3" />
                      Helpful
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>

      {/* Create Ticket Modal */}
      <CreateTicketDialog
        user={user}
        faqs={faqs}
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(id) => {
          setCreateOpen(false);
          setSelectedTicketId(id);
          router.refresh();
        }}
      />

      {/* Ticket Conversation Modal */}
      {activeTicket ? (
        <TicketConversationModal
          ticket={activeTicket}
          currentUserId={user.id}
          onClose={() => setSelectedTicketId(null)}
          onTicketUpdated={() => router.refresh()}
        />
      ) : null}
    </>
  );
}
