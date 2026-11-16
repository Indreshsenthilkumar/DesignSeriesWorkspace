"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";

import { PageHeader } from "@/components/shell/PageHeader";
import { Badge, type Tone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { Icon, type IconName } from "@/components/ui/Icon";
import { ProgressBar } from "@/components/ui/Progress";
import { StatTile } from "@/components/ui/StatTile";
import { Table, TableWrap, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { Field, Input, Select } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { formatDay, relativeTime } from "@/lib/dates";
import type { RewardCategory } from "@/lib/rewards-engine";

export type CustomRule = {
  id: string;
  policyId?: string | null;
  code: string;
  name: string;
  category: string;
  subCategory?: string | null;
  type: string;
  points: number;
  isPercentage: boolean;
  isEnabled: boolean;
  description: string;
  maxDeductionsPerPeriod?: number | null;
  gracePeriodDays: number;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
  scheduledDates?: string;
  configJson?: string;
};

export type ScheduledHoliday = {
  id: string;
  date: string;
  title: string;
  category: string;
  description: string;
};

type Policy = {
  id: string;
  name: string;
  baseScore: number;
  maxScore: number;
  minScore: number;
  isActive: boolean;
  periodType: string;
  description: string;
  rules: CustomRule[];
};

type UserRow = {
  id: string;
  name: string;
  rollNo: string;
  department: string;
  year: string;
  domain: string;
  role?: string;
  rewardPoints: number;
  rewardPointsEnabled: boolean;
  portalNavDisabled?: string;
};

type AdminData = {
  policy: Policy;
  scheduledHolidays: ScheduledHoliday[];
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

const CATEGORIES: Array<{ key: RewardCategory; label: string; icon: IconName; tone: Tone }> = [
  { key: "LEAVE", label: "Leave Management", icon: "calendar", tone: "red" },
  { key: "WORKLOG", label: "Worklog Management", icon: "clipboard", tone: "blue" },
  { key: "ATTENDANCE", label: "Attendance & OTP", icon: "check-circle", tone: "green" },
  { key: "LINKEDIN", label: "LinkedIn Tracker", icon: "linkedin", tone: "blue" },
  { key: "ON_DUTY", label: "On-Duty Passes", icon: "ticket", tone: "slate" },
  { key: "TASK", label: "Sprint Tasks", icon: "target", tone: "amber" },
  { key: "OTHER", label: "Custom Activities", icon: "award", tone: "slate" },
];

const SUBCATEGORIES_BY_CATEGORY: Record<string, Array<{ key: string; label: string; defaultPoints: number; defaultType: "DEDUCTION" | "REWARD"; defaultGrace?: number }>> = {
  LEAVE: [
    { key: "ALL_LEAVES", label: "All Approved Leaves (Exceeding Allowance)", defaultPoints: 3, defaultType: "DEDUCTION", defaultGrace: 2 },
    { key: "CASUAL", label: "Casual Leave (Exceeding Allowance)", defaultPoints: 3, defaultType: "DEDUCTION", defaultGrace: 2 },
    { key: "SICK", label: "Sick / Medical Leave (Exceeding Allowance)", defaultPoints: 2, defaultType: "DEDUCTION", defaultGrace: 3 },
    { key: "PERSONAL", label: "Personal / Family Leave", defaultPoints: 4, defaultType: "DEDUCTION", defaultGrace: 1 },
    { key: "ON_DUTY", label: "On-Duty Academic Leave", defaultPoints: 1, defaultType: "REWARD", defaultGrace: 0 },
    { key: "UNAPPROVED", label: "Unapproved / Rejected Leave Request", defaultPoints: 5, defaultType: "DEDUCTION", defaultGrace: 0 },
  ],
  WORKLOG: [
    { key: "MISSED_WORKLOG", label: "Failed to Submit Daily Worklog", defaultPoints: 5, defaultType: "DEDUCTION", defaultGrace: 1 },
    { key: "LATE_WORKLOG", label: "Late Worklog Submission (Past Deadline)", defaultPoints: 2, defaultType: "DEDUCTION", defaultGrace: 1 },
    { key: "INCOMPLETE_WORKLOG", label: "Incomplete Worklog (< 5 Slots Documented)", defaultPoints: 2, defaultType: "DEDUCTION", defaultGrace: 0 },
    { key: "FLAGGED_WORKLOG", label: "Worklog Flagged by Mentor for Revision", defaultPoints: 3, defaultType: "DEDUCTION", defaultGrace: 0 },
    { key: "ON_TIME_WORKLOG", label: "Worklog Submitted On Time (Positive Credit)", defaultPoints: 2, defaultType: "REWARD", defaultGrace: 0 },
  ],
  ATTENDANCE: [
    { key: "MISSED_ATTENDANCE", label: "Unaccounted Absence (0 Hours on Working Day)", defaultPoints: 5, defaultType: "DEDUCTION", defaultGrace: 0 },
    { key: "INCOMPLETE_ATTENDANCE", label: "Incomplete Attendance (< 7 Hours Marked)", defaultPoints: 2, defaultType: "DEDUCTION", defaultGrace: 0 },
    { key: "MISSED_OTP", label: "Missed OTP Attendance Verification", defaultPoints: 3, defaultType: "DEDUCTION", defaultGrace: 0 },
    { key: "FULL_DAY_ATTENDANCE", label: "Full Day Completed (7/7 Hours Check-In)", defaultPoints: 2, defaultType: "REWARD", defaultGrace: 0 },
  ],
  LINKEDIN: [
    { key: "SCHEDULED_LINKEDIN_MISSED", label: "Failed to Post on Scheduled LinkedIn Date", defaultPoints: 5, defaultType: "DEDUCTION", defaultGrace: 0 },
    { key: "SCHEDULED_LINKEDIN_SUBMITTED", label: "Verified Post on Scheduled LinkedIn Date", defaultPoints: 5, defaultType: "REWARD", defaultGrace: 0 },
    { key: "LINKEDIN_VERIFIED_ANY", label: "Any Verified Build-in-Public Post Bonus", defaultPoints: 10, defaultType: "REWARD", defaultGrace: 0 },
  ],
  ON_DUTY: [
    { key: "REJECTED_PASS", label: "Rejected On-Duty Request", defaultPoints: 3, defaultType: "DEDUCTION", defaultGrace: 0 },
    { key: "APPROVED_PASS", label: "Approved On-Duty Activity Bonus", defaultPoints: 1, defaultType: "REWARD", defaultGrace: 0 },
  ],
  TASK: [
    { key: "OVERDUE_TASK", label: "Overdue / Incomplete Task Passed Deadline", defaultPoints: 4, defaultType: "DEDUCTION", defaultGrace: 0 },
    { key: "COMPLETED_TASK_ON_TIME", label: "Sprint Task Completed On Time Bonus", defaultPoints: 5, defaultType: "REWARD", defaultGrace: 0 },
  ],
  OTHER: [
    { key: "CUSTOM_ACHIEVEMENT", label: "Special Institutional Achievement", defaultPoints: 5, defaultType: "REWARD", defaultGrace: 0 },
    { key: "CUSTOM_INFRACTION", label: "Custom Disciplinary Infraction", defaultPoints: 5, defaultType: "DEDUCTION", defaultGrace: 0 },
  ],
};

export function AdminRewardsClient({
  user,
  initialData,
}: {
  user: { id: string; name: string; role: string };
  initialData: AdminData;
}) {
  const toast = useToast();
  const [data, setData] = useState<AdminData>(initialData);
  const [activeTab, setActiveTab] = useState<"students" | "rules" | "holidays" | "analytics" | "ledger">("students");

  // Filter state for students roster
  const [studentSearch, setStudentSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("ALL");
  const [domainFilter, setDomainFilter] = useState("ALL");
  const [tierFilter, setTierFilter] = useState<"ALL" | "OUTSTANDING" | "GOOD" | "SATISFACTORY" | "AT_RISK">("ALL");

  // Modals state
  const [recalculating, setRecalculating] = useState(false);
  const [adjustModalOpen, setAdjustModalOpen] = useState(false);
  const [adjustTargetUser, setAdjustTargetUser] = useState<UserRow | null>(null);
  const [adjustPoints, setAdjustPoints] = useState<number>(0);
  const [adjustReason, setAdjustReason] = useState("");
  const [isAdjusting, setIsAdjusting] = useState(false);

  // Add / Edit Custom Rule state
  const [addRuleModalOpen, setAddRuleModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<CustomRule | null>(null);
  const [ruleModalOpen, setRuleModalOpen] = useState(false);

  // Form fields for Custom Rule
  const [formCategory, setFormCategory] = useState<RewardCategory>("LEAVE");
  const [formSubCategory, setFormSubCategory] = useState("ALL_LEAVES");
  const [formName, setFormName] = useState("");
  const [formCode, setFormCode] = useState("");
  const [formType, setFormType] = useState<"DEDUCTION" | "REWARD">("DEDUCTION");
  const [formPoints, setFormPoints] = useState<number>(3);
  const [formGraceDays, setFormGraceDays] = useState<number>(2); // Free leave allowance or grace count
  const [formEffectiveFrom, setFormEffectiveFrom] = useState<string>("");
  const [formEffectiveTo, setFormEffectiveTo] = useState<string>("");
  const [formScheduledDates, setFormScheduledDates] = useState<string>("");
  const [formDescription, setFormDescription] = useState("");
  const [isSavingRule, setIsSavingRule] = useState(false);

  // Scheduled Holidays Modal state
  const [holidayModalOpen, setHolidayModalOpen] = useState(false);
  const [newHolidayDate, setNewHolidayDate] = useState("");
  const [newHolidayTitle, setNewHolidayTitle] = useState("");
  const [newHolidayCategory, setNewHolidayCategory] = useState("INSTITUTIONAL");
  const [newHolidayDesc, setNewHolidayDesc] = useState("");
  const [isSavingHoliday, setIsSavingHoliday] = useState(false);

  // Refresh data from server
  const refreshData = async () => {
    try {
      const res = await fetch("/api/admin/rewards");
      const json = await res.json();
      if (json.ok) {
        setData(json.data);
      }
    } catch {
      // Background refresh failure handled quietly
    }
  };

  // Recalculate all scores
  const handleRecalculateAll = async () => {
    if (!confirm("Recalculate dynamic reward points for all active students based on active custom rules?")) return;
    setRecalculating(true);
    try {
      const res = await fetch("/api/admin/rewards/recalculate", { method: "POST" });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      toast.success("Scores Recalculated", `Successfully updated scores for ${json.data.totalRecalculated} students.`);
      await refreshData();
    } catch (err: unknown) {
      toast.error("Recalculation Failed", err instanceof Error ? err.message : "Error");
    } finally {
      setRecalculating(false);
    }
  };

  // Submit manual adjustment
  const handleAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustTargetUser || adjustPoints === 0 || !adjustReason.trim()) return;
    setIsAdjusting(true);
    try {
      const res = await fetch("/api/admin/rewards/adjust", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: adjustTargetUser.id,
          points: adjustPoints,
          reason: adjustReason.trim(),
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      toast.success("Points Adjusted", `${adjustPoints > 0 ? "+" : ""}${adjustPoints}% applied to ${adjustTargetUser.name}.`);
      setAdjustModalOpen(false);
      setAdjustTargetUser(null);
      setAdjustPoints(0);
      setAdjustReason("");
      await refreshData();
    } catch (err: unknown) {
      toast.error("Adjustment Failed", err instanceof Error ? err.message : "Error");
    } finally {
      setIsAdjusting(false);
    }
  };

  // Open Add Custom Rule modal with auto-suggested defaults
  const handleOpenAddRule = (cat: RewardCategory = "LEAVE") => {
    setFormCategory(cat);
    const subOptions = SUBCATEGORIES_BY_CATEGORY[cat] || [];
    const firstSub = subOptions[0];
    const subKey = firstSub?.key || "ALL";
    setFormSubCategory(subKey);
    setFormName(firstSub?.label || `${cat} Custom Rule`);
    setFormCode(`${cat}_${subKey}_${Date.now().toString().slice(-4)}`);
    setFormType(firstSub?.defaultType || "DEDUCTION");
    setFormPoints(firstSub?.defaultPoints || 3);
    setFormGraceDays(firstSub?.defaultGrace || 0);
    setFormEffectiveFrom("");
    setFormEffectiveTo("");
    setFormScheduledDates("");
    setFormDescription("");
    setAddRuleModalOpen(true);
  };

  // Handle category change in form
  const handleCategoryChange = (cat: RewardCategory) => {
    setFormCategory(cat);
    const subOptions = SUBCATEGORIES_BY_CATEGORY[cat] || [];
    const firstSub = subOptions[0];
    const subKey = firstSub?.key || "ALL";
    setFormSubCategory(subKey);
    setFormName(firstSub?.label || `${cat} Custom Rule`);
    setFormCode(`${cat}_${subKey}_${Date.now().toString().slice(-4)}`);
    setFormType(firstSub?.defaultType || "DEDUCTION");
    setFormPoints(firstSub?.defaultPoints || 3);
    setFormGraceDays(firstSub?.defaultGrace || 0);
  };

  // Handle subcategory change in form
  const handleSubCategoryChange = (subKey: string) => {
    setFormSubCategory(subKey);
    const subOptions = SUBCATEGORIES_BY_CATEGORY[formCategory] || [];
    const found = subOptions.find((s) => s.key === subKey);
    if (found) {
      setFormName(found.label);
      setFormType(found.defaultType);
      setFormPoints(found.defaultPoints);
      if (found.defaultGrace !== undefined) setFormGraceDays(found.defaultGrace);
      setFormCode(`${formCategory}_${subKey}_${Date.now().toString().slice(-4)}`);
    }
  };

  // Save New Custom Rule
  const handleSaveNewRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formCode.trim()) return;
    setIsSavingRule(true);
    try {
      const res = await fetch("/api/admin/rewards/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: formCode.trim().toUpperCase().replace(/[^A-Z0-9_]/g, "_"),
          name: formName.trim(),
          category: formCategory,
          subCategory: formSubCategory,
          type: formType,
          points: formPoints,
          gracePeriodDays: formGraceDays,
          effectiveFrom: formEffectiveFrom || null,
          effectiveTo: formEffectiveTo || null,
          scheduledDates: formScheduledDates.trim(),
          description: formDescription.trim(),
          isEnabled: true,
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      toast.success("Custom Rule Created", `Rule "${formName}" has been configured.`);
      setAddRuleModalOpen(false);
      await refreshData();
    } catch (err: unknown) {
      toast.error("Failed to Create Rule", err instanceof Error ? err.message : "Error");
    } finally {
      setIsSavingRule(false);
    }
  };

  // Toggle Rule Status
  const handleToggleRule = async (rule: CustomRule) => {
    try {
      const res = await fetch("/api/admin/rewards/rules", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: rule.id, isEnabled: !rule.isEnabled }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      toast.success(rule.isEnabled ? "Rule Disabled" : "Rule Enabled", rule.name);
      await refreshData();
    } catch (err: unknown) {
      toast.error("Update Failed", err instanceof Error ? err.message : "Error");
    }
  };

  // Delete Custom Rule
  const handleDeleteRule = async (rule: CustomRule) => {
    if (!confirm(`Are you sure you want to delete rule "${rule.name}" (${rule.code})?`)) return;
    try {
      const res = await fetch("/api/admin/rewards/rules", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: rule.id }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      toast.success("Rule Deleted", rule.name);
      await refreshData();
    } catch (err: unknown) {
      toast.error("Delete Failed", err instanceof Error ? err.message : "Error");
    }
  };

  // Save Scheduled Holiday
  const handleSaveHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHolidayDate || !newHolidayTitle.trim()) return;
    setIsSavingHoliday(true);
    try {
      const res = await fetch("/api/admin/rewards/holidays", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: newHolidayDate,
          title: newHolidayTitle.trim(),
          category: newHolidayCategory,
          description: newHolidayDesc.trim(),
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      toast.success("Holiday Scheduled", `${newHolidayTitle} on ${newHolidayDate} — no deductions will occur.`);
      setHolidayModalOpen(false);
      setNewHolidayDate("");
      setNewHolidayTitle("");
      setNewHolidayDesc("");
      await refreshData();
    } catch (err: unknown) {
      toast.error("Holiday Scheduling Failed", err instanceof Error ? err.message : "Error");
    } finally {
      setIsSavingHoliday(false);
    }
  };

  // Delete Scheduled Holiday
  const handleDeleteHoliday = async (holiday: ScheduledHoliday) => {
    if (!confirm(`Remove scheduled holiday "${holiday.title}" on ${holiday.date}?`)) return;
    try {
      const res = await fetch("/api/admin/rewards/holidays", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: holiday.id }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      toast.success("Holiday Removed", holiday.title);
      await refreshData();
    } catch (err: unknown) {
      toast.error("Failed to Remove Holiday", err instanceof Error ? err.message : "Error");
    }
  };

  // Departments & Domains for filter dropdowns
  const departments = useMemo(() => {
    const set = new Set<string>();
    for (const u of data.users) if (u.department) set.add(u.department);
    return Array.from(set).sort();
  }, [data.users]);

  const domains = useMemo(() => {
    const set = new Set<string>();
    for (const u of data.users) if (u.domain && u.domain !== "Data not Feeded") set.add(u.domain);
    return Array.from(set).sort();
  }, [data.users]);

  // Filtered Students
  const filteredUsers = useMemo(() => {
    const q = studentSearch.trim().toLowerCase();
    return data.users.filter((u) => {
      if (deptFilter !== "ALL" && u.department !== deptFilter) return false;
      if (domainFilter !== "ALL" && u.domain !== domainFilter) return false;
      if (tierFilter !== "ALL") {
        if (tierFilter === "OUTSTANDING" && u.rewardPoints < 95) return false;
        if (tierFilter === "GOOD" && (u.rewardPoints < 80 || u.rewardPoints >= 95)) return false;
        if (tierFilter === "SATISFACTORY" && (u.rewardPoints < 65 || u.rewardPoints >= 80)) return false;
        if (tierFilter === "AT_RISK" && u.rewardPoints >= 65) return false;
      }
      if (!q) return true;
      return (
        u.name.toLowerCase().includes(q) ||
        u.rollNo.toLowerCase().includes(q) ||
        u.department.toLowerCase().includes(q) ||
        u.domain.toLowerCase().includes(q)
      );
    });
  }, [data.users, studentSearch, deptFilter, domainFilter, tierFilter]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Reward Points & Performance Management"
        description="Configure dynamic activity-based rules, schedule exempted holidays, monitor student scores, and audit compliance."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              icon="refresh"
              loading={recalculating}
              onClick={handleRecalculateAll}
            >
              Recalculate All Scores
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon="plus"
              onClick={() => handleOpenAddRule("LEAVE")}
            >
              Add Custom Rule
            </Button>
          </div>
        }
      />

      {/* Top Stat Summary Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        <StatTile
          label="Total Eligible Students"
          value={data.summary.totalStudents}
          caption="Students & Student+ Admins"
          tone="blue"
        />
        <StatTile
          label="Cohort Average Score"
          value={`${data.summary.averageScore}%`}
          caption="Calculated across active rules"
          tone={data.summary.averageScore >= 80 ? "green" : data.summary.averageScore >= 65 ? "amber" : "red"}
        />
        <StatTile
          label="Good Standing Ratio"
          value={`${data.summary.goodStandingPercent}%`}
          caption="Students with 80%+ score"
          tone="blue"
        />
        <StatTile
          label="Scheduled Holidays"
          value={data.scheduledHolidays.length}
          caption="Dates exempt from deductions"
          tone="slate"
        />
      </div>

      {/* Modern Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-1.5 border-b pb-1" style={{ borderColor: "var(--line-soft)" }}>
        {[
          { key: "students", label: "Student Scores Roster", icon: "user" as IconName, count: data.users.length },
          { key: "rules", label: "Custom Activity Rules", icon: "settings" as IconName, count: data.policy.rules.length },
          { key: "holidays", label: "Scheduled Holidays", icon: "calendar" as IconName, count: data.scheduledHolidays.length },
          { key: "analytics", label: "Cohort Analytics", icon: "chart" as IconName },
          { key: "ledger", label: "Global Audit Ledger", icon: "clock" as IconName },
        ].map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key as any)}
              className={`flex items-center gap-2 rounded-[10px] px-3.5 py-2 text-[12.5px] font-semibold transition-all cursor-pointer ${
                isActive
                  ? "bg-[var(--accent)] text-white shadow-sm"
                  : "text-[var(--text-default)] hover:bg-[var(--surface-sunken)]"
              }`}
            >
              <Icon name={tab.icon} className="h-4 w-4" />
              <span>{tab.label}</span>
              {tab.count !== undefined ? (
                <span
                  className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                    isActive ? "bg-white/20 text-white" : "bg-[var(--surface-sunken)] text-[var(--text-faint)]"
                  }`}
                >
                  {tab.count}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* TAB 1: STUDENT PERFORMANCE ROSTER */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      {activeTab === "students" && (
        <Card className="space-y-4 p-4 sm:p-5">
          {/* Filter Bar */}
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-5">
            <Field label="Search Students" htmlFor="search-input">
              <Input
                id="search-input"
                placeholder="Name, roll number, department..."
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
              />
            </Field>

            <Field label="Performance Tier" htmlFor="tier-select">
              <Select id="tier-select" value={tierFilter} onChange={(e) => setTierFilter(e.target.value as any)}>
                <option value="ALL">All Tiers</option>
                <option value="OUTSTANDING">Outstanding (95%+)</option>
                <option value="GOOD">Good Standing (80%–94%)</option>
                <option value="SATISFACTORY">Satisfactory (65%–79%)</option>
                <option value="AT_RISK">At Risk (&lt;65%)</option>
              </Select>
            </Field>

            <Field label="Department" htmlFor="dept-select">
              <Select id="dept-select" value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)}>
                <option value="ALL">All Departments</option>
                {departments.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Domain" htmlFor="domain-select">
              <Select id="domain-select" value={domainFilter} onChange={(e) => setDomainFilter(e.target.value)}>
                <option value="ALL">All Domains</option>
                {domains.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </Select>
            </Field>

            <div className="flex items-end">
              <Button
                variant="ghost"
                size="sm"
                className="w-full"
                onClick={() => {
                  setStudentSearch("");
                  setTierFilter("ALL");
                  setDeptFilter("ALL");
                  setDomainFilter("ALL");
                }}
              >
                Reset Filters
              </Button>
            </div>
          </div>

          {/* Student Table */}
          <TableWrap>
            <Table>
              <THead>
                <TR>
                  <TH>Student</TH>
                  <TH>Role</TH>
                  <TH>Department & Domain</TH>
                  <TH className="text-right">Performance Score</TH>
                  <TH>Standing Tier</TH>
                  <TH className="text-right">Actions</TH>
                </TR>
              </THead>
              <TBody>
                {filteredUsers.length === 0 ? (
                  <TR>
                    <TD colSpan={6} className="py-8 text-center text-[var(--text-faint)]">
                      No matching students found.
                    </TD>
                  </TR>
                ) : (
                  filteredUsers.map((u) => {
                    const isStudentAdmin = u.role === "STUDENT_ADMIN";
                    const score = u.rewardPoints;
                    const tierTone: Tone =
                      score >= 95 ? "green" : score >= 80 ? "blue" : score >= 65 ? "amber" : "red";
                    const tierLabel =
                      score >= 95
                        ? "Outstanding"
                        : score >= 80
                        ? "Good Standing"
                        : score >= 65
                        ? "Satisfactory"
                        : "At Risk";

                    return (
                      <TR key={u.id}>
                        <TD>
                          <div className="flex flex-col">
                            <span className="font-bold text-[var(--text-strong)]">{u.name}</span>
                            <span className="font-mono text-[11px] text-[var(--text-faint)]">{u.rollNo}</span>
                          </div>
                        </TD>
                        <TD>
                          {isStudentAdmin ? (
                            <Badge tone="green">Student + Admin</Badge>
                          ) : (
                            <Badge tone="slate">Student</Badge>
                          )}
                        </TD>
                        <TD>
                          <div className="flex flex-col text-[11.5px]">
                            <span className="truncate max-w-[220px] text-[var(--text-default)]">{u.department || "General"}</span>
                            <span className="truncate max-w-[220px] text-[var(--text-faint)]">{u.domain || "Unassigned"}</span>
                          </div>
                        </TD>
                        <TD className="text-right">
                          <span className={`font-mono text-[14px] font-extrabold ${score < 65 ? "text-rose-600" : score >= 80 ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700"}`}>
                            {score}%
                          </span>
                        </TD>
                        <TD>
                          <Badge tone={tierTone}>{tierLabel}</Badge>
                        </TD>
                        <TD className="text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => {
                                setAdjustTargetUser(u);
                                setAdjustPoints(0);
                                setAdjustReason("");
                                setAdjustModalOpen(true);
                              }}
                            >
                              Adjust Points
                            </Button>
                            <Link href={`/console/people/${u.id}`} target="_blank">
                              <Button size="sm" variant="ghost" icon="arrow-right" title="View Profile" />
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

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* TAB 2: CUSTOM ACTIVITY RULES (NO PREDEFINED RULES) */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      {activeTab === "rules" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-[15px] font-bold text-[var(--text-strong)]">
                Configured Custom Activity Rules
              </h3>
              <p className="text-[12px] text-[var(--text-faint)]">
                Every rule is custom-configured. Set exact free allowances, start dates, and percentage impact without code modifications.
              </p>
            </div>
            <Button size="sm" variant="primary" icon="plus" onClick={() => handleOpenAddRule("LEAVE")}>
              Add Custom Rule
            </Button>
          </div>

          {data.policy.rules.length === 0 ? (
            <Card className="p-8 text-center space-y-3">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-blue-600 dark:bg-blue-900/30">
                <Icon name="settings" className="h-6 w-6" />
              </div>
              <h4 className="text-[14px] font-bold text-[var(--text-strong)]">No Custom Rules Configured</h4>
              <p className="mx-auto max-w-md text-[12px] text-[var(--text-faint)]">
                All predefined rules have been removed. You have complete control: click below to configure custom rules for leave allowances, worklog compliance, attendance check-ins, or scheduled LinkedIn posts.
              </p>
              <div className="pt-2">
                <Button size="sm" variant="primary" icon="plus" onClick={() => handleOpenAddRule("LEAVE")}>
                  Configure First Rule
                </Button>
              </div>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {CATEGORIES.map((catMeta) => {
                const categoryRules = data.policy.rules.filter((r) => r.category === catMeta.key);
                if (categoryRules.length === 0) return null;

                return (
                  <Card key={catMeta.key} className="space-y-3 p-4 sm:p-5">
                    <div className="flex items-center justify-between border-b pb-2.5" style={{ borderColor: "var(--line-soft)" }}>
                      <div className="flex items-center gap-2">
                        <Icon name={catMeta.icon} className="h-4 w-4 text-[var(--accent)]" />
                        <span className="text-[13px] font-bold text-[var(--text-strong)]">
                          {catMeta.label}
                        </span>
                      </div>
                      <Badge tone={catMeta.tone}>{categoryRules.length} rules</Badge>
                    </div>

                    <div className="divide-y" style={{ borderColor: "var(--line-soft)" }}>
                      {categoryRules.map((rule) => {
                        const isDeduction = rule.type === "DEDUCTION";

                        return (
                          <div key={rule.id} className="py-3 flex flex-col gap-2">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-[13px] font-bold text-[var(--text-strong)]">
                                    {rule.name}
                                  </span>
                                  <span
                                    className={`rounded px-1.5 py-0.5 text-[11px] font-extrabold ${
                                      isDeduction
                                        ? "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
                                        : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                                    }`}
                                  >
                                    {isDeduction ? `-${rule.points}%` : `+${rule.points}%`}
                                  </span>
                                </div>
                                <p className="mt-0.5 text-[11.5px] text-[var(--text-faint)]">
                                  {rule.description || "Custom activity rule criteria."}
                                </p>
                              </div>

                              {/* Toggle & Delete buttons */}
                              <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => handleToggleRule(rule)}
                                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                                    rule.isEnabled ? "bg-[var(--accent)]" : "bg-gray-300 dark:bg-gray-700"
                                  }`}
                                  title={rule.isEnabled ? "Rule active" : "Rule disabled"}
                                >
                                  <span
                                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${
                                      rule.isEnabled ? "translate-x-4" : "translate-x-0"
                                    }`}
                                  />
                                </button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  icon="trash"
                                  onClick={() => handleDeleteRule(rule)}
                                  title="Delete rule"
                                />
                              </div>
                            </div>

                            {/* Detailed Rule Attributes Pill Badges */}
                            <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] text-[var(--text-muted)]">
                              <span className="rounded bg-[var(--surface-sunken)] px-2 py-0.5 font-mono text-[10px]">
                                {rule.code}
                              </span>
                              {rule.gracePeriodDays > 0 ? (
                                <span className="rounded bg-blue-50 px-2 py-0.5 font-semibold text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                                  🎁 {rule.gracePeriodDays} Free Allowance
                                </span>
                              ) : null}
                              {rule.effectiveFrom ? (
                                <span className="rounded bg-slate-100 px-2 py-0.5 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                                  📅 From: {rule.effectiveFrom}
                                </span>
                              ) : null}
                              {rule.scheduledDates ? (
                                <span className="rounded bg-amber-50 px-2 py-0.5 font-semibold text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                                  🗓️ Scheduled: {rule.scheduledDates}
                                </span>
                              ) : null}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* TAB 3: SCHEDULED HOLIDAYS (NO REWARD POINTS DEDUCTED ON HOLIDAYS) */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      {activeTab === "holidays" && (
        <Card className="space-y-4 p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3" style={{ borderColor: "var(--line-soft)" }}>
            <div>
              <h3 className="text-[15px] font-bold text-[var(--text-strong)]">
                Scheduled Holidays & Break Calendar
              </h3>
              <p className="text-[12px] text-[var(--text-faint)]">
                Reward points are NEVER deducted on scheduled holidays or Sundays. Attendance and worklog requirements are automatically exempted.
              </p>
            </div>
            <Button size="sm" variant="primary" icon="plus" onClick={() => setHolidayModalOpen(true)}>
              Schedule New Holiday
            </Button>
          </div>

          <TableWrap>
            <Table>
              <THead>
                <TR>
                  <TH>Date</TH>
                  <TH>Holiday Name</TH>
                  <TH>Category</TH>
                  <TH>Notes / Description</TH>
                  <TH className="text-right">Actions</TH>
                </TR>
              </THead>
              <TBody>
                {data.scheduledHolidays.length === 0 ? (
                  <TR>
                    <TD colSpan={5} className="py-8 text-center text-[var(--text-faint)]">
                      No holidays scheduled yet. Click "Schedule New Holiday" to add official non-working dates.
                    </TD>
                  </TR>
                ) : (
                  data.scheduledHolidays.map((h) => (
                    <TR key={h.id}>
                      <TD>
                        <span className="font-mono font-bold text-[var(--text-strong)]">{h.date}</span>
                      </TD>
                      <TD>
                        <span className="font-semibold text-[var(--text-strong)]">{h.title}</span>
                      </TD>
                      <TD>
                        <Badge tone="blue">{h.category}</Badge>
                      </TD>
                      <TD>
                        <span className="text-[12px] text-[var(--text-faint)]">
                          {h.description || "Automatic deduction exemption active."}
                        </span>
                      </TD>
                      <TD className="text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          icon="trash"
                          onClick={() => handleDeleteHoliday(h)}
                          title="Remove holiday"
                        />
                      </TD>
                    </TR>
                  ))
                )}
              </TBody>
            </Table>
          </TableWrap>
        </Card>
      )}

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* TAB 4: COHORT ANALYTICS */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      {activeTab === "analytics" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Department Breakdown */}
          <Card className="space-y-4 p-4 sm:p-5">
            <CardHeader title="Department Performance Averages" icon="chart" />
            <TableWrap>
              <Table>
                <THead>
                  <TR>
                    <TH>Department</TH>
                    <TH className="text-right">Students</TH>
                    <TH className="text-right">Average Score</TH>
                    <TH className="text-right">At Risk (&lt;65%)</TH>
                  </TR>
                </THead>
                <TBody>
                  {data.departmentAnalytics.map((dept) => (
                    <TR key={dept.department}>
                      <TD className="font-semibold text-[var(--text-strong)]">{dept.department}</TD>
                      <TD className="text-right font-mono">{dept.count}</TD>
                      <TD className="text-right font-mono font-bold text-blue-600">{dept.averageScore}%</TD>
                      <TD className="text-right font-mono text-rose-600">{dept.atRiskCount}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </TableWrap>
          </Card>

          {/* Common Deductions Breakdown */}
          <Card className="space-y-4 p-4 sm:p-5">
            <CardHeader title="Frequent Deduction Areas" icon="alert" />
            {data.commonDeductions.length === 0 ? (
              <p className="py-6 text-center text-[12px] text-[var(--text-faint)]">
                No deductions recorded across the active custom rules.
              </p>
            ) : (
              <div className="divide-y" style={{ borderColor: "var(--line-soft)" }}>
                {data.commonDeductions.map((d) => (
                  <div key={d.code} className="py-2.5 flex items-center justify-between text-[12.5px]">
                    <div>
                      <span className="font-semibold text-[var(--text-strong)]">{d.name}</span>
                      <span className="ml-2 font-mono text-[10px] text-[var(--text-faint)]">{d.code}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-rose-600">-{d.totalDeducted}% total</span>
                      <span className="ml-2 text-[11px] text-[var(--text-faint)]">({d.count} events)</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* TAB 5: GLOBAL AUDIT LEDGER */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      {activeTab === "ledger" && (
        <Card className="space-y-4 p-4 sm:p-5">
          <CardHeader title="Real-Time Reward Audit Stream" icon="clock" />
          <TableWrap>
            <Table>
              <THead>
                <TR>
                  <TH>Time</TH>
                  <TH>Student</TH>
                  <TH>Category</TH>
                  <TH>Rule / Reason</TH>
                  <TH className="text-right">Points</TH>
                  <TH className="text-right">Balance</TH>
                </TR>
              </THead>
              <TBody>
                {data.recentTransactions.length === 0 ? (
                  <TR>
                    <TD colSpan={6} className="py-8 text-center text-[var(--text-faint)]">
                      No activity ledger records found.
                    </TD>
                  </TR>
                ) : (
                  data.recentTransactions.map((tx) => (
                    <TR key={tx.id}>
                      <TD className="text-[11px] text-[var(--text-faint)]">
                        {relativeTime(tx.createdAt)}
                      </TD>
                      <TD>
                        <span className="font-semibold text-[var(--text-strong)]">{tx.user.name}</span>
                        <span className="ml-1.5 font-mono text-[11px] text-[var(--text-faint)]">({tx.user.rollNo})</span>
                      </TD>
                      <TD>
                        <Badge tone={tx.points > 0 ? "green" : "red"}>{tx.category}</Badge>
                      </TD>
                      <TD className="max-w-[320px] truncate text-[12px] text-[var(--text-default)]">
                        {tx.reason}
                      </TD>
                      <TD className="text-right font-mono font-bold">
                        <span className={tx.points > 0 ? "text-emerald-600" : "text-rose-600"}>
                          {tx.points > 0 ? `+${tx.points}%` : `${tx.points}%`}
                        </span>
                      </TD>
                      <TD className="text-right font-mono text-[12px] text-[var(--text-faint)]">
                        {tx.previousScore}% → <span className="font-bold text-[var(--text-strong)]">{tx.newScore}%</span>
                      </TD>
                    </TR>
                  ))
                )}
              </TBody>
            </Table>
          </TableWrap>
        </Card>
      )}

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* MODAL: ADD / EDIT CUSTOM RULE (DETAILED CONFIGURATION) */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      <Modal
        open={addRuleModalOpen}
        onClose={() => setAddRuleModalOpen(false)}
        title="Add Custom Activity Rule"
        description="Configure dynamic performance scoring, free leave allowances, start dates, and deadline criteria."
        size="lg"
      >
        <form onSubmit={handleSaveNewRule} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Category / Website Module" htmlFor="rule-cat">
              <Select
                id="rule-cat"
                value={formCategory}
                onChange={(e) => handleCategoryChange(e.target.value as RewardCategory)}
              >
                {CATEGORIES.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Specific Activity / Event" htmlFor="rule-sub">
              <Select
                id="rule-sub"
                value={formSubCategory}
                onChange={(e) => handleSubCategoryChange(e.target.value)}
              >
                {(SUBCATEGORIES_BY_CATEGORY[formCategory] || []).map((sub) => (
                  <option key={sub.key} value={sub.key}>
                    {sub.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Rule Display Name" htmlFor="rule-name">
              <Input
                id="rule-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. Casual Leave Exceeding Allowance"
                required
              />
            </Field>

            <Field label="Rule Code" htmlFor="rule-code" hint="Uppercase with underscores">
              <Input
                id="rule-code"
                value={formCode}
                onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                placeholder="e.g. CASUAL_LEAVE_DEDUCTION"
                required
              />
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Impact Type" htmlFor="rule-type">
              <Select
                id="rule-type"
                value={formType}
                onChange={(e) => setFormType(e.target.value as "DEDUCTION" | "REWARD")}
              >
                <option value="DEDUCTION">Deduction (-)</option>
                <option value="REWARD">Reward Credit (+)</option>
              </Select>
            </Field>

            <Field label="Score Percentage (%)" htmlFor="rule-points">
              <Input
                id="rule-points"
                type="number"
                min={1}
                max={100}
                value={formPoints}
                onChange={(e) => setFormPoints(parseInt(e.target.value, 10) || 0)}
                required
              />
            </Field>
          </div>

          {/* Detailed Criteria Fields */}
          <div className="rounded-[12px] border p-3.5 space-y-3" style={{ background: "var(--surface-sunken)", borderColor: "var(--line-soft)" }}>
            <h4 className="text-[12.5px] font-bold text-[var(--text-strong)]">
              Detailed Grace Allowance & Scheduling Controls
            </h4>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                label={
                  formCategory === "LEAVE"
                    ? "Free Leave Allowance (Days)"
                    : formCategory === "WORKLOG"
                    ? "Free Grace Submissions"
                    : formCategory === "ATTENDANCE"
                    ? "Free Absence Days"
                    : "Grace Allowance Count"
                }
                htmlFor="rule-grace"
                hint="Deductions will ONLY start after this threshold is exceeded."
              >
                <Input
                  id="rule-grace"
                  type="number"
                  min={0}
                  max={30}
                  value={formGraceDays}
                  onChange={(e) => setFormGraceDays(parseInt(e.target.value, 10) || 0)}
                />
              </Field>

              <Field
                label="Effective From Date (epola erundhu calculate aganum)"
                htmlFor="rule-from"
                hint="Activities before this date are ignored."
              >
                <Input
                  id="rule-from"
                  type="date"
                  value={formEffectiveFrom}
                  onChange={(e) => setFormEffectiveFrom(e.target.value)}
                />
              </Field>
            </div>

            {/* Scheduled Dates Input (specifically for LinkedIn or scheduled events) */}
            {formCategory === "LINKEDIN" || formCategory === "OTHER" ? (
              <Field
                label="Scheduled Submission Dates (Comma-separated YYYY-MM-DD)"
                htmlFor="rule-dates"
                hint="Students must submit on or before these exact dates. If failed, points are deducted."
              >
                <Input
                  id="rule-dates"
                  value={formScheduledDates}
                  onChange={(e) => setFormScheduledDates(e.target.value)}
                  placeholder="e.g. 2026-11-14, 2026-11-21, 2026-11-28"
                />
              </Field>
            ) : null}
          </div>

          <Field label="Description & Policy Justification" htmlFor="rule-desc">
            <Input
              id="rule-desc"
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              placeholder="Explain how and when this rule applies to students..."
            />
          </Field>

          <div className="flex justify-end gap-2 pt-2 border-t" style={{ borderColor: "var(--line-soft)" }}>
            <Button variant="secondary" onClick={() => setAddRuleModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" loading={isSavingRule}>
              Save Custom Rule
            </Button>
          </div>
        </form>
      </Modal>

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* MODAL: SCHEDULE HOLIDAY */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      <Modal
        open={holidayModalOpen}
        onClose={() => setHolidayModalOpen(false)}
        title="Schedule Non-Working Holiday"
        description="Exempt specific calendar dates from all reward point deductions."
        size="md"
      >
        <form onSubmit={handleSaveHoliday} className="space-y-3.5">
          <Field label="Holiday Date (YYYY-MM-DD)" htmlFor="hol-date">
            <Input
              id="hol-date"
              type="date"
              value={newHolidayDate}
              onChange={(e) => setNewHolidayDate(e.target.value)}
              required
            />
          </Field>

          <Field label="Holiday Name / Title" htmlFor="hol-title">
            <Input
              id="hol-title"
              value={newHolidayTitle}
              onChange={(e) => setNewHolidayTitle(e.target.value)}
              placeholder="e.g. Diwali Festival, Semester Break, Symposium"
              required
            />
          </Field>

          <Field label="Category" htmlFor="hol-cat">
            <Select
              id="hol-cat"
              value={newHolidayCategory}
              onChange={(e) => setNewHolidayCategory(e.target.value)}
            >
              <option value="INSTITUTIONAL">Institutional Holiday</option>
              <option value="GOVERNMENT">Government / National Holiday</option>
              <option value="FESTIVAL">Festival / Cultural Event</option>
              <option value="SEMESTER_BREAK">Semester / Exam Break</option>
            </Select>
          </Field>

          <Field label="Notes / Reason" htmlFor="hol-desc">
            <Input
              id="hol-desc"
              value={newHolidayDesc}
              onChange={(e) => setNewHolidayDesc(e.target.value)}
              placeholder="Optional notes for administration records..."
            />
          </Field>

          <div className="flex justify-end gap-2 pt-2 border-t" style={{ borderColor: "var(--line-soft)" }}>
            <Button variant="secondary" onClick={() => setHolidayModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" loading={isSavingHoliday}>
              Schedule Holiday
            </Button>
          </div>
        </form>
      </Modal>

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* MODAL: MANUAL POINT ADJUSTMENT */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      <Modal
        open={adjustModalOpen}
        onClose={() => setAdjustModalOpen(false)}
        title={`Adjust Points — ${adjustTargetUser?.name || ""}`}
        description="Manually credit or deduct performance points with a mandatory audit justification."
        size="md"
      >
        <form onSubmit={handleAdjustSubmit} className="space-y-4">
          <div className="rounded-[10px] border p-3 text-[12px]" style={{ background: "var(--surface-sunken)", borderColor: "var(--line-soft)" }}>
            <p className="text-[var(--text-faint)]">
              Current Score:{" "}
              <span className="font-mono font-bold text-[var(--text-strong)]">{adjustTargetUser?.rewardPoints}%</span>
            </p>
          </div>

          <Field label="Points Adjustment (e.g. +5 or -5)" htmlFor="adj-pts">
            <Input
              id="adj-pts"
              type="number"
              value={adjustPoints}
              onChange={(e) => setAdjustPoints(parseInt(e.target.value, 10) || 0)}
              required
            />
          </Field>

          <Field label="Mandatory Audit Justification" htmlFor="adj-reason">
            <Input
              id="adj-reason"
              value={adjustReason}
              onChange={(e) => setAdjustReason(e.target.value)}
              placeholder="Explain why this manual score adjustment is being made..."
              required
            />
          </Field>

          <div className="flex justify-end gap-2 pt-2 border-t" style={{ borderColor: "var(--line-soft)" }}>
            <Button variant="secondary" onClick={() => setAdjustModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" loading={isAdjusting}>
              Apply Adjustment
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
