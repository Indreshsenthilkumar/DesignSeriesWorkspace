import { prisma } from "@/lib/prisma";
import { toDayKey, isWeekend } from "@/lib/dates";

export type RewardCategory = "ATTENDANCE" | "LEAVE" | "ON_DUTY" | "WORKLOG" | "TASK" | "OTHER" | "MANUAL";

export const DEFAULT_RULES = [
  {
    code: "ATT_FULL_DAY",
    name: "Full Day Attendance (7 Hours)",
    category: "ATTENDANCE" as RewardCategory,
    type: "REWARD",
    points: 2,
    isPercentage: true,
    isEnabled: false,
    description: "Reward credit bonus for checking in for all 7 slots in a day.",
  },
  {
    code: "ATT_INCOMPLETE",
    name: "Incomplete Attendance (< 7 Hours)",
    category: "ATTENDANCE" as RewardCategory,
    type: "DEDUCTION",
    points: 2,
    isPercentage: true,
    isEnabled: true,
    description: "Deduction when fewer than 7 hours are marked without approved leave or OD.",
  },
  {
    code: "ATT_MISSED",
    name: "Unaccounted Absence (0 Hours)",
    category: "ATTENDANCE" as RewardCategory,
    type: "DEDUCTION",
    points: 5,
    isPercentage: true,
    isEnabled: true,
    description: "Deduction when no check-in is logged on a weekday without approved leave or pass.",
  },
  {
    code: "LEAVE_UNAPPROVED",
    name: "Rejected / Unapproved Leave",
    category: "LEAVE" as RewardCategory,
    type: "DEDUCTION",
    points: 4,
    isPercentage: true,
    isEnabled: true,
    description: "Deduction applied when a student leave request is rejected by staff.",
  },
  {
    code: "LEAVE_EXCESSIVE",
    name: "Excessive Leaves (> 3 Days in Period)",
    category: "LEAVE" as RewardCategory,
    type: "DEDUCTION",
    points: 3,
    isPercentage: true,
    isEnabled: true,
    description: "Deduction for each approved leave day exceeding the 3-day policy allowance.",
  },
  {
    code: "OD_APPROVED",
    name: "Approved On-Duty Bonus",
    category: "ON_DUTY" as RewardCategory,
    type: "REWARD",
    points: 1,
    isPercentage: true,
    isEnabled: false,
    description: "Optional incentive credit for completing approved on-duty activities.",
  },
  {
    code: "OD_REJECTED",
    name: "Rejected On-Duty Request",
    category: "ON_DUTY" as RewardCategory,
    type: "DEDUCTION",
    points: 2,
    isPercentage: true,
    isEnabled: true,
    description: "Deduction when an on-duty gate pass request is rejected.",
  },
  {
    code: "WL_ON_TIME",
    name: "Worklog Submitted On Time",
    category: "WORKLOG" as RewardCategory,
    type: "REWARD",
    points: 2,
    isPercentage: true,
    isEnabled: false,
    description: "Optional credit for submitting all worklog slots within the same calendar day.",
  },
  {
    code: "WL_LATE",
    name: "Late Worklog Submission",
    category: "WORKLOG" as RewardCategory,
    type: "DEDUCTION",
    points: 2,
    isPercentage: true,
    isEnabled: true,
    description: "Deduction when a worklog is submitted past the midnight cutoff or via extension.",
  },
  {
    code: "WL_INCOMPLETE",
    name: "Incomplete Worklog (< 5 slots)",
    category: "WORKLOG" as RewardCategory,
    type: "DEDUCTION",
    points: 2,
    isPercentage: true,
    isEnabled: true,
    description: "Deduction when fewer than 5 work slots are documented in a daily submission.",
  },
  {
    code: "WL_MISSED",
    name: "Missed Worklog Submission",
    category: "WORKLOG" as RewardCategory,
    type: "DEDUCTION",
    points: 5,
    isPercentage: true,
    isEnabled: true,
    description: "Deduction when no worklog was submitted for an active working day.",
  },
  {
    code: "WL_FLAGGED",
    name: "Worklog Flagged by Mentor",
    category: "WORKLOG" as RewardCategory,
    type: "DEDUCTION",
    points: 3,
    isPercentage: true,
    isEnabled: true,
    description: "Deduction when a mentor flags a submitted worklog for revision or substandard content.",
  },
  {
    code: "TASK_ON_TIME",
    name: "Task Completed On Time",
    category: "TASK" as RewardCategory,
    type: "REWARD",
    points: 5,
    isPercentage: true,
    isEnabled: true,
    description: "Reward credit for completing sprint tasks on or before the specified due date.",
  },
  {
    code: "TASK_OVERDUE",
    name: "Overdue / Incomplete Task",
    category: "TASK" as RewardCategory,
    type: "DEDUCTION",
    points: 4,
    isPercentage: true,
    isEnabled: true,
    description: "Deduction when an assigned task passes its deadline without completion.",
  },
  {
    code: "LINKEDIN_VERIFIED",
    name: "Verified LinkedIn Post",
    category: "OTHER" as RewardCategory,
    type: "REWARD",
    points: 10,
    isPercentage: true,
    isEnabled: true,
    description: "Reward credit when a student build-in-public LinkedIn post is verified by mentor.",
  },
];

