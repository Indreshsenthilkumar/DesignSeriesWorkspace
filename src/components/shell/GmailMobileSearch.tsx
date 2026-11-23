"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { Icon, type IconName } from "@/components/ui/Icon";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";
import { formatDay } from "@/lib/dates";
import type { ShellUser } from "./AppShell";

export type SearchCategory =
  | "all"
  | "students"
  | "tasks"
  | "leaves"
  | "worklogs"
  | "tickets"
  | "notices";

interface SearchResults {
  people: Array<{
    id: string;
    name: string;
    rollNo: string;
    domain: string;
    role: string;
    department?: string;
  }>;
  tasks: Array<{
    id: string;
    title: string;
    status: string;
    priority: string;
    dueDate?: string | null;
  }>;
  leaves: Array<{
    id: string;
    leaveType: string;
    fromDate: string;
    toDate: string;
    status: string;
    name: string;
    reason?: string;
  }>;
  worklogs: Array<{
    id: string;
    s1: string;
    date: string;
    status: string;
    name: string;
  }>;
  tickets: Array<{
    id: string;
    ticketNumber: string;
    subject: string;
    status: string;
    category: string;
  }>;
  notices: Array<{
    id: string;
    title: string;
    createdAt: string;
    category?: string;
  }>;
}

const CATEGORY_CHIPS: Array<{ id: SearchCategory; label: string; icon: IconName }> = [
  { id: "all", label: "All", icon: "search" },
  { id: "students", label: "Students", icon: "user" },
  { id: "tasks", label: "Tasks", icon: "clipboard" },
  { id: "leaves", label: "Leaves", icon: "calendar" },
  { id: "worklogs", label: "Worklogs", icon: "layers" },
  { id: "tickets", label: "Support", icon: "sparkle" },
  { id: "notices", label: "Notices", icon: "bell" },
];

const QUICK_SHORTCUTS = [
  { label: "Missed OTP Attendance", href: "/attendance", icon: "clock" as IconName, tag: "Attendance" },
  { label: "Apply for Leave", href: "/leaves", icon: "calendar" as IconName, tag: "Leaves" },
  { label: "Daily Worklog", href: "/worklog", icon: "layers" as IconName, tag: "Worklog" },
  { label: "Sprint Tasks", href: "/tasks", icon: "clipboard" as IconName, tag: "Tasks" },
  { label: "Gate Passes", href: "/passes", icon: "ticket" as IconName, tag: "Passes" },
  { label: "Reward Points Ledger", href: "/rewards", icon: "trophy" as IconName, tag: "Rewards" },
  { label: "Help & Support Tickets", href: "/support", icon: "sparkle" as IconName, tag: "Support" },
];

interface GmailMobileSearchProps {
  user: ShellUser;
  unreadAnnouncements: number;
  onOpenDrawer: () => void;
}

/**
 * Mobile-Only Unified Gmail-Style Search Experience.
 *
 * In idle state: displays the iconic floating Gmail search pill bar with
 * Hamburger menu, search placeholder, notification bell, and user avatar.
 *
 * On tap: seamlessly transitions into full-screen search view with
 * autocompleting queries, category filter chips (All, Students, Tasks, Leaves, Worklogs, Support, Notices),
 * quick shortcuts, and instant deep-linking.
 */
