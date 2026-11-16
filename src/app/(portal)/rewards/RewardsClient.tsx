"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { PageHeader } from "@/components/shell/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { Icon, type IconName } from "@/components/ui/Icon";
import { ProgressBar } from "@/components/ui/Progress";
import { useToast } from "@/components/ui/Toast";
import type { RewardCategory } from "@/lib/rewards-engine";

type UserSummary = {
  user: {
    id: string;
    name: string;
    rollNo: string;
    department: string;
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
      type: string;
      points: number;
      isEnabled: boolean;
      description: string;
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
  { label: string; icon: IconName; tone: "blue" | "green" | "amber" | "red" | "slate" }
> = {
  ATTENDANCE: { label: "Attendance", icon: "check-circle", tone: "green" },
  WORKLOG: { label: "Worklog", icon: "clipboard", tone: "blue" },
  TASK: { label: "Tasks", icon: "target", tone: "amber" },
  LEAVE: { label: "Leaves", icon: "calendar", tone: "red" },
  ON_DUTY: { label: "On-Duty", icon: "ticket", tone: "slate" },
  OTHER: { label: "LinkedIn & Other", icon: "linkedin", tone: "blue" },
  MANUAL: { label: "Manual Adjustments", icon: "award", tone: "amber" },
};

export function RewardsClient({
  user,
  initialSummary,
}: {
  user: { id: string; name: string; rollNo: string };
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

  const getTierBadgeTone = (tier: string) => {
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
        title="Reward Points & Performance"
        description="Your dynamic performance-based score calculated from daily attendance, worklog submission deadlines, sprint tasks, and approved institutional leaves."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              icon="info"
              onClick={() => setInfoModalOpen(true)}
            >
              How it works
            </Button>
            <Button
              variant="outline"
              size="sm"
              icon="refresh"
              loading={isRefreshing}
              onClick={handleRefresh}
            >
              Refresh
            </Button>
            <Link href="/leaderboard">
              <Button size="sm" icon="trophy">
                Leaderboard
              </Button>
            </Link>
          </div>
        }
      />

      {/* Hero Performance Card */}
      <Card className="relative overflow-hidden border-slate-200/80 bg-gradient-to-br from-white via-white to-slate-50/60 p-5 shadow-sm sm:p-7">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Current Performance Score
              </span>
              <Badge tone={getTierBadgeTone(summary.tier)}>
                {summary.tierLabel}
              </Badge>
              <Badge tone="slate">
                Base Score: {summary.baseScore}%
              </Badge>
            </div>
            <div className="flex items-baseline gap-3">
              <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
                {summary.score}
                <span className="text-2xl font-semibold text-slate-400">
                  / {summary.maxScore}
                </span>
              </h1>
              <span className="text-lg font-bold text-blue-600">
                {summary.percentage}%
              </span>
            </div>
            <p className="max-w-xl text-sm text-slate-600">
              You began with a base score of {summary.baseScore}%. Verified activities and on-time submissions protect your score; rule violations or missed deadlines deduct configurable percentage points.
            </p>
          </div>

          {/* Quick Progress Ring or Bar representation */}
          <div className="flex min-w-[200px] flex-col justify-center rounded-2xl border border-slate-200/70 bg-white/80 p-4 shadow-sm backdrop-blur-sm sm:p-5">
            <div className="flex items-center justify-between text-xs font-medium text-slate-500">
              <span>Cohort Standing</span>
              <span className="font-bold text-slate-800">{summary.percentage}%</span>
            </div>
            <div className="mt-2.5">
              <ProgressBar
                value={summary.percentage}
                tone={summary.percentage >= 80 ? "green" : summary.percentage >= 65 ? "amber" : "red"}
              />
            </div>
            <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500">
              <span>Min: {summary.minScore}%</span>
              <span>Target: {summary.maxScore}%</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Category Breakdown Cards */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900">
            Activity Category Breakdown
          </h2>
          <span className="text-xs text-slate-500">
            Click any card to filter transaction history
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {(
            [
              "ATTENDANCE",
              "WORKLOG",
              "TASK",
              "LEAVE",
              "ON_DUTY",
              "OTHER",
            ] as RewardCategory[]
          ).map((cat) => {
            const meta = CATEGORY_META[cat];
            const data = summary.breakdown[cat] || { additions: 0, deductions: 0, net: 0, count: 0 };
            const isSelected = selectedCategory === cat;

            return (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(isSelected ? "ALL" : cat)}
                className={`flex flex-col justify-between rounded-xl border p-3.5 text-left transition-all sm:p-4 ${
                  isSelected
                    ? "border-blue-600 bg-blue-50/60 shadow-sm ring-2 ring-blue-500/20"
                    : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                      isSelected ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    <Icon name={meta.icon} className="h-4 w-4" />
                  </div>
                  <span
                    className={`text-xs font-bold ${
                      data.net > 0
                        ? "text-emerald-600"
                        : data.net < 0
                        ? "text-rose-600"
                        : "text-slate-400"
                    }`}
                  >
                    {data.net > 0 ? `+${data.net}` : data.net < 0 ? `${data.net}` : "0"} pts
                  </span>
                </div>

                <div className="mt-3">
                  <span className="block text-xs font-semibold text-slate-800">
                    {meta.label}
                  </span>
                  <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
                    <span>{data.count} events</span>
                    {data.deductions > 0 && (
                      <span className="font-medium text-rose-500">
                        -{data.deductions}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Transaction History & Audit Ledger */}
      <Card className="p-4 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Reward Points Audit Ledger
            </h3>
            <p className="text-xs text-slate-500">
              Every addition, penalty deduction and manual adjustment with transparent reasons.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Filter by Type */}
            <div className="inline-flex rounded-lg border border-slate-200 p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setTypeFilter("ALL")}
                className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                  typeFilter === "ALL"
                    ? "bg-slate-900 text-white"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setTypeFilter("DEDUCTIONS")}
                className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                  typeFilter === "DEDUCTIONS"
                    ? "bg-rose-600 text-white"
                    : "text-slate-600 hover:text-rose-600"
                }`}
              >
                Deductions
              </button>
              <button
                type="button"
                onClick={() => setTypeFilter("REWARDS")}
                className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                  typeFilter === "REWARDS"
                    ? "bg-emerald-600 text-white"
                    : "text-slate-600 hover:text-emerald-600"
                }`}
              >
                Additions
              </button>
            </div>

            {/* Clear category filter button if active */}
            {selectedCategory !== "ALL" && (
              <Button
                variant="outline"
                size="sm"
                icon="close"
                onClick={() => setSelectedCategory("ALL")}
              >
                Clear Category
              </Button>
            )}
          </div>
        </div>

        {/* Search bar */}
        <div className="mt-4">
          <div className="relative">
            <Icon
              name="search"
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              placeholder="Search by activity, rule or explanation..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-4 text-xs placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Ledger List */}
        <div className="mt-4 divide-y divide-slate-100">
          {filteredTransactions.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-500">
              No transactions found matching your current filter.
            </div>
          ) : (
            filteredTransactions.map((tx) => {
              const meta = CATEGORY_META[tx.category as RewardCategory] || {
                label: tx.category,
                icon: "award",
                tone: "slate",
              };
              const isNegative = tx.points < 0;

              return (
                <div
                  key={tx.id}
                  className="flex flex-col gap-2 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                        isNegative
                          ? "bg-rose-50 text-rose-600"
                          : "bg-emerald-50 text-emerald-600"
                      }`}
                    >
                      <Icon name={meta.icon} className="h-4 w-4" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-bold text-slate-900">
                          {tx.rule?.name || tx.ruleCode}
                        </span>
                        <Badge tone={meta.tone}>
                          {meta.label}
                        </Badge>
                        {tx.isManual && (
                          <Badge tone="amber">
                            Manual Adjustment {tx.actor?.name ? `(${tx.actor.name})` : ""}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-slate-600">{tx.reason}</p>
                      <span className="block text-[11px] text-slate-400">
                        {new Date(tx.createdAt).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  </div>

                  {/* Points Impact and Balance */}
                  <div className="flex shrink-0 items-center justify-between sm:flex-col sm:items-end">
                    <span
                      className={`text-sm font-extrabold ${
                        isNegative ? "text-rose-600" : "text-emerald-600"
                      }`}
                    >
                      {isNegative ? `${tx.points}` : `+${tx.points}`} pts
                    </span>
                    <span className="text-[11px] font-medium text-slate-500">
                      Balance: {tx.newScore}%
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </Card>

      {/* Info / Transparency Modal */}
      <Modal
        open={infoModalOpen}
        onClose={() => setInfoModalOpen(false)}
        title="How Reward Points Work"
      >
        <div className="space-y-4 text-xs text-slate-600">
          <p>
            The KreateUp DesignSeries dynamic scoring system evaluates institutional excellence based on active portal engagement:
          </p>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2">
            <h4 className="font-bold text-slate-900">Current Scoring Policy:</h4>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div>
                <span className="text-slate-500">Base Score:</span>{" "}
                <span className="font-semibold text-slate-800">{summary.baseScore}%</span>
              </div>
              <div>
                <span className="text-slate-500">Max Score:</span>{" "}
                <span className="font-semibold text-slate-800">{summary.maxScore}%</span>
              </div>
              <div>
                <span className="text-slate-500">Period:</span>{" "}
                <span className="font-semibold text-slate-800">{summary.policy.periodType}</span>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="font-bold text-slate-900">Active Scoring Rules:</h4>
            <div className="max-h-60 overflow-y-auto space-y-2 divide-y divide-slate-100 pr-1">
              {summary.policy.rules.map((rule) => (
                <div key={rule.id} className="pt-2 text-[11px] flex items-start justify-between">
                  <div>
                    <span className="font-semibold text-slate-800">{rule.name}</span>
                    <p className="text-slate-500">{rule.description}</p>
                  </div>
                  <span
                    className={`ml-2 shrink-0 font-bold ${
                      rule.type === "DEDUCTION" ? "text-rose-600" : "text-emerald-600"
                    }`}
                  >
                    {rule.type === "DEDUCTION" ? `-${rule.points}%` : `+${rule.points}%`}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <p className="text-[11px] text-slate-500">
            Points are recalculated against verified website activities. If you spot an irregularity, you can request clarification through the Help & Support module.
          </p>
        </div>
      </Modal>
    </div>
  );
}