/**
 * Ensures an active RewardPolicy exists and populates default configurable rules.
 */
export async function ensureDefaultPolicyAndRules() {
  let policy = await prisma.rewardPolicy.findFirst({
    where: { isActive: true },
    include: { rules: true },
  });

  if (!policy) {
    policy = await prisma.rewardPolicy.create({
      data: {
        name: "Standard Academic Performance Policy (100% Base)",
        baseScore: 100,
        maxScore: 100,
        minScore: 0,
        isActive: true,
        periodType: "SEMESTER",
        description:
          "Dynamic performance scoring based on daily attendance, worklog compliance, task velocity and institutional discipline.",
      },
      include: { rules: true },
    });
  }

  // Populate any missing rules
  const existingCodes = new Set(policy.rules.map((r) => r.code));
  for (const def of DEFAULT_RULES) {
    if (!existingCodes.has(def.code)) {
      await prisma.rewardRule.create({
        data: {
          policyId: policy.id,
          code: def.code,
          name: def.name,
          category: def.category,
          type: def.type,
          points: def.points,
          isPercentage: def.isPercentage,
          isEnabled: def.isEnabled,
          description: def.description,
        },
      });
    }
  }

  return prisma.rewardPolicy.findUniqueOrThrow({
    where: { id: policy.id },
    include: { rules: true },
  });
}

/**
 * Evaluates real-time activity for a user and calculates dynamic reward points.
 */