export function GmailMobileSearch({
  user,
  unreadAnnouncements,
  onOpenDrawer,
}: GmailMobileSearchProps) {
  const router = useRouter();
  const [active, setActive] = useState(false);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<SearchCategory>("all");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResults>({
    people: [],
    tasks: [],
    leaves: [],
    worklogs: [],
    tickets: [],
    notices: [],
  });

  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input automatically when search screen opens
  useEffect(() => {
    if (active) {
      document.body.style.overflow = "hidden";
      const timer = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(timer);
    } else {
      document.body.style.overflow = "";
      setQuery("");
      setCategory("all");
      setResults({ people: [], tasks: [], leaves: [], worklogs: [], tickets: [], notices: [] });
    }
  }, [active]);

  // Debounced API search
  useEffect(() => {
    if (!active) return;
    const q = query.trim();
    if (!q) {
      setResults({ people: [], tasks: [], leaves: [], worklogs: [], tickets: [], notices: [] });
      setLoading(false);
      return;
    }

    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/search?q=${encodeURIComponent(q)}&category=${encodeURIComponent(category)}`
        );
        const data = await res.json();
        if (data.ok) {
          setResults({
            people: data.people || [],
            tasks: data.tasks || [],
            leaves: data.leaves || [],
            worklogs: data.worklogs || [],
            tickets: data.tickets || [],
            notices: data.notices || [],
          });
        }
      } catch {
        // ignore network aborts
      } finally {
        setLoading(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [query, category, active]);

  const handleSelectHit = (href: string) => {
    setActive(false);
    router.push(href);
  };

  const totalHits =
    results.people.length +
    results.tasks.length +
    results.leaves.length +
    results.worklogs.length +
    results.tickets.length +
    results.notices.length;

  return (
    <>
      {/* ------------------------------------------------------------------ */}
      {/* 1. Gmail-Style Floating Search Bar (Visible in Mobile View)         */}
      {/* ------------------------------------------------------------------ */}
      <div className="w-full lg:hidden py-1.5">
        <div
          className={cn(
            "flex h-12 w-full items-center gap-2 rounded-full border px-2 shadow-xs transition-all",
            "border-[var(--line-default)] bg-[var(--surface-raised)] hover:border-[var(--line-strong)]"
          )}
        >
          {/* Hamburger Menu Icon */}
          <button
            type="button"
            onClick={onOpenDrawer}
            aria-label="Open portal navigation"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[var(--text-muted)] hover:bg-[var(--surface-inset)] active:scale-95"
          >
            <Icon name="menu" className="h-[18px] w-[18px]" />
          </button>

          {/* Central Search Trigger Pill */}
          <button
            type="button"
            onClick={() => setActive(true)}
            className="flex flex-1 items-center gap-2.5 text-left text-[14px] text-[var(--text-faint)] select-none truncate"
          >
            <Icon name="search" className="h-4 w-4 shrink-0 text-[var(--text-muted)]" />
            <span className="truncate">Search in DesignSeries…</span>
          </button>

          {/* Notifications Bell */}
          <Link
            href="/announcements"
            aria-label="Announcements"
            className="relative grid h-8 w-8 shrink-0 place-items-center rounded-full text-[var(--text-muted)] hover:bg-[var(--surface-inset)]"
          >
            <Icon name="bell" className="h-4 w-4" />
            {unreadAnnouncements > 0 ? (
              <span className="absolute -top-0.5 -right-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-[var(--color-brand-red)] px-1 text-[9px] font-bold text-white">
                {unreadAnnouncements > 9 ? "9+" : unreadAnnouncements}
              </span>
            ) : null}
          </Link>

          {/* User Profile Avatar */}
          <Link
            href="/profile"
            aria-label="Your Profile"
            className="shrink-0 transition-transform active:scale-90"
          >
            <Avatar name={user.name} size={30} />
          </Link>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* 2. Full-Screen Gmail Search Experience (Opened on tap)             */}
      {/* ------------------------------------------------------------------ */}
      {active && (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-[var(--surface-page)] text-[var(--text-strong)] lg:hidden animate-in fade-in duration-150"
          role="dialog"
          aria-modal="true"
        >
          {/* Top Gmail Header: Back Arrow, Input, Clear */}
          <div className="flex h-14 shrink-0 items-center gap-2 border-b border-[var(--line-soft)] px-3 bg-[var(--surface-raised)]">
            <button
              type="button"
              onClick={() => setActive(false)}
              aria-label="Close search"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-[var(--text-strong)] hover:bg-[var(--surface-inset)] active:scale-95"
            >
              <Icon name="chevron-left" className="h-5 w-5" />
            </button>

            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search students, tasks, worklogs, leaves…"
              className="flex-1 bg-transparent text-[15px] font-normal text-[var(--text-strong)] placeholder:text-[var(--text-faint)] focus:outline-none"
            />

            {query ? (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  inputRef.current?.focus();
                }}
                aria-label="Clear query"
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[var(--text-muted)] hover:bg-[var(--surface-inset)]"
              >
                <Icon name="close" className="h-4 w-4" />
              </button>
            ) : null}
          </div>

          {/* Gmail Filter Chips Bar */}
          <div className="flex items-center gap-1.5 overflow-x-auto px-3 py-2 border-b border-[var(--line-subtle)] bg-[var(--surface-sunken)]/60 scrollbar-none">
            {CATEGORY_CHIPS.map((chip) => {
              const isSelected = category === chip.id;
              return (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => setCategory(chip.id)}
                  className={cn(
                    "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-semibold transition-colors",
                    isSelected
                      ? "bg-[var(--color-brand-blue)] text-white shadow-xs"
                      : "bg-[var(--surface-raised)] text-[var(--text-muted)] border border-[var(--line-default)] hover:bg-[var(--surface-inset)]"
                  )}
                >
                  <Icon name={chip.icon} className="h-3.5 w-3.5" />
                  <span>{chip.label}</span>
                </button>
              );
            })}
          </div>

          {/* Body: Live Results or Quick Shortcuts */}
          <div className="flex-1 overflow-y-auto px-3 py-3">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-12 text-[var(--text-muted)]">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" />
                <span className="mt-3 text-[12px] font-medium">Searching portal…</span>
              </div>
            ) : query.trim() ? (
              totalHits === 0 ? (
                <div className="py-12 text-center text-[var(--text-muted)]">
                  <Icon name="search" className="mx-auto h-8 w-8 text-[var(--text-faint)] opacity-60" />
                  <p className="mt-3 text-[14px] font-semibold text-[var(--text-strong)]">
                    No results found
                  </p>
                  <p className="mt-1 text-[12px] text-[var(--text-muted)]">
                    No matches for &ldquo;{query}&rdquo; in {category}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* People / Students */}
                  {results.people.length > 0 && (
                    <div className="space-y-1">
                      <div className="px-2 text-[10.5px] font-bold uppercase tracking-wider text-[var(--text-faint)]">
                        People ({results.people.length})
                      </div>
                      <div className="rounded-[12px] border border-[var(--line-subtle)] bg-[var(--surface-raised)] divide-y divide-[var(--line-subtle)]">
                        {results.people.map((p) => (
                          <div
                            key={p.id}
                            onClick={() => handleSelectHit(`/console/people/${p.id}`)}
                            className="flex items-center gap-3 p-3 cursor-pointer hover:bg-[var(--surface-inset)] active:bg-[var(--surface-inset)]"
                          >
                            <Avatar name={p.name} size={34} />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-1.5">
                                <span className="text-[13.5px] font-bold text-[var(--text-strong)] truncate">
                                  {p.name}
                                </span>
                                <Badge tone="blue">{p.role}</Badge>
                              </div>
                              <p className="text-[11.5px] text-[var(--text-muted)] truncate">
                                {p.rollNo} · {p.domain || p.department || "DesignSeries"}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Tasks */}
                  {results.tasks.length > 0 && (
                    <div className="space-y-1">
                      <div className="px-2 text-[10.5px] font-bold uppercase tracking-wider text-[var(--text-faint)]">
                        Tasks ({results.tasks.length})
                      </div>
                      <div className="rounded-[12px] border border-[var(--line-subtle)] bg-[var(--surface-raised)] divide-y divide-[var(--line-subtle)]">
                        {results.tasks.map((t) => (
                          <div
                            key={t.id}
                            onClick={() => handleSelectHit("/tasks")}
                            className="flex items-start gap-3 p-3 cursor-pointer hover:bg-[var(--surface-inset)] active:bg-[var(--surface-inset)]"
                          >
                            <div className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-blue-500/10 text-blue-600">
                              <Icon name="clipboard" className="h-4 w-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-1.5">
                                <span className="text-[13px] font-semibold text-[var(--text-strong)] truncate">
                                  {t.title}
                                </span>
                                <Badge tone={t.status === "DONE" ? "green" : "amber"}>
                                  {t.status}
                                </Badge>
                              </div>
                              {t.dueDate ? (
                                <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">
                                  Due {formatDay(t.dueDate.slice(0, 10), "medium")}
                                </p>
                              ) : null}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Leaves */}
                  {results.leaves.length > 0 && (
                    <div className="space-y-1">
                      <div className="px-2 text-[10.5px] font-bold uppercase tracking-wider text-[var(--text-faint)]">
                        Leaves ({results.leaves.length})
                      </div>
                      <div className="rounded-[12px] border border-[var(--line-subtle)] bg-[var(--surface-raised)] divide-y divide-[var(--line-subtle)]">
                        {results.leaves.map((l) => (
                          <div
                            key={l.id}
                            onClick={() => handleSelectHit("/leaves")}
                            className="flex items-start gap-3 p-3 cursor-pointer hover:bg-[var(--surface-inset)] active:bg-[var(--surface-inset)]"
                          >
                            <div className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-amber-500/10 text-amber-600">
                              <Icon name="calendar" className="h-4 w-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-1.5">
                                <span className="text-[13px] font-semibold text-[var(--text-strong)] truncate">
                                  {l.leaveType} · {l.name}
                                </span>
                                <Badge tone={l.status === "APPROVED" ? "green" : l.status === "REJECTED" ? "red" : "amber"}>
                                  {l.status}
                                </Badge>
                              </div>
                              <p className="mt-0.5 text-[11.5px] text-[var(--text-muted)]">
                                {formatDay(l.fromDate.slice(0, 10), "medium")} – {formatDay(l.toDate.slice(0, 10), "medium")}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Worklogs */}
                  {results.worklogs.length > 0 && (
                    <div className="space-y-1">
                      <div className="px-2 text-[10.5px] font-bold uppercase tracking-wider text-[var(--text-faint)]">
                        Worklogs ({results.worklogs.length})
                      </div>
                      <div className="rounded-[12px] border border-[var(--line-subtle)] bg-[var(--surface-raised)] divide-y divide-[var(--line-subtle)]">
                        {results.worklogs.map((w) => (
                          <div
                            key={w.id}
                            onClick={() => handleSelectHit("/worklog")}
                            className="flex items-start gap-3 p-3 cursor-pointer hover:bg-[var(--surface-inset)] active:bg-[var(--surface-inset)]"
                          >
                            <div className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-emerald-500/10 text-emerald-600">
                              <Icon name="layers" className="h-4 w-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-1.5">
                                <span className="text-[13px] font-semibold text-[var(--text-strong)] truncate">
                                  {w.s1 || "Worklog entry"}
                                </span>
                                <Badge tone="slate">{formatDay(w.date, "short")}</Badge>
                              </div>
                              <p className="mt-0.5 text-[11px] text-[var(--text-muted)] truncate">
                                {w.name} · {w.status}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Support Tickets */}
                  {results.tickets.length > 0 && (
                    <div className="space-y-1">
                      <div className="px-2 text-[10.5px] font-bold uppercase tracking-wider text-[var(--text-faint)]">
                        Support Tickets ({results.tickets.length})
                      </div>
                      <div className="rounded-[12px] border border-[var(--line-subtle)] bg-[var(--surface-raised)] divide-y divide-[var(--line-subtle)]">
                        {results.tickets.map((t) => (
                          <div
                            key={t.id}
                            onClick={() => handleSelectHit("/support")}
                            className="flex items-start gap-3 p-3 cursor-pointer hover:bg-[var(--surface-inset)] active:bg-[var(--surface-inset)]"
                          >
                            <div className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-indigo-500/10 text-indigo-600">
                              <Icon name="sparkle" className="h-4 w-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-1.5">
                                <span className="text-[13px] font-semibold text-[var(--text-strong)] truncate">
                                  {t.ticketNumber} · {t.subject}
                                </span>
                                <Badge tone={t.status === "RESOLVED" ? "green" : "blue"}>
                                  {t.status}
                                </Badge>
                              </div>
                              <p className="mt-0.5 text-[11px] text-[var(--text-muted)] truncate">
                                {t.category}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Notices */}
                  {results.notices.length > 0 && (
                    <div className="space-y-1">
                      <div className="px-2 text-[10.5px] font-bold uppercase tracking-wider text-[var(--text-faint)]">
                        Announcements ({results.notices.length})
                      </div>
                      <div className="rounded-[12px] border border-[var(--line-subtle)] bg-[var(--surface-raised)] divide-y divide-[var(--line-subtle)]">
                        {results.notices.map((n) => (
                          <div
                            key={n.id}
                            onClick={() => handleSelectHit("/announcements")}
                            className="flex items-start gap-3 p-3 cursor-pointer hover:bg-[var(--surface-inset)] active:bg-[var(--surface-inset)]"
                          >
                            <div className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-violet-500/10 text-violet-600">
                              <Icon name="bell" className="h-4 w-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <span className="text-[13px] font-semibold text-[var(--text-strong)] line-clamp-1">
                                {n.title}
                              </span>
                              <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">
                                {formatDay(n.createdAt.slice(0, 10), "medium")}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )
            ) : (
              /* Quick Shortcuts when query is empty */
              <div className="space-y-4">
                <div>
                  <h3 className="px-1 text-[11px] font-bold uppercase tracking-wider text-[var(--text-faint)]">
                    Quick Shortcuts
                  </h3>
                  <div className="mt-2 grid grid-cols-1 gap-1.5">
                    {QUICK_SHORTCUTS.map((item) => (
                      <div
                        key={item.href}
                        onClick={() => handleSelectHit(item.href)}
                        className="flex items-center justify-between rounded-[12px] border border-[var(--line-subtle)] bg-[var(--surface-raised)] p-3 cursor-pointer transition-colors hover:bg-[var(--surface-inset)] active:scale-[0.99]"
                      >
                        <div className="flex items-center gap-3">
                          <div className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--surface-inset)] text-[var(--text-strong)]">
                            <Icon name={item.icon} className="h-4 w-4" />
                          </div>
                          <span className="text-[13.5px] font-semibold text-[var(--text-strong)]">
                            {item.label}
                          </span>
                        </div>
                        <Badge tone="slate">{item.tag}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
