"use client";

import { useState, useTransition } from "react";
import Link from "next/link";

import { PageHeader } from "@/components/shell/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { Icon, type IconName } from "@/components/ui/Icon";
import { ProgressBar } from "@/components/ui/Progress";
import { StatTile } from "@/components/ui/StatTile";
import { Table, TableWrap, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { useToast } from "@/components/ui/Toast";
import type { RewardCategory } from "@/lib/rewards-engine";

type Rule = {
  id: string;
  policyId?: string | null;
  code: string;
  name: string;
  category: string;
  type: string;
  points: number;
  isPercentage: boolean;
  isEnabled: boolean;
  description: string;
  maxDeductionsPerPeriod?: number | null;
  gracePeriodDays: number;
};

type Policy = {
  id: string;
  name: string;
  baseScore: number;
  maxScore: number;
  minScore: number;
  isActive: boolean;
  periodType: string;
  startDate?: string | null;
  endDate?: string | null;
  description: string;
  rules: Rule[];
};

type UserRow = {
  id: string;
  name: string;
  rollNo: string;
  department: string;
  year: string;
  domain: string;
  rewardPoints: number;
  rewardPointsEnabled: boolean;
  portalNavDisabled?: string;
};

type AdminData = {
  policy: Policy;
  summary: {
    totalStudents: number;
    averageScore: number;
    maxScore: number;
    minScore: number;
    goodStandingPercent: number;
    distribution: {
      outstanding: number;
      good: number;
      satisfactory: number;
      atRisk: number;
    };
  };
  departmentAnalytics: Array<{
    department: string;
    count: number;
    averageScore: number;
    atRiskCount: number;
  }>;
  commonDeductions: Array<{
    code: string;
    name: string;
    count: number;
    totalDeducted: number;
  }>;
  users: UserRow[];
  recentTransactions: Array<{
    id: string;
    userId: string;
    ruleCode: string;
    category: string;
    type: string;
    points: number;
    previousScore: number;
    newScore: number;
    reason: string;
    isManual: boolean;
    createdAt: Date | string;
    user: { name: string; rollNo: string; department: string };
    rule?: { name: string; code: string } | null;
    actor?: { name: string; role: string } | null;
  }>;
};

const CATEGORIES: RewardCategory[] = [
  "ATTENDANCE",
  "WORKLOG",
  "TASK",
  "LEAVE",
  "ON_DUTY",
  "OTHER",
];

export function AdminRewardsClient({
  user,
  initialData,
}: {
  user: { id: string; name: string; role: string };
  initialData: AdminData;
}) {
  const toast = useToast();
  const [data, setData] = useState<AdminData>(initialData);
  const [activeTab, setActiveTab] = useState<"students" | "analytics" | "rules" | "ledger">("students");
  const [isPending, startTransition] = useTransition();

  // Search & Filter for Students tab
  const [searchStudent, setSearchStudent] = useState("");
  const [filterDept, setFilterDept] = useState("ALL");
  const [filterScoreTier, setFilterScoreTier] = useState("ALL");

  // Manual Adjust Modal
  const [adjustModalOpen, setAdjustModalOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<UserRow | null>(null);
  const [adjustPoints, setAdjustPoints] = useState<number>(-5);
  const [adjustReason, setAdjustReason] = useState("");
  const [isSubmittingAdjust, setIsSubmittingAdjust] = useState(false);

  // Policy Settings Modal
  const [policyModalOpen, setPolicyModalOpen] = useState(false);
  const [policyBaseScore, setPolicyBaseScore] = useState(data.policy.baseScore);
  const [policyMaxScore, setPolicyMaxScore] = useState(data.policy.maxScore);
  const [policyPeriodType, setPolicyPeriodType] = useState(data.policy.periodType);
  const [isSavingPolicy, setIsSavingPolicy] = useState(false);

  // Edit Rule Modal
  const [ruleModalOpen, setRuleModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<Rule | null>(null);
  const [editRulePoints, setEditRulePoints] = useState<number>(0);
  const [editRuleDesc, setEditRuleDesc] = useState("");
  const [isSavingRule, setIsSavingRule] = useState(false);

  // Add Custom Rule Modal
  const [addRuleModalOpen, setAddRuleModalOpen] = useState(false);
  const [newRuleCode, setNewRuleCode] = useState("");
  const [newRuleName, setNewRuleName] = useState("");
  const [newRuleCategory, setNewRuleCategory] = useState<RewardCategory>("WORKLOG");
  const [newRuleType, setNewRuleType] = useState<"DEDUCTION" | "REWARD">("DEDUCTION");
  const [newRulePoints, setNewRulePoints] = useState<number>(3);
  const [newRuleDesc, setNewRuleDesc] = useState("");
  const [isAddingRule, setIsAddingRule] = useState(false);

  // Refresh data
  const refreshData = async () => {
    try {
      const res = await fetch("/api/admin/rewards");
      const json = await res.json();
      if (json.ok) {
        setData(json.data);
      }
    } catch {
      toast.error("Failed to reload data");
    }
  };

  // Recalculate All
  const handleRecalculateAll = () => {
    if (!confirm("Are you sure you want to recalculate reward points for all active students? This will re-evaluate attendance, worklogs, tasks, and leaves.")) {
      return;
    }
    startTransition(async () => {
      try {
        const res = await fetch("/api/admin/rewards/recalculate", { method: "POST" });
        const json = await res.json();
        if (json.ok) {
          toast.success(`Successfully recalculated reward points for ${json.data.totalRecalculated} students.`);
          await refreshData();
        } else {
          toast.error(json.error || "Recalculation failed");
        }
      } catch {
        toast.error("Recalculation error");
      }
    });
  };

  // Toggle Rule Enable/Disable
  const handleToggleRule = async (rule: Rule) => {
    const updated = !rule.isEnabled;
    try {
      const res = await fetch("/api/admin/rewards/rules", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: rule.id, isEnabled: updated }),
      });
      const json = await res.json();
      if (json.ok) {
        toast.success(`Rule "${rule.name}" is now ${updated ? "enabled" : "disabled"}.`);
        await refreshData();
      } else {
        toast.error(json.error || "Failed to update rule");
      }
    } catch {
      toast.error("Error updating rule");
    }
  };

  // Submit Rule Edit
  const handleSaveRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRule) return;
    setIsSavingRule(true);
    try {
      const res = await fetch("/api/admin/rewards/rules", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingRule.id,
          points: editRulePoints,
          description: editRuleDesc,
        }),
      });
      const json = await res.json();
      if (json.ok) {
        toast.success("Rule updated successfully.");
        setRuleModalOpen(false);
        await refreshData();
      } else {
        toast.error(json.error || "Failed to save rule");
      }
    } catch {
      toast.error("Error saving rule");
    } finally {
      setIsSavingRule(false);
    }
  };

  // Submit Add Rule
  const handleAddRule = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAddingRule(true);
    try {
      const res = await fetch("/api/admin/rewards/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: newRuleCode.trim().toUpperCase(),
          name: newRuleName.trim(),
          category: newRuleCategory,
          type: newRuleType,
          points: newRulePoints,
          description: newRuleDesc.trim(),
        }),
      });
      const json = await res.json();
      if (json.ok) {
        toast.success("New rule created successfully.");
        setAddRuleModalOpen(false);
        setNewRuleCode("");
        setNewRuleName("");
        setNewRuleDesc("");
        await refreshData();
      } else {
        toast.error(json.error || "Failed to create rule");
      }
    } catch {
      toast.error("Error creating rule");
    } finally {
      setIsAddingRule(false);
    }
  };

  // Submit Policy Settings
  const handleSavePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingPolicy(true);
    try {
      const res = await fetch("/api/admin/rewards/policy", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: data.policy.id,
          baseScore: policyBaseScore,
          maxScore: policyMaxScore,
          periodType: policyPeriodType,
        }),
      });
      const json = await res.json();
      if (json.ok) {
        toast.success("Scoring policy settings updated.");
        setPolicyModalOpen(false);
        await refreshData();
      } else {
        toast.error(json.error || "Failed to update policy");
      }
    } catch {
      toast.error("Error updating policy");
    } finally {
      setIsSavingPolicy(false);
    }
  };

  // Submit Manual Adjustment
  const handleManualAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent) return;
    if (!adjustReason.trim() || adjustReason.trim().length < 5) {
      toast.error("Please provide an audit reason of at least 5 characters.");
      return;
    }
    setIsSubmittingAdjust(true);
    try {
      const res = await fetch("/api/admin/rewards/adjust", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: selectedStudent.id,
          points: adjustPoints,
          reason: adjustReason.trim(),
        }),
      });
      const json = await res.json();
      if (json.ok) {
        toast.success(`Adjusted points for ${selectedStudent.name}. New score: ${json.data.newScore}%`);
        setAdjustModalOpen(false);
        setSelectedStudent(null);
        setAdjustReason("");
        await refreshData();
      } else {
        toast.error(json.error || "Adjustment failed");
      }
    } catch {
      toast.error("Error applying adjustment");
    } finally {
      setIsSubmittingAdjust(false);
    }
  };

  // Unique departments for filter
  const departments = Array.from(new Set(data.users.map((u) => u.department).filter(Boolean)));

  // Filter students
  const filteredUsers = data.users.filter((u) => {
    if (filterDept !== "ALL" && u.department !== filterDept) return false;
    if (filterScoreTier === "OUTSTANDING" && u.rewardPoints < 95) return false;
    if (filterScoreTier === "GOOD" && (u.rewardPoints < 80 || u.rewardPoints >= 95)) return false;
    if (filterScoreTier === "SATISFACTORY" && (u.rewardPoints < 65 || u.rewardPoints >= 80)) return false;
    if (filterScoreTier === "AT_RISK" && u.rewardPoints >= 65) return false;
    if (searchStudent.trim()) {
      const q = searchStudent.toLowerCase();
      const matchName = u.name.toLowerCase().includes(q);
      const matchRoll = u.rollNo.toLowerCase().includes(q);
      if (!matchName && !matchRoll) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <PageHeader
        title="Reward Points & Performance Management"
        description="Centralized policy engine to configure activity deductions, track cohort scores, audit points movements, and adjust student performance standings."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              icon="refresh"
              loading={isPending}
              onClick={handleRecalculateAll}
            >
              Recalculate All
            </Button>
            <Button
              variant="outline"
              size="sm"
              icon="settings"
              onClick={() => setPolicyModalOpen(true)}
            >
              Policy Settings
            </Button>
            <a href="/api/admin/rewards/export?type=summary" download>
              <Button variant="outline" size="sm" icon="download">
                Export Scores
              </Button>
            </a>
            <a href="/api/admin/rewards/export?type=ledger" download>
              <Button variant="outline" size="sm" icon="download">
                Export Ledger
              </Button>
            </a>
          </div>
        }
      />

      {/* Top Stat Tiles */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        <StatTile
          label="Average Score"
          value={`${data.summary.averageScore}%`}
          tone={data.summary.averageScore >= 80 ? "green" : "amber"}
          caption={`${data.summary.goodStandingPercent}% in good standing`}
        />
        <StatTile
          label="Score Range"
          value={`${data.summary.minScore}% – ${data.summary.maxScore}%`}
          tone="blue"
          caption="Current cohort spread"
        />
        <StatTile
          label="At Risk (<65%)"
          value={data.summary.distribution.atRisk}
          tone={data.summary.distribution.atRisk > 0 ? "red" : "green"}
          caption="Need performance review"
        />
        <StatTile
          label="Active Rules"
          value={data.policy.rules.filter((r) => r.isEnabled).length}
          tone="slate"
          caption={`${data.policy.rules.length} configured rules`}
        />
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-slate-200">
        <div className="flex gap-4">
          <button
            type="button"
            onClick={() => setActiveTab("students")}
            className={`flex items-center gap-2 border-b-2 pb-3 pt-1 text-sm font-semibold transition-colors ${
              activeTab === "students"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Icon name="users" className="h-4 w-4" />
            <span>Student Standings ({data.users.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("analytics")}
            className={`flex items-center gap-2 border-b-2 pb-3 pt-1 text-sm font-semibold transition-colors ${
              activeTab === "analytics"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Icon name="chart" className="h-4 w-4" />
            <span>Department & Risk Analytics</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("rules")}
            className={`flex items-center gap-2 border-b-2 pb-3 pt-1 text-sm font-semibold transition-colors ${
              activeTab === "rules"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Icon name="settings" className="h-4 w-4" />
            <span>Rule Configuration ({data.policy.rules.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("ledger")}
            className={`flex items-center gap-2 border-b-2 pb-3 pt-1 text-sm font-semibold transition-colors ${
              activeTab === "ledger"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Icon name="layers" className="h-4 w-4" />
            <span>Global Audit Ledger</span>
          </button>
        </div>
      </div>

      {/* TAB 1: Student Standings */}
      {activeTab === "students" && (
        <Card className="p-4 sm:p-6 space-y-4">
          {/* Filters Bar */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 max-w-sm">
              <Icon
                name="search"
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                placeholder="Search by student name or roll number..."
                value={searchStudent}
                onChange={(e) => setSearchStudent(e.target.value)}
                className="w-full rounded-lg border border-slate-200 py-1.5 pl-9 pr-3 text-xs placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={filterDept}
                onChange={(e) => setFilterDept(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 focus:border-blue-500 focus:outline-none"
              >
                <option value="ALL">All Departments</option>
                {departments.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>

              <select
                value={filterScoreTier}
                onChange={(e) => setFilterScoreTier(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 focus:border-blue-500 focus:outline-none"
              >
                <option value="ALL">All Standing Tiers</option>
                <option value="OUTSTANDING">Outstanding (95-100%)</option>
                <option value="GOOD">Good Standing (80-94%)</option>
                <option value="SATISFACTORY">Satisfactory (65-79%)</option>
                <option value="AT_RISK">At Risk (&lt;65%)</option>
              </select>
            </div>
          </div>

          {/* Table */}
          <TableWrap>
            <Table>
              <THead>
                <TR>
                  <TH>Student</TH>
                  <TH>Department / Year</TH>
                  <TH>Domain</TH>
                  <TH numeric>Score (%)</TH>
                  <TH>Standing</TH>
                  <TH>Feature Access</TH>
                  <TH numeric>Actions</TH>
                </TR>
              </THead>
              <TBody>
                {filteredUsers.length === 0 ? (
                  <TR>
                    <TD colSpan={7} className="text-center py-8 text-slate-500">
                      No students found matching current filters.
                    </TD>
                  </TR>
                ) : (
                  filteredUsers.map((u) => {
                    const isFeatureDisabled =
                      u.rewardPointsEnabled === false ||
                      (u.portalNavDisabled || "").split(",").map((s) => s.trim().toLowerCase()).includes("rewards");

                    let tierTone: "green" | "blue" | "amber" | "red" = "blue";
                    let tierText = "Good (80-94%)";
                    if (u.rewardPoints >= 95) {
                      tierTone = "green";
                      tierText = "Outstanding";
                    } else if (u.rewardPoints >= 80) {
                      tierTone = "blue";
                      tierText = "Good Standing";
                    } else if (u.rewardPoints >= 65) {
                      tierTone = "amber";
                      tierText = "Satisfactory";
                    } else {
                      tierTone = "red";
                      tierText = "At Risk";
                    }

                    return (
                      <TR key={u.id}>
                        <TD>
                          <div>
                            <span className="font-semibold text-slate-900 block">{u.name}</span>
                            <span className="text-[11px] text-slate-500 font-mono">{u.rollNo}</span>
                          </div>
                        </TD>
                        <TD>
                          <span className="text-xs text-slate-700 block">{u.department || "—"}</span>
                          <span className="text-[11px] text-slate-400">{u.year || "—"}</span>
                        </TD>
                        <TD>
                          <span className="text-xs text-slate-600">{u.domain || "General"}</span>
                        </TD>
                        <TD numeric>
                          <span className="text-sm font-extrabold text-slate-900">
                            {u.rewardPoints}%
                          </span>
                        </TD>
                        <TD>
                          <Badge tone={tierTone}>
                            {tierText}
                          </Badge>
                        </TD>
                        <TD>
                          <Badge tone={isFeatureDisabled ? "red" : "green"}>
                            {isFeatureDisabled ? "Disabled" : "Active"}
                          </Badge>
                        </TD>
                        <TD numeric>
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedStudent(u);
                                setAdjustPoints(-5);
                                setAdjustReason("");
                                setAdjustModalOpen(true);
                              }}
                            >
                              Adjust Points
                            </Button>
                            <Link href={`/console/people/${u.id}`}>
                              <Button variant="ghost" size="sm" icon="user" />
                            </Link>
                          </div>
                        </TD>
                      </TR>
                    );
                  })
                )}
              </TBody>
            </Table>
          </TableWrap>
        </Card>
      )}

      {/* TAB 2: Department & Risk Analytics */}
      {activeTab === "analytics" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Department Breakdown */}
            <Card className="p-4 sm:p-6 space-y-4">
              <h3 className="text-base font-bold text-slate-900">
                Department Performance Averages
              </h3>
              <div className="space-y-3">
                {data.departmentAnalytics.map((dept) => (
                  <div key={dept.department} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-800">
                        {dept.department} ({dept.count} students)
                      </span>
                      <div className="flex items-center gap-2">
                        {dept.atRiskCount > 0 && (
                          <span className="text-[11px] font-bold text-rose-600">
                            {dept.atRiskCount} at risk
                          </span>
                        )}
                        <span className="font-bold text-slate-900">
                          {dept.averageScore}%
                        </span>
                      </div>
                    </div>
                    <ProgressBar
                      value={dept.averageScore}
                      tone={dept.averageScore >= 80 ? "green" : dept.averageScore >= 65 ? "amber" : "red"}
                    />
                  </div>
                ))}
              </div>
            </Card>

            {/* Common Deductions */}
            <Card className="p-4 sm:p-6 space-y-4">
              <h3 className="text-base font-bold text-slate-900">
                Most Frequent Deduction Violations
              </h3>
              <div className="divide-y divide-slate-100">
                {data.commonDeductions.length === 0 ? (
                  <p className="py-6 text-center text-xs text-slate-500">
                    No deductions logged yet.
                  </p>
                ) : (
                  data.commonDeductions.map((d) => (
                    <div key={d.code} className="flex items-center justify-between py-2.5 text-xs">
                      <div>
                        <span className="font-semibold text-slate-800 block">
                          {d.name}
                        </span>
                        <span className="text-[11px] text-slate-400 font-mono">
                          {d.code}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-rose-600 block">
                          -{d.totalDeducted} pts total
                        </span>
                        <span className="text-[11px] text-slate-500">
                          {d.count} occurrences
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </div>

          {/* Performance Distribution */}
          <Card className="p-4 sm:p-6">
            <h3 className="text-base font-bold text-slate-900 mb-3">
              Score Distribution Overview
            </h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-4">
                <span className="text-xs font-semibold text-emerald-800">Outstanding (95-100%)</span>
                <span className="mt-1 block text-2xl font-extrabold text-emerald-900">
                  {data.summary.distribution.outstanding}
                </span>
                <span className="text-[11px] text-emerald-700">Top performers</span>
              </div>
              <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4">
                <span className="text-xs font-semibold text-blue-800">Good Standing (80-94%)</span>
                <span className="mt-1 block text-2xl font-extrabold text-blue-900">
                  {data.summary.distribution.good}
                </span>
                <span className="text-[11px] text-blue-700">Full compliance</span>
              </div>
              <div className="rounded-xl border border-amber-100 bg-amber-50/50 p-4">
                <span className="text-xs font-semibold text-amber-800">Satisfactory (65-79%)</span>
                <span className="mt-1 block text-2xl font-extrabold text-amber-900">
                  {data.summary.distribution.satisfactory}
                </span>
                <span className="text-[11px] text-amber-700">Minor deductions</span>
              </div>
              <div className="rounded-xl border border-rose-100 bg-rose-50/50 p-4">
                <span className="text-xs font-semibold text-rose-800">Action Required (&lt;65%)</span>
                <span className="mt-1 block text-2xl font-extrabold text-rose-900">
                  {data.summary.distribution.atRisk}
                </span>
                <span className="text-[11px] text-rose-700">Attendance/worklog alerts</span>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* TAB 3: Rule Configuration */}
      {activeTab === "rules" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Dynamic Activity Rules
              </h3>
              <p className="text-xs text-slate-500">
                Enable or disable rules instantly, or adjust point deductions and reward credits without modifying code.
              </p>
            </div>
            <Button size="sm" icon="plus" onClick={() => setAddRuleModalOpen(true)}>
              Add Custom Rule
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {CATEGORIES.map((category) => {
              const categoryRules = data.policy.rules.filter((r) => r.category === category);
              if (categoryRules.length === 0) return null;

              return (
                <Card key={category} className="p-4 sm:p-5 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                      {category} Rules
                    </span>
                    <Badge tone="slate">
                      {categoryRules.length} rules
                    </Badge>
                  </div>

                  <div className="divide-y divide-slate-100">
                    {categoryRules.map((rule) => (
                      <div key={rule.id} className="py-2.5 flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-900">
                              {rule.name}
                            </span>
                            <span
                              className={`text-[11px] font-extrabold ${
                                rule.type === "DEDUCTION" ? "text-rose-600" : "text-emerald-600"
                              }`}
                            >
                              {rule.type === "DEDUCTION" ? `-${rule.points}%` : `+${rule.points}%`}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500">
                            {rule.description || "No description provided."}
                          </p>
                          <span className="font-mono text-[10px] text-slate-400">
                            {rule.code}
                          </span>
                        </div>

                        <div className="flex shrink-0 items-center gap-1.5 pt-0.5">
                          {/* Toggle switch */}
                          <button
                            type="button"
                            onClick={() => handleToggleRule(rule)}
                            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                              rule.isEnabled ? "bg-blue-600" : "bg-slate-200"
                            }`}
                          >
                            <span
                              className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                rule.isEnabled ? "translate-x-4" : "translate-x-0"
                              }`}
                            />
                          </button>

                          <Button
                            variant="ghost"
                            size="sm"
                            icon="edit"
                            onClick={() => {
                              setEditingRule(rule);
                              setEditRulePoints(rule.points);
                              setEditRuleDesc(rule.description);
                              setRuleModalOpen(true);
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 4: Global Audit Ledger */}
      {activeTab === "ledger" && (
        <Card className="p-4 sm:p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Immutable Transaction Log
              </h3>
              <p className="text-xs text-slate-500">
                Traceable history of all additions, deductions and manual adjustments with original actor and timestamps.
              </p>
            </div>
            <a href="/api/admin/rewards/export?type=ledger" download>
              <Button variant="outline" size="sm" icon="download">
                Export Ledger (CSV)
              </Button>
            </a>
          </div>

          <div className="divide-y divide-slate-100">
            {data.recentTransactions.length === 0 ? (
              <p className="py-8 text-center text-xs text-slate-500">
                No transactions recorded yet.
              </p>
            ) : (
              data.recentTransactions.map((tx) => {
                const isNegative = tx.points < 0;
                return (
                  <div
                    key={tx.id}
                    className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between text-xs"
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-slate-900">
                          {tx.user?.name}
                        </span>
                        <span className="text-[11px] font-mono text-slate-400">
                          ({tx.user?.rollNo})
                        </span>
                        <Badge tone="slate">
                          {tx.category}
                        </Badge>
                        {tx.isManual && (
                          <Badge tone="amber">
                            Manual · Adjusted by {tx.actor?.name || "Staff"}
                          </Badge>
                        )}
                      </div>
                      <p className="text-slate-600">{tx.reason}</p>
                      <span className="text-[11px] text-slate-400">
                        {new Date(tx.createdAt).toLocaleString("en-IN")}
                      </span>
                    </div>

                    <div className="text-right shrink-0">
                      <span
                        className={`font-extrabold text-sm block ${
                          isNegative ? "text-rose-600" : "text-emerald-600"
                        }`}
                      >
                        {isNegative ? `${tx.points}` : `+${tx.points}`} pts
                      </span>
                      <span className="text-[11px] text-slate-500">
                        {tx.previousScore}% → {tx.newScore}%
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Card>
      )}

      {/* Manual Point Adjustment Modal */}
      <Modal
        open={adjustModalOpen}
        onClose={() => setAdjustModalOpen(false)}
        title={`Adjust Reward Points: ${selectedStudent?.name || ""}`}
      >
        {selectedStudent && (
          <form onSubmit={handleManualAdjust} className="space-y-4">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">Current Score:</span>
                <span className="font-bold text-slate-800">{selectedStudent.rewardPoints}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Roll Number:</span>
                <span className="font-mono text-slate-700">{selectedStudent.rollNo}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Department:</span>
                <span className="text-slate-700">{selectedStudent.department}</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Points Adjustment (+ to credit, - to deduct)
              </label>
              <input
                type="number"
                value={adjustPoints}
                onChange={(e) => setAdjustPoints(parseInt(e.target.value, 10) || 0)}
                className="w-full rounded-lg border border-slate-200 p-2 text-xs focus:border-blue-500 focus:outline-none"
                placeholder="e.g. -5 or 10"
                required
              />
              <span className="mt-1 block text-[11px] text-slate-500">
                Projected New Score:{" "}
                <span className="font-bold text-slate-800">
                  {Math.max(
                    data.policy.minScore,
                    Math.min(data.policy.maxScore, selectedStudent.rewardPoints + adjustPoints)
                  )}
                  %
                </span>
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Mandatory Audit Reason (min 5 characters)
              </label>
              <textarea
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
                rows={3}
                className="w-full rounded-lg border border-slate-200 p-2 text-xs focus:border-blue-500 focus:outline-none"
                placeholder="Explain why points are being adjusted. The student will receive an in-app notice with this explanation."
                required
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setAdjustModalOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" loading={isSubmittingAdjust}>
                Apply Adjustment
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Policy Settings Modal */}
      <Modal
        open={policyModalOpen}
        onClose={() => setPolicyModalOpen(false)}
        title="Reward Policy Settings"
      >
        <form onSubmit={handleSavePolicy} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Base Starting Score (%)
            </label>
            <input
              type="number"
              value={policyBaseScore}
              onChange={(e) => setPolicyBaseScore(parseInt(e.target.value, 10) || 100)}
              className="w-full rounded-lg border border-slate-200 p-2 text-xs focus:border-blue-500 focus:outline-none"
              required
            />
            <span className="text-[11px] text-slate-500">
              Default score every student begins with (normally 100%).
            </span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Maximum Score Cap (%)
            </label>
            <input
              type="number"
              value={policyMaxScore}
              onChange={(e) => setPolicyMaxScore(parseInt(e.target.value, 10) || 100)}
              className="w-full rounded-lg border border-slate-200 p-2 text-xs focus:border-blue-500 focus:outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Reward Period Type
            </label>
            <select
              value={policyPeriodType}
              onChange={(e) => setPolicyPeriodType(e.target.value)}
              className="w-full rounded-lg border border-slate-200 p-2 text-xs focus:border-blue-500 focus:outline-none"
            >
              <option value="MONTHLY">Monthly</option>
              <option value="SEMESTER">Semester-wise</option>
              <option value="ANNUAL">Annual</option>
              <option value="CUSTOM">Custom Range</option>
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPolicyModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" loading={isSavingPolicy}>
              Save Policy
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Rule Modal */}
      <Modal
        open={ruleModalOpen}
        onClose={() => setRuleModalOpen(false)}
        title={`Edit Rule: ${editingRule?.name || ""}`}
      >
        {editingRule && (
          <form onSubmit={handleSaveRule} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Point Value ({editingRule.type === "DEDUCTION" ? "Percentage Points Deducted" : "Percentage Points Awarded"})
              </label>
              <input
                type="number"
                value={editRulePoints}
                onChange={(e) => setEditRulePoints(parseInt(e.target.value, 10) || 0)}
                className="w-full rounded-lg border border-slate-200 p-2 text-xs focus:border-blue-500 focus:outline-none"
                min={0}
                max={100}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Description / Policy Explanation
              </label>
              <textarea
                value={editRuleDesc}
                onChange={(e) => setEditRuleDesc(e.target.value)}
                rows={3}
                className="w-full rounded-lg border border-slate-200 p-2 text-xs focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setRuleModalOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" loading={isSavingRule}>
                Save Changes
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Add Custom Rule Modal */}
      <Modal
        open={addRuleModalOpen}
        onClose={() => setAddRuleModalOpen(false)}
        title="Add Custom Reward Rule"
      >
        <form onSubmit={handleAddRule} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Rule Code (UPPERCASE with underscores, e.g. WORKSHOP_ATTENDED)
            </label>
            <input
              type="text"
              value={newRuleCode}
              onChange={(e) => setNewRuleCode(e.target.value.toUpperCase())}
              className="w-full rounded-lg border border-slate-200 p-2 text-xs font-mono focus:border-blue-500 focus:outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Display Name
            </label>
            <input
              type="text"
              value={newRuleName}
              onChange={(e) => setNewRuleName(e.target.value)}
              className="w-full rounded-lg border border-slate-200 p-2 text-xs focus:border-blue-500 focus:outline-none"
              placeholder="e.g. Design Critique Attendance"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Category
              </label>
              <select
                value={newRuleCategory}
                onChange={(e) => setNewRuleCategory(e.target.value as RewardCategory)}
                className="w-full rounded-lg border border-slate-200 p-2 text-xs focus:border-blue-500 focus:outline-none"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Type
              </label>
              <select
                value={newRuleType}
                onChange={(e) => setNewRuleType(e.target.value as "DEDUCTION" | "REWARD")}
                className="w-full rounded-lg border border-slate-200 p-2 text-xs focus:border-blue-500 focus:outline-none"
              >
                <option value="DEDUCTION">Deduction (-)</option>
                <option value="REWARD">Reward (+)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Points
            </label>
            <input
              type="number"
              value={newRulePoints}
              onChange={(e) => setNewRulePoints(parseInt(e.target.value, 10) || 0)}
              className="w-full rounded-lg border border-slate-200 p-2 text-xs focus:border-blue-500 focus:outline-none"
              min={0}
              max={100}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Description
            </label>
            <textarea
              value={newRuleDesc}
              onChange={(e) => setNewRuleDesc(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-slate-200 p-2 text-xs focus:border-blue-500 focus:outline-none"
              placeholder="Explain the criteria for this rule..."
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setAddRuleModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" loading={isAddingRule}>
              Create Rule
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