export async function calculateUserRewardScore(
  userId: string,
  options: {
    persist?: boolean;
    actorId?: string;
    policy?: Awaited<ReturnType<typeof ensureDefaultPolicyAndRules>>;
  } = { persist: true }
) {
  const policy = options.policy ?? (await ensureDefaultPolicyAndRules());
  const ruleMap = new Map(policy.rules.map((r) => [r.code, r]));

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      attendance: true,
      leaveRequests: true,
      passes: true,
      worklogs: true,
      tasksAssigned: true,
      linkedinPosts: true,
      rewardTransactions: {
        where: { isManual: true },
      },
    },
  });

  if (!user) {
    throw new Error(`User not found: ${userId}`);
  }

  if (user.rewardPointsEnabled === false) {
    return {
      userId,
      score: user.rewardPoints,
      baseScore: policy.baseScore,
      maxScore: policy.maxScore,
      minScore: policy.minScore,
      enabled: false,
      breakdown: {},
      transactions: [],
    };
  }

  const today = toDayKey();

  type CandidateTx = {
    ruleCode: string;
    category: RewardCategory;
    type: "DEDUCTION" | "REWARD" | "ADJUSTMENT";
    points: number; // signed: negative for deduction, positive for reward
    entityType: string;
    entityId: string;
    reason: string;
    meta?: string;
    isManual?: boolean;
    actorId?: string | null;
    createdAt?: Date;
  };

  const candidates: CandidateTx[] = [];
  const seenCandidateKeys = new Set<string>();

  // Helper to add candidate if rule is enabled
  const addIfEnabled = (
    ruleCode: string,
    entityType: string,
    entityId: string,
    reason: string,
    overridePoints?: number,
    meta?: Record<string, unknown>
  ) => {
    const key = `${ruleCode}:${entityId}`;
    if (seenCandidateKeys.has(key)) return;
    seenCandidateKeys.add(key);

    const rule = ruleMap.get(ruleCode);
    if (!rule || !rule.isEnabled) return;
    const basePts = overridePoints ?? rule.points;
    const signedPts = rule.type === "DEDUCTION" ? -Math.abs(basePts) : Math.abs(basePts);
    candidates.push({
      ruleCode,
      category: rule.category as RewardCategory,
      type: rule.type as "DEDUCTION" | "REWARD",
      points: signedPts,
      entityType,
      entityId,
      reason,
      meta: meta ? JSON.stringify(meta) : "",
    });
  };

  // 1. Attendance Evaluation
  const attendanceByDate = new Map<string, typeof user.attendance>();
  for (const att of user.attendance) {
    if (!attendanceByDate.has(att.date)) {
      attendanceByDate.set(att.date, []);
    }
    attendanceByDate.get(att.date)!.push(att);
  }

  // Set of dates with approved leave or on-duty
  const approvedLeaveDates = new Set<string>();
  for (const leave of user.leaveRequests) {
    if (leave.status === "APPROVED") {
      approvedLeaveDates.add(leave.fromDate);
      if (leave.toDate && leave.toDate !== leave.fromDate) {
        approvedLeaveDates.add(leave.toDate);
      }
    }
  }

  const approvedPassDates = new Set<string>();
  for (const pass of user.passes) {
    if (pass.status === "APPROVED") {
      approvedPassDates.add(pass.date);
    }
  }

  // Iterate over checked-in dates
  for (const [date, records] of attendanceByDate.entries()) {
    const presentHours = records.filter((r) => r.status === "PRESENT").length;
    if (presentHours >= 7) {
      addIfEnabled(
        "ATT_FULL_DAY",
        "Attendance",
        date,
        `Full attendance completed on ${date} (7/7 hours marked).`,
        undefined,
        { date, hours: presentHours }
      );
    } else if (presentHours > 0 && presentHours < 7) {
      if (!approvedLeaveDates.has(date) && !approvedPassDates.has(date)) {
        addIfEnabled(
          "ATT_INCOMPLETE",
          "Attendance",
          date,
          `Incomplete attendance on ${date}: ${presentHours}/7 hours marked without approved leave or OD.`,
          undefined,
          { date, hours: presentHours }
        );
      }
    }
  }

  // 2. Leave Requests Evaluation
  let approvedLeaveCount = 0;
  for (const leave of user.leaveRequests) {
    if (leave.status === "REJECTED") {
      addIfEnabled(
        "LEAVE_UNAPPROVED",
        "LeaveRequest",
        leave.id,
        `Rejected leave request from ${leave.fromDate} (${leave.leaveType}): ${leave.reason || "Policy violation"}.`,
        undefined,
        { leaveId: leave.id, leaveType: leave.leaveType, fromDate: leave.fromDate }
      );
    } else if (leave.status === "APPROVED") {
      approvedLeaveCount++;
      if (approvedLeaveCount > 3) {
        addIfEnabled(
          "LEAVE_EXCESSIVE",
          "LeaveRequest",
          leave.id,
          `Excessive leave on ${leave.fromDate}: exceeded 3-day semester threshold.`,
          undefined,
          { leaveId: leave.id, leaveCount: approvedLeaveCount }
        );
      }
    }
  }

  // 3. On-Duty / Passes Evaluation
  for (const pass of user.passes) {
    if (pass.status === "REJECTED") {
      addIfEnabled(
        "OD_REJECTED",
        "ActivityPass",
        pass.id,
        `Rejected on-duty pass for ${pass.date} (${pass.destination}): ${pass.reason}.`,
        undefined,
        { passId: pass.id, date: pass.date, destination: pass.destination }
      );
    } else if (pass.status === "APPROVED") {
      addIfEnabled(
        "OD_APPROVED",
        "ActivityPass",
        pass.id,
        `Approved on-duty pass for ${pass.date} (${pass.destination}).`,
        undefined,
        { passId: pass.id, date: pass.date }
      );
    }
  }

  // 4. Worklog Evaluation
  const worklogDates = new Set<string>();
  for (const wl of user.worklogs) {
    worklogDates.add(wl.date);
    const slots = [wl.s1, wl.s2, wl.s3, wl.s4, wl.s5].filter((s) => Boolean(s && s.trim().length > 0)).length;

    // Incomplete slots
    if (slots < 5) {
      addIfEnabled(
        "WL_INCOMPLETE",
        "Worklog",
        wl.id,
        `Incomplete worklog for ${wl.date}: only ${slots}/5 slots documented.`,
        undefined,
        { worklogId: wl.id, date: wl.date, filledSlots: slots }
      );
    }

    // Flagged by mentor
    if (wl.status === "FLAGGED") {
      addIfEnabled(
        "WL_FLAGGED",
        "Worklog",
        wl.id,
        `Worklog for ${wl.date} flagged by mentor: ${wl.mentorRemark || "Substandard entries"}.`,
        undefined,
        { worklogId: wl.id, date: wl.date, remark: wl.mentorRemark }
      );
    }

    // Check if submitted late (created on a subsequent day)
    const createdDate = toDayKey(new Date(wl.createdAt));
    if (createdDate > wl.date) {
      addIfEnabled(
        "WL_LATE",
        "Worklog",
        wl.id,
        `Late worklog submission for ${wl.date}: logged on ${createdDate}.`,
        undefined,
        { worklogId: wl.id, date: wl.date, submittedOn: createdDate }
      );
    } else {
      addIfEnabled(
        "WL_ON_TIME",
        "Worklog",
        wl.id,
        `Worklog for ${wl.date} submitted promptly on time.`,
        undefined,
        { worklogId: wl.id, date: wl.date }
      );
    }
  }

  // Missed worklog on working days where student attended but didn't submit worklog
  for (const [date, records] of attendanceByDate.entries()) {
    const presentHours = records.filter((r) => r.status === "PRESENT").length;
    if (presentHours >= 3 && !worklogDates.has(date) && date < today && !isWeekend(date)) {
      addIfEnabled(
        "WL_MISSED",
        "Worklog",
        date,
        `Missed worklog submission for ${date} despite attendance check-in.`,
        undefined,
        { date, hoursPresent: presentHours }
      );
    }
  }

  // 5. Tasks Evaluation
  for (const task of user.tasksAssigned) {
    if (task.status === "DONE" || task.completedAt) {
      const isLate = task.dueDate && task.completedAt && toDayKey(new Date(task.completedAt)) > task.dueDate;
      if (!isLate) {
        addIfEnabled(
          "TASK_ON_TIME",
          "Task",
          task.id,
          `Task completed on schedule: "${task.title}".`,
          task.points > 0 ? task.points : undefined,
          { taskId: task.id, title: task.title, dueDate: task.dueDate }
        );
      }
    } else if (task.dueDate && task.dueDate < today && task.status !== "DONE") {
      addIfEnabled(
        "TASK_OVERDUE",
        "Task",
        task.id,
        `Overdue task "${task.title}": deadline was ${task.dueDate}.`,
        undefined,
        { taskId: task.id, title: task.title, dueDate: task.dueDate }
      );
    }
  }

  // 6. LinkedIn Posts Evaluation
  for (const post of user.linkedinPosts) {
    if (post.verified) {
      addIfEnabled(
        "LINKEDIN_VERIFIED",
        "LinkedinPost",
        post.id,
        `Verified build-in-public post published on ${post.postedOn}.`,
        undefined,
        { postId: post.id, postedOn: post.postedOn, url: post.url }
      );
    }
  }

  // 7. Retain all manual adjustments
  for (const manual of user.rewardTransactions) {
    candidates.push({
      ruleCode: manual.ruleCode || "MANUAL_ADJUST",
      category: "MANUAL",
      type: "ADJUSTMENT",
      points: manual.points,
      entityType: "Manual",
      entityId: manual.entityId,
      reason: manual.reason,
      meta: manual.meta,
      isManual: true,
      actorId: manual.actorId,
      createdAt: manual.createdAt,
    });
  }

  // Calculate sequential scores
  let currentScore = policy.baseScore;
  const processedTransactions: Array<CandidateTx & { previousScore: number; newScore: number }> = [];

  for (const item of candidates) {
    const prev = currentScore;
    currentScore = Math.max(policy.minScore, Math.min(policy.maxScore, currentScore + item.points));
    processedTransactions.push({
      ...item,
      previousScore: prev,
      newScore: currentScore,
    });
  }

  const finalScore = currentScore;

  // Breakdown by category
  const breakdown: Record<RewardCategory, { additions: number; deductions: number; net: number; count: number }> = {
    ATTENDANCE: { additions: 0, deductions: 0, net: 0, count: 0 },
    LEAVE: { additions: 0, deductions: 0, net: 0, count: 0 },
    ON_DUTY: { additions: 0, deductions: 0, net: 0, count: 0 },
    WORKLOG: { additions: 0, deductions: 0, net: 0, count: 0 },
    TASK: { additions: 0, deductions: 0, net: 0, count: 0 },
    OTHER: { additions: 0, deductions: 0, net: 0, count: 0 },
    MANUAL: { additions: 0, deductions: 0, net: 0, count: 0 },
  };

  for (const t of processedTransactions) {
    const cat = t.category;
    if (!breakdown[cat]) {
      breakdown[cat] = { additions: 0, deductions: 0, net: 0, count: 0 };
    }
    if (t.points > 0) {
      breakdown[cat].additions += t.points;
    } else {
      breakdown[cat].deductions += Math.abs(t.points);
    }
    breakdown[cat].net += t.points;
    breakdown[cat].count += 1;
  }

  // Persist if requested
  if (options.persist) {
    await prisma.rewardTransaction.deleteMany({
      where: {
        userId,
        isManual: false,
      },
    });

    const nonManual = processedTransactions.filter((t) => !t.isManual);
    if (nonManual.length > 0) {
      await prisma.rewardTransaction.createMany({
        data: nonManual.map((t) => ({
          userId,
          ruleId: ruleMap.get(t.ruleCode)?.id ?? null,
          ruleCode: t.ruleCode,
          category: t.category,
          type: t.type,
          points: t.points,
          previousScore: t.previousScore,
          newScore: t.newScore,
          entityType: t.entityType,
          entityId: t.entityId,
          reason: t.reason,
          meta: t.meta || "",
          isManual: false,
          actorId: options.actorId || null,
        })),
        skipDuplicates: true,
      });
    }

    await prisma.user.update({
      where: { id: userId },
      data: { rewardPoints: finalScore },
    });
  }

  return {
    userId,
    score: finalScore,
    baseScore: policy.baseScore,
    maxScore: policy.maxScore,
    minScore: policy.minScore,
    enabled: true,
    breakdown,
    transactions: processedTransactions,
  };
}

