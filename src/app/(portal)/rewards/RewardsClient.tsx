"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { PageHeader } from "@/components/shell/PageHeader";
import { Badge, type Tone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { Icon, type IconName } from "@/components/ui/Icon";
import { ProgressBar } from "@/components/ui/Progress";
import { useToast } from "@/components/ui/Toast";
import { Table, TableWrap, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { Field, Input } from "@/components/ui/Field";
import { GmailSectionSearch } from "@/components/ui/GmailSectionSearch";
import { relativeTime } from "@/lib/dates";
import type { RewardCategory } from "@/lib/rewards-engine";

type UserSummary = {
  user: {
    id: string;
    name: string;
    rollNo: string;
    department: string;
    role?: string;
  };
  policy: {
    id: string;
    name: string;
    baseScore: number;
    maxScore: number;
    minScore: number;
    periodType: string;
    description: string;
    rules: Array<{
      id: string;
      code: string;
      name: string;
      category: string;
      subCategory?: string | null;
      type: string;
      points: number;
      isEnabled: boolean;
      description: string;
      gracePeriodDays?: number;
      effectiveFrom?: string | null;
    }>;
  };
  score: number;
  maxScore: number;
  baseScore: number;
  minScore: number;
  percentage: number;
  tier: "OUTSTANDING" | "GOOD" | "SATISFACTORY" | "AT_RISK";
  tierLabel: string;
  breakdown: Record<RewardCategory, { additions: number; deductions: number; net: number; count: number }>;
  transactions: Array<{
    id: string;
    ruleCode: string;
    category: string;
    type: string;
    points: number;
    previousScore: number;
    newScore: number;
    reason: string;
    isManual: boolean;
    createdAt: Date | string;
    rule?: { name: string; code: string; category: string } | null;
    actor?: { id: string; name: string; role: string } | null;
  }>;
  monthlyTrends: Record<string, { additions: number; deductions: number; count: number }>;
};

const CATEGORY_META: Record<
  RewardCategory,
  { label: string; icon: IconName; tone: Tone }
> = {
  LEAVE: { label: "Leave Management", icon: "calendar", tone: "red" },
  WORKLOG: { label: "Worklog Management", icon: "clipboard", tone: "blue" },
  ATTENDANCE: { label: "Attendance & OTP", icon: "check-circle", tone: "green" },
  LINKEDIN: { label: "LinkedIn Tracker", icon: "linkedin", tone: "blue" },
  ON_DUTY: { label: "On-Duty Passes", icon: "ticket", tone: "slate" },
  TASK: { label: "Sprint Tasks", icon: "target", tone: "amber" },
  OTHER: { label: "Custom Activities", icon: "award", tone: "slate" },
  MANUAL: { label: "Manual Adjustments", icon: "award", tone: "amber" },
};

export function RewardsClient({
  user,
  initialSummary,
}: {
  user: { id: string; name: string; rollNo: string; role?: string };
  initialSummary: UserSummary;
}) {
  const router = useRouter();
  const toast = useToast();
  const [summary, setSummary] = useState<UserSummary>(initialSummary);
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [infoModalOpen, setInfoModalOpen] = useState(false);
  const [isRefreshing, startTransition] = useTransition();

  const handleRefresh = async () => {
    startTransition(async () => {
      try {
        const res = await fetch("/api/rewards");
        const json = await res.json();
        if (json.ok) {
          setSummary(json.data);
          toast.success("Reward data refreshed successfully.");
        } else {
          toast.error(json.error || "Failed to refresh");
        }
      } catch {
        toast.error("Network error refreshing data");
      }
    });
  };

  // Filtered transactions
  const filteredTransactions = summary.transactions.filter((tx) => {
    if (selectedCategory !== "ALL" && tx.category !== selectedCategory) return false;
    if (typeFilter === "DEDUCTIONS" && tx.points >= 0) return false;
    if (typeFilter === "REWARDS" && tx.points <= 0) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchReason = tx.reason.toLowerCase().includes(q);
      const matchRule = (tx.rule?.name || tx.ruleCode).toLowerCase().includes(q);
      if (!matchReason && !matchRule) return false;
    }
    return true;
  });

  const getTierBadgeTone = (tier: string): Tone => {
    switch (tier) {
      case "OUTSTANDING":
        return "green";
      case "GOOD":
        return "blue";
      case "SATISFACTORY":
        return "amber";
      default:
        return "red";
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <PageHeader
        title="Reward Points & Performance Score"
        description="Dynamic performance scoring based on daily attendance, worklog compliance, sprint tasks, scheduled LinkedIn posts, and institutional leave allowances."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              icon="info"
              onClick={() => setInfoModalOpen(true)}
            >
              How Scoring Works
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon="refresh"
              loading={isRefreshing}
              onClick={handleRefresh}
            >
              Refresh
            </Button>
            <Link href="/leaderboard">
              <Button size="sm" variant="primary" icon="trophy">
                Leaderboard
              </Button>
            </Link>
          </div>
        }
      />

      {/* Top Hero Card */}
      <Card className="p-5 sm:p-6">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-faint)]">
                Current Performance Score
              </span>
              <Badge tone={getTierBadgeTone(summary.tier)}>
                {summary.tierLabel}
              </Badge>
              <Badge tone="slate">
                Base Score: {summary.baseScore}%
              </Badge>
              {user.role === "STUDENT_ADMIN" ? (
                <Badge tone="green">Student + Admin</Badge>
              ) : null}
            </div>

            <div className="flex items-baseline gap-3">
              <h1 className="text-4xl font-extrabold tracking-tight text-[var(--text-strong)] sm:text-5xl">
                {summary.score}
                <span className="text-2xl font-normal text-[var(--text-faint)]">
                  / {summary.maxScore}
                </span>
              </h1>
              <span className="text-lg font-bold text-[var(--accent)]">
                {summary.percentage}%
              </span>
            </div>

            <p className="max-w-xl text-[12.5px] text-[var(--text-muted)]">
              Eligible cohort members start with a base score of {summary.baseScore}%. On-time submissions, full attendance, and verified tasks maintain your standing, while missed deadlines and unapproved absences deduct configurable percentage points. Scheduled holidays are exempted.
            </p>
          </div>

          {/* Quick Standing Progress Gauge */}
          <div
            className="flex min-w-[220px] flex-col justify-center rounded-[14px] border p-4 shadow-sm"
            style={{ background: "var(--surface-sunken)", borderColor: "var(--line-soft)" }}
          >
            <div className="flex items-center justify-between text-[12px] font-semibold text-[var(--text-default)]">
              <span>Performance Tier</span>
              <span className="font-bold">{summary.percentage}%</span>
            </div>
            <div className="mt-2.5">
              <ProgressBar
                value={summary.percentage}
                tone={summary.percentage >= 80 ? "green" : summary.percentage >= 65 ? "amber" : "red"}
              />
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px] text-[var(--text-faint)]">
              <span>Min: {summary.minScore}%</span>
              <span>Target: {summary.maxScore}%</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Activity Category Breakdown Cards */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-[14px] font-bold text-[var(--text-strong)]">
            Activity Category Breakdown
          </h2>
          <span className="text-[11.5px] text-[var(--text-faint)]">
            Click any category to filter your ledger
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-7">
          {(
            [
              "LEAVE",
              "WORKLOG",
              "ATTENDANCE",
              "LINKEDIN",
              "ON_DUTY",
              "TASK",
              "OTHER",
            ] as RewardCategory[]
          ).map((cat) => {
            const meta = CATEGORY_META[cat];
            const catData = summary.breakdown[cat] || { additions: 0, deductions: 0, net: 0, count: 0 };
            const isSelected = selectedCategory === cat;

            return (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(isSelected ? "ALL" : cat)}
                className={`flex flex-col justify-between rounded-[12px] border p-3 text-left transition-all cursor-pointer ${
                  isSelected
                    ? "border-[var(--accent)] bg-[var(--accent)]/10 shadow-sm ring-2 ring-[var(--accent)]/30"
                    : "border-[var(--line-soft)] bg-[var(--surface-raised)] hover:bg-[var(--surface-sunken)]"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div
                    className={`flex h-7 w-7 items-center justify-center rounded-[8px] ${
                      isSelected ? "bg-[var(--accent)] text-white" : "bg-[var(--surface-sunken)] text-[var(--text-default)]"
                    }`}
                  >
                    <Icon name={meta.icon} className="h-3.5 w-3.5" />
                  </div>
                  <span
                    className={`text-[11px] font-bold ${
                      catData.net > 0
                        ? "text-emerald-600 dark:text-emerald-400"
                        : catData.net < 0
                        ? "text-rose-600 dark:text-rose-400"
                        : "text-[var(--text-faint)]"
                    }`}
                  >
                    {catData.net > 0 ? `+${catData.net}%` : catData.net < 0 ? `${catData.net}%` : "0%"}
                  </span>
                </div>

                <div className="mt-2.5">
                  <span className="block text-[12px] font-bold text-[var(--text-strong)]">
                    {meta.label}
                  </span>
                  <div className="mt-0.5 flex items-center justify-between text-[10.5px] text-[var(--text-faint)]">
                    <span>{catData.count} events</span>
                    {catData.deductions > 0 ? (
                      <span className="font-semibold text-rose-500">
                        -{catData.deductions}%
                      </span>
                    ) : null}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Transaction History & Audit Ledger */}
      <Card className="space-y-4 p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-[14px] font-bold text-[var(--text-strong)]">
              Reward Points Activity Ledger
            </h3>
            <p className="text-[11.5px] text-[var(--text-faint)]">
              Transparent record of all activity deductions, bonus additions, and free allowances.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Filter buttons */}
            <div className="inline-flex rounded-[8px] border p-0.5 text-[11.5px]" style={{ borderColor: "var(--line-soft)" }}>
              <button
                type="button"
                onClick={() => setTypeFilter("ALL")}
                className={`rounded-[6px] px-2.5 py-1 font-semibold transition-colors cursor-pointer ${
                  typeFilter === "ALL"
                    ? "bg-[var(--accent)] text-white shadow-xs"
                    : "text-[var(--text-muted)] hover:text-[var(--text-strong)]"
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setTypeFilter("DEDUCTIONS")}
                className={`rounded-[6px] px-2.5 py-1 font-semibold transition-colors cursor-pointer ${
                  typeFilter === "DEDUCTIONS"
                    ? "bg-rose-600 text-white shadow-xs"
                    : "text-[var(--text-muted)] hover:text-rose-600"
                }`}
              >
                Deductions
              </button>
              <button
                type="button"
                onClick={() => setTypeFilter("REWARDS")}
                className={`rounded-[6px] px-2.5 py-1 font-semibold transition-colors cursor-pointer ${
                  typeFilter === "REWARDS"
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "text-[var(--text-muted)] hover:text-emerald-600"
                }`}
              >
                Additions
              </button>
            </div>

            {selectedCategory !== "ALL" ? (
              <Button
                variant="secondary"
                size="sm"
                icon="close"
                onClick={() => setSelectedCategory("ALL")}
              >
                Clear Filter
              </Button>
            ) : null}
          </div>
        </div>

        {/* Search */}
        <div className="mb-3">
          <GmailSectionSearch
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            placeholder="Search by rule, explanation or activity..."
            totalResults={filteredTransactions.length}
            hasActiveFilters={Boolean(searchQuery.trim())}
            onClearAll={() => setSearchQuery("")}
          />
        </div>

        {/* Table representation */}
        <TableWrap>
          <Table>
            <THead>
              <TR>
                <TH>Time</TH>
                <TH>Category</TH>
                <TH>Activity / Explanation</TH>
                <TH className="text-right">Points Impact</TH>
                <TH className="text-right">Resulting Balance</TH>
              </TR>
            </THead>
            <TBody>
              {filteredTransactions.length === 0 ? (
                <TR>
                  <TD colSpan={5} className="py-8 text-center text-[var(--text-faint)]">
                    No reward transactions recorded for your account.
                  </TD>
                </TR>
              ) : (
                filteredTransactions.map((tx) => {
                  const meta = CATEGORY_META[tx.category as RewardCategory] || {
                    label: tx.category,
                    icon: "award",
                    tone: "slate",
                  };
                  const isNegative = tx.points < 0;

                  return (
                    <TR key={tx.id}>
                      <TD className="text-[11px] text-[var(--text-faint)]">
                        {relativeTime(tx.createdAt)}
                      </TD>
                      <TD>
                        <Badge tone={meta.tone}>{meta.label}</Badge>
                      </TD>
                      <TD className="max-w-[400px] text-[12.5px] text-[var(--text-default)]">
                        {tx.reason}
                      </TD>
                      <TD className="text-right font-mono font-bold">
                        <span className={isNegative ? "text-rose-600" : "text-emerald-600"}>
                          {isNegative ? `${tx.points}%` : `+${tx.points}%`}
                        </span>
                      </TD>
                      <TD className="text-right font-mono text-[12px] text-[var(--text-faint)]">
                        {tx.previousScore}% → <span className="font-bold text-[var(--text-strong)]">{tx.newScore}%</span>
                      </TD>
                    </TR>
                  );
                })
              )}
            </TBody>
          </Table>
        </TableWrap>
      </Card>

      {/* Info Modal */}
      <Modal
        open={infoModalOpen}
        onClose={() => setInfoModalOpen(false)}
        title="How Reward Points Work"
        size="md"
      >
        <div className="space-y-3.5 text-[12.5px] leading-relaxed text-[var(--text-default)]">
          <p>
            Your reward score is a real-time index of your academic consistency, worklog compliance, and cohort velocity.
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-[var(--text-muted)]">
            <li><strong>Base Score:</strong> Every student starts at 100%.</li>
            <li><strong>Free Allowances:</strong> Approved leaves and reasonable grace periods configured by administration do not incur point deductions until your free allowance is exceeded.</li>
            <li><strong>Holidays:</strong> No deductions are applied on official scheduled holidays or Sundays.</li>
            <li><strong>Scheduled Submissions:</strong> For scheduled milestones (such as LinkedIn build-in-public posts or worklogs), submissions must be completed on the scheduled dates.</li>
          </ul>
          <div className="pt-2 flex justify-end">
            <Button size="sm" variant="secondary" onClick={() => setInfoModalOpen(false)}>
              Got it
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