/**
 * Recalculate reward scores for all active users across the portal.
 */
export async function recalculateAllRewardScores(actorId?: string) {
  const policy = await ensureDefaultPolicyAndRules();
  const users = await prisma.user.findMany({
    where: {
      role: { in: ["STUDENT", "STUDENT_ADMIN"] },
      systemStatus: "ACTIVE",
    },
    select: { id: true, name: true, rollNo: true, rewardPointsEnabled: true },
  });

  const results: Array<{ userId: string; name: string; rollNo: string; score: number }> = [];
  const chunkSize = 6;
  for (let i = 0; i < users.length; i += chunkSize) {
    const chunk = users.slice(i, i + chunkSize);
    const chunkResults = await Promise.all(
      chunk.map(async (user) => {
        if (user.rewardPointsEnabled === false) return null;
        const res = await calculateUserRewardScore(user.id, { persist: true, actorId, policy });
        return { userId: user.id, name: user.name, rollNo: user.rollNo, score: res.score };
      })
    );
    for (const r of chunkResults) {
      if (r) results.push(r);
    }
  }

  return {
    totalRecalculated: results.length,
    results,
  };
}

/**
 * Manually adjust points for a user with mandatory audit reason.
 */
export async function manuallyAdjustPoints(params: {
  userId: string;
  points: number; // positive or negative
  reason: string;
  actorId: string;
}) {
  const { userId, points, reason, actorId } = params;
  if (!reason || reason.trim().length < 5) {
    throw new Error("A clear audit reason (minimum 5 characters) is required for manual point adjustments.");
  }

  const policy = await ensureDefaultPolicyAndRules();
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { id: true, name: true, rewardPoints: true },
  });

  const prevScore = user.rewardPoints;
  const newScore = Math.max(policy.minScore, Math.min(policy.maxScore, prevScore + points));

  const entityId = `manual-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

  const txRecord = await prisma.rewardTransaction.create({
    data: {
      userId,
      ruleCode: "MANUAL_ADJUST",
      category: "MANUAL",
      type: "ADJUSTMENT",
      points,
      previousScore: prevScore,
      newScore,
      entityType: "Manual",
      entityId,
      reason: reason.trim(),
      isManual: true,
      actorId,
    },
  });

  await prisma.user.update({
    where: { id: userId },
    data: { rewardPoints: newScore },
  });

  return {
    transaction: txRecord,
    previousScore: prevScore,
    newScore,
  };
}

/**
 * Fetch detailed reward summary and audit history for an individual user profile.
 */
export async function getUserRewardSummary(userId: string) {
  const policy = await ensureDefaultPolicyAndRules();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      rollNo: true,
      email: true,
      department: true,
      year: true,
      domain: true,
      rewardPoints: true,
      rewardPointsEnabled: true,
      portalNavDisabled: true,
    },
  });

  if (!user) throw new Error("User not found");

  const transactions = await prisma.rewardTransaction.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: {
      rule: { select: { name: true, code: true, category: true } },
      actor: { select: { id: true, name: true, role: true } },
    },
  });

  // Calculate breakdown
  const breakdown: Record<RewardCategory, { additions: number; deductions: number; net: number; count: number }> = {
    ATTENDANCE: { additions: 0, deductions: 0, net: 0, count: 0 },
    LEAVE: { additions: 0, deductions: 0, net: 0, count: 0 },
    ON_DUTY: { additions: 0, deductions: 0, net: 0, count: 0 },
    WORKLOG: { additions: 0, deductions: 0, net: 0, count: 0 },
    TASK: { additions: 0, deductions: 0, net: 0, count: 0 },
    OTHER: { additions: 0, deductions: 0, net: 0, count: 0 },
    MANUAL: { additions: 0, deductions: 0, net: 0, count: 0 },
  };

  for (const t of transactions) {
    const cat = t.category as RewardCategory;
    if (!breakdown[cat]) {
      breakdown[cat] = { additions: 0, deductions: 0, net: 0, count: 0 };
    }
    if (t.points > 0) {
      breakdown[cat].additions += t.points;
    } else {
      breakdown[cat].deductions += Math.abs(t.points);
    }
    breakdown[cat].net += t.points;
    breakdown[cat].count += 1;
  }

  // Monthly trends (last 6 months)
  const monthlyTrends: Record<string, { additions: number; deductions: number; count: number }> = {};
  for (const t of transactions) {
    const monthKey = t.createdAt.toISOString().slice(0, 7); // YYYY-MM
    if (!monthlyTrends[monthKey]) {
      monthlyTrends[monthKey] = { additions: 0, deductions: 0, count: 0 };
    }
    if (t.points > 0) {
      monthlyTrends[monthKey].additions += t.points;
    } else {
      monthlyTrends[monthKey].deductions += Math.abs(t.points);
    }
    monthlyTrends[monthKey].count++;
  }

  // Performance tier
  const score = user.rewardPoints;
  let tier: "OUTSTANDING" | "GOOD" | "SATISFACTORY" | "AT_RISK" = "GOOD";
  let tierLabel = "Good Performance";
  if (score >= 95) {
    tier = "OUTSTANDING";
    tierLabel = "Outstanding (95-100%)";
  } else if (score >= 80) {
    tier = "GOOD";
    tierLabel = "Good Standing (80-94%)";
  } else if (score >= 65) {
    tier = "SATISFACTORY";
    tierLabel = "Satisfactory (65-79%)";
  } else {
    tier = "AT_RISK";
    tierLabel = "Action Required (< 65%)";
  }

  return {
    user,
    policy,
    score,
    maxScore: policy.maxScore,
    baseScore: policy.baseScore,
    minScore: policy.minScore,
    percentage: Math.round((score / policy.maxScore) * 100),
    tier,
    tierLabel,
    breakdown,
    transactions,
    monthlyTrends,
  };
}

/**
 * Fetch comprehensive cohort analytics for the admin console.
 */
export async function getAdminRewardAnalytics() {
  const policy = await ensureDefaultPolicyAndRules();

  const [users, allTransactions] = await Promise.all([
    prisma.user.findMany({
      where: {
        role: { in: ["STUDENT", "STUDENT_ADMIN"] },
        systemStatus: "ACTIVE",
      },
      select: {
        id: true,
        name: true,
        rollNo: true,
        department: true,
        year: true,
        domain: true,
        rewardPoints: true,
        rewardPointsEnabled: true,
        portalNavDisabled: true,
      },
      orderBy: [{ rewardPoints: "desc" }, { name: "asc" }],
    }),
    prisma.rewardTransaction.findMany({
      orderBy: { createdAt: "desc" },
      take: 1000,
      include: {
        user: { select: { name: true, rollNo: true, department: true } },
        rule: { select: { name: true, code: true } },
        actor: { select: { name: true, role: true } },
      },
    }),
  ]);

  const totalUsers = users.length;
  const scores = users.map((u) => u.rewardPoints);
  const avgScore = totalUsers > 0 ? Math.round((scores.reduce((a, b) => a + b, 0) / totalUsers) * 10) / 10 : 0;
  const maxScore = totalUsers > 0 ? Math.max(...scores) : 100;
  const minScore = totalUsers > 0 ? Math.min(...scores) : 0;

  // Distribution buckets
  const distribution = {
    outstanding: users.filter((u) => u.rewardPoints >= 95).length,
    good: users.filter((u) => u.rewardPoints >= 80 && u.rewardPoints < 95).length,
    satisfactory: users.filter((u) => u.rewardPoints >= 65 && u.rewardPoints < 80).length,
    atRisk: users.filter((u) => u.rewardPoints < 65).length,
  };

  // Department-wise averages
  const deptMap = new Map<string, { total: number; sum: number; atRisk: number }>();
  for (const u of users) {
    const dept = u.department || "Other";
    if (!deptMap.has(dept)) {
      deptMap.set(dept, { total: 0, sum: 0, atRisk: 0 });
    }
    const d = deptMap.get(dept)!;
    d.total++;
    d.sum += u.rewardPoints;
    if (u.rewardPoints < 65) d.atRisk++;
  }

  const departmentAnalytics = Array.from(deptMap.entries()).map(([department, data]) => ({
    department,
    count: data.total,
    averageScore: Math.round((data.sum / data.total) * 10) / 10,
    atRiskCount: data.atRisk,
  }));

  // Common deduction reasons
  const deductionFrequency = new Map<string, { count: number; totalDeducted: number; name: string }>();
  for (const t of allTransactions) {
    if (t.points < 0) {
      const code = t.ruleCode || "OTHER";
      if (!deductionFrequency.has(code)) {
        deductionFrequency.set(code, {
          count: 0,
          totalDeducted: 0,
          name: t.rule?.name || t.reason.slice(0, 40),
        });
      }
      const entry = deductionFrequency.get(code)!;
      entry.count++;
      entry.totalDeducted += Math.abs(t.points);
    }
  }

  const commonDeductions = Array.from(deductionFrequency.entries())
    .map(([code, data]) => ({
      code,
      name: data.name,
      count: data.count,
      totalDeducted: data.totalDeducted,
    }))
    .sort((a, b) => b.count - a.count);

  return {
    policy,
    summary: {
      totalStudents: totalUsers,
      averageScore: avgScore,
      maxScore,
      minScore,
      goodStandingPercent: totalUsers > 0 ? Math.round(((distribution.outstanding + distribution.good) / totalUsers) * 100) : 0,
      distribution,
    },
    departmentAnalytics,
    commonDeductions,
    users,
    recentTransactions: allTransactions.slice(0, 100),
  };
}
