import { prisma } from "@/lib/prisma";
import { toDayKey, isWeekend } from "@/lib/dates";

export type RewardCategory =
  | "ATTENDANCE"
  | "LEAVE"
  | "ON_DUTY"
  | "WORKLOG"
  | "TASK"
  | "LINKEDIN"
  | "OTHER"
  | "MANUAL";

/**
 * Ensures an active RewardPolicy exists.
 * Does NOT populate any predefined/hardcoded rules — all rules are custom-configured by administrators.
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
          "Dynamic performance scoring based on custom administrator-defined rules across attendance, worklogs, leaves, tasks, and LinkedIn activities.",
      },
      include: { rules: true },
    });
  }

  return policy;
}

/**
 * Evaluates real-time activity for a user and calculates dynamic reward points.
 * All calculations strictly adhere to administrator custom rules and skip scheduled holidays.
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

  const [user, scheduledHolidays] = await Promise.all([
    prisma.user.findUnique({
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
    }),
    prisma.scheduledHoliday.findMany({
      select: { date: true, title: true },
    }),
  ]);

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
      breakdown: {} as Record<RewardCategory, { additions: number; deductions: number; net: number; count: number }>,
      transactions: [],
    };
  }

  const today = toDayKey();

  // Set of scheduled holiday dates where NO deductions are allowed
  const holidayDateSet = new Set(scheduledHolidays.map((h) => h.date));
  const holidayTitleMap = new Map(scheduledHolidays.map((h) => [h.date, h.title]));

  type CandidateTx = {
    ruleId?: string;
    ruleCode: string;
    category: RewardCategory;
    type: "DEDUCTION" | "REWARD" | "ADJUSTMENT";
    points: number; // signed delta: negative for deduction, positive for reward
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

  const addCandidate = (
    rule: typeof policy.rules[number],
    entityType: string,
    entityId: string,
    reason: string,
    overridePoints?: number,
    meta?: Record<string, unknown>
  ) => {
    if (!rule.isEnabled) return;
    const key = `${rule.code}:${entityId}`;
    if (seenCandidateKeys.has(key)) return;
    seenCandidateKeys.add(key);

    const basePts = overridePoints ?? rule.points;
    const signedPts = rule.type === "DEDUCTION" ? -Math.abs(basePts) : Math.abs(basePts);

    candidates.push({
      ruleId: rule.id,
      ruleCode: rule.code,
      category: rule.category as RewardCategory,
      type: rule.type as "DEDUCTION" | "REWARD",
      points: signedPts,
      entityType,
      entityId,
      reason,
      meta: meta ? JSON.stringify(meta) : "",
    });
  };

  // Helper to determine if a date is exempt (Holiday or Sunday)
  const isDateExempt = (dateStr: string) => {
    return isWeekend(dateStr) || holidayDateSet.has(dateStr);
  };

  // Pre-index user records
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

  // ──────────────────────────────────────────────────────────────────────────
  // EVALUATE CUSTOM RULES PER CATEGORY
  // ──────────────────────────────────────────────────────────────────────────

  for (const rule of policy.rules) {
    if (!rule.isEnabled) continue;

    const effectiveFrom = rule.effectiveFrom || null;
    const effectiveTo = rule.effectiveTo || null;

    const isDateWithinRuleWindow = (dateStr: string) => {
      if (effectiveFrom && dateStr < effectiveFrom) return false;
      if (effectiveTo && dateStr > effectiveTo) return false;
      return true;
    };

    // ────────────────────────────────────────────────────────────────────────
    // 1. LEAVE MANAGEMENT RULES
    // ────────────────────────────────────────────────────────────────────────
    if (rule.category === "LEAVE") {
      const sub = (rule.subCategory || "ALL_LEAVES").toUpperCase();
      const freeAllowance = rule.gracePeriodDays || 0; // Number of free leaves allowed before penalty kicks in

      // Filter user's leave requests matching rule window and subcategory
      const eligibleLeaves = user.leaveRequests.filter((leave) => {
        if (!isDateWithinRuleWindow(leave.fromDate)) return false;

        if (sub === "UNAPPROVED" || sub === "REJECTED") {
          return leave.status === "REJECTED";
        }
        if (sub === "CASUAL") {
          return leave.status === "APPROVED" && (leave.leaveType?.toUpperCase().includes("CASUAL") || leave.reason?.toUpperCase().includes("CASUAL"));
        }
        if (sub === "SICK" || sub === "MEDICAL") {
          return leave.status === "APPROVED" && (leave.leaveType?.toUpperCase().includes("SICK") || leave.leaveType?.toUpperCase().includes("MEDICAL"));
        }
        if (sub === "ON_DUTY") {
          return leave.status === "APPROVED" && (leave.leaveType?.toUpperCase().includes("ON_DUTY") || leave.leaveType?.toUpperCase().includes("OD"));
        }
        if (sub === "PERSONAL") {
          return leave.status === "APPROVED" && (leave.leaveType?.toUpperCase().includes("PERSONAL") || leave.leaveType?.toUpperCase().includes("FAMILY"));
        }

        // Default ALL_LEAVES: applies to approved leaves
        return leave.status === "APPROVED";
      });

      // Sort leaves by date ascending
      eligibleLeaves.sort((a, b) => a.fromDate.localeCompare(b.fromDate));

      let leaveCount = 0;
      for (const leave of eligibleLeaves) {
        leaveCount++;
        // If leave falls within free allowance, skip without deduction!
        if (leaveCount <= freeAllowance) {
          continue;
        }

        const reasonText =
          freeAllowance > 0
            ? `${rule.name}: Leave on ${leave.fromDate} exceeded ${freeAllowance}-day free leave allowance.`
            : `${rule.name}: Leave taken on ${leave.fromDate} (${leave.leaveType || "Leave"}).`;

        addCandidate(rule, "LeaveRequest", leave.id, reasonText, undefined, {
          leaveId: leave.id,
          fromDate: leave.fromDate,
          leaveType: leave.leaveType,
          leaveCount,
          freeAllowance,
        });
      }
    }

    // ────────────────────────────────────────────────────────────────────────
    // 2. WORKLOG MANAGEMENT RULES
    // ────────────────────────────────────────────────────────────────────────
    else if (rule.category === "WORKLOG") {
      const sub = (rule.subCategory || "MISSED_WORKLOG").toUpperCase();
      const freeSubmissions = rule.gracePeriodDays || 0;

      if (sub === "MISSED_WORKLOG") {
        // Evaluate missed worklog for past working days
        const startDate = effectiveFrom || toDayKey(new Date(Date.now() - 30 * 86_400_000));
        const endDate = effectiveTo && effectiveTo < today ? effectiveTo : today;

        const worklogDates = new Set(user.worklogs.map((w) => w.date));
        let missedCount = 0;

        // Iterate through all days in range
        const startTimestamp = new Date(startDate).getTime();
        const endTimestamp = new Date(endDate).getTime();

        for (let t = startTimestamp; t < endTimestamp; t += 86_400_000) {
          const dayKey = toDayKey(new Date(t));

          // Rule: Never penalize on scheduled holidays or Sundays
          if (isDateExempt(dayKey)) continue;

          // Never penalize if student had approved leave or approved pass
          if (approvedLeaveDates.has(dayKey) || approvedPassDates.has(dayKey)) continue;

          // Check if worklog was missing
          if (!worklogDates.has(dayKey)) {
            missedCount++;
            if (missedCount <= freeSubmissions) {
              continue; // within free grace submissions
            }

            addCandidate(
              rule,
              "Worklog",
              `missed_${dayKey}`,
              `${rule.name}: Worklog not submitted for working day ${dayKey}.`,
              undefined,
              { date: dayKey, missedCount, freeSubmissions }
            );
          }
        }
      } else if (sub === "LATE_WORKLOG") {
        let lateCount = 0;
        for (const wl of user.worklogs) {
          if (!isDateWithinRuleWindow(wl.date)) continue;
          const createdDate = toDayKey(new Date(wl.createdAt));
          if (createdDate > wl.date) {
            lateCount++;
            if (lateCount <= freeSubmissions) continue;

            addCandidate(
              rule,
              "Worklog",
              wl.id,
              `${rule.name}: Late worklog for ${wl.date} (submitted on ${createdDate}).`,
              undefined,
              { worklogId: wl.id, date: wl.date, submittedOn: createdDate }
            );
          }
        }
      } else if (sub === "INCOMPLETE_WORKLOG") {
        for (const wl of user.worklogs) {
          if (!isDateWithinRuleWindow(wl.date)) continue;
          const slots = [wl.s1, wl.s2, wl.s3, wl.s4, wl.s5].filter((s) => Boolean(s && s.trim().length > 0)).length;
          if (slots < 5) {
            addCandidate(
              rule,
              "Worklog",
              wl.id,
              `${rule.name}: Incomplete worklog for ${wl.date} (${slots}/5 slots documented).`,
              undefined,
              { worklogId: wl.id, date: wl.date, slots }
            );
          }
        }
      } else if (sub === "FLAGGED_WORKLOG") {
        for (const wl of user.worklogs) {
          if (!isDateWithinRuleWindow(wl.date)) continue;
          if (wl.status === "FLAGGED") {
            addCandidate(
              rule,
              "Worklog",
              wl.id,
              `${rule.name}: Worklog for ${wl.date} flagged by mentor: ${wl.mentorRemark || "Substandard entries"}.`,
              undefined,
              { worklogId: wl.id, date: wl.date, remark: wl.mentorRemark }
            );
          }
        }
      } else if (sub === "ON_TIME_WORKLOG") {
        for (const wl of user.worklogs) {
          if (!isDateWithinRuleWindow(wl.date)) continue;
          const createdDate = toDayKey(new Date(wl.createdAt));
          if (createdDate <= wl.date && wl.status !== "FLAGGED") {
            addCandidate(
              rule,
              "Worklog",
              wl.id,
              `${rule.name}: Worklog submitted on time for ${wl.date}.`,
              undefined,
              { worklogId: wl.id, date: wl.date }
            );
          }
        }
      }
    }

    // ────────────────────────────────────────────────────────────────────────
    // 3. ATTENDANCE MANAGEMENT RULES
    // ────────────────────────────────────────────────────────────────────────
    else if (rule.category === "ATTENDANCE") {
      const sub = (rule.subCategory || "MISSED_ATTENDANCE").toUpperCase();
      const freeAbsences = rule.gracePeriodDays || 0;

      const attendanceByDate = new Map<string, typeof user.attendance>();
      for (const att of user.attendance) {
        if (!attendanceByDate.has(att.date)) {
          attendanceByDate.set(att.date, []);
        }
        attendanceByDate.get(att.date)!.push(att);
      }

      if (sub === "MISSED_ATTENDANCE") {
        const startDate = effectiveFrom || toDayKey(new Date(Date.now() - 30 * 86_400_000));
        const endDate = effectiveTo && effectiveTo < today ? effectiveTo : today;

        let absentCount = 0;
        const startTimestamp = new Date(startDate).getTime();
        const endTimestamp = new Date(endDate).getTime();

        for (let t = startTimestamp; t < endTimestamp; t += 86_400_000) {
          const dayKey = toDayKey(new Date(t));

          // Rule: Never deduct on scheduled holidays or Sundays
          if (isDateExempt(dayKey)) continue;

          // Never deduct if user had approved leave or approved pass
          if (approvedLeaveDates.has(dayKey) || approvedPassDates.has(dayKey)) continue;

          const records = attendanceByDate.get(dayKey) || [];
          const presentHours = records.filter((r) => r.status === "PRESENT").length;

          if (presentHours === 0) {
            absentCount++;
            if (absentCount <= freeAbsences) continue;

            addCandidate(
              rule,
              "Attendance",
              `absent_${dayKey}`,
              `${rule.name}: Unaccounted absence on working day ${dayKey}.`,
              undefined,
              { date: dayKey, absentCount, freeAbsences }
            );
          }
        }
      } else if (sub === "INCOMPLETE_ATTENDANCE") {
        for (const [date, records] of attendanceByDate.entries()) {
          if (!isDateWithinRuleWindow(date)) continue;
          if (isDateExempt(date)) continue;
          if (approvedLeaveDates.has(date) || approvedPassDates.has(date)) continue;

          const presentHours = records.filter((r) => r.status === "PRESENT").length;
          if (presentHours > 0 && presentHours < 7) {
            addCandidate(
              rule,
              "Attendance",
              date,
              `${rule.name}: Incomplete attendance on ${date} (${presentHours}/7 hours marked).`,
              undefined,
              { date, hours: presentHours }
            );
          }
        }
      } else if (sub === "FULL_DAY_ATTENDANCE") {
        for (const [date, records] of attendanceByDate.entries()) {
          if (!isDateWithinRuleWindow(date)) continue;
          const presentHours = records.filter((r) => r.status === "PRESENT").length;
          if (presentHours >= 7) {
            addCandidate(
              rule,
              "Attendance",
              date,
              `${rule.name}: Full day attendance completed on ${date} (7/7 hours).`,
              undefined,
              { date, hours: presentHours }
            );
          }
        }
      }
    }

    // ────────────────────────────────────────────────────────────────────────
    // 4. LINKEDIN SCHEDULED SUBMISSIONS RULES
    // ────────────────────────────────────────────────────────────────────────
    else if (rule.category === "LINKEDIN") {
      const sub = (rule.subCategory || "SCHEDULED_LINKEDIN_MISSED").toUpperCase();

      // Parse scheduled dates from rule.scheduledDates (comma or newline separated YYYY-MM-DD)
      const scheduledDates = (rule.scheduledDates || "")
        .split(/[,\n\s]+/)
        .map((s) => s.trim())
        .filter((s) => /^\d{4}-\d{2}-\d{2}$/.test(s));

      const verifiedPostDates = new Set<string>();
      for (const post of user.linkedinPosts) {
        if (post.verified) {
          verifiedPostDates.add(toDayKey(new Date(post.createdAt)));
        }
      }

      for (const scheduledDate of scheduledDates) {
        if (!isDateWithinRuleWindow(scheduledDate)) continue;

        // Only evaluate scheduled dates that have already arrived
        if (scheduledDate > today) continue;

        const hasVerifiedPost = verifiedPostDates.has(scheduledDate);

        if (!hasVerifiedPost && (rule.type === "DEDUCTION" || sub.includes("MISSED"))) {
          addCandidate(
            rule,
            "LinkedinPost",
            `missed_linkedin_${scheduledDate}`,
            `${rule.name}: Missed scheduled LinkedIn post submission on ${scheduledDate}.`,
            undefined,
            { scheduledDate }
          );
        } else if (hasVerifiedPost && (rule.type === "REWARD" || sub.includes("SUBMITTED"))) {
          addCandidate(
            rule,
            "LinkedinPost",
            `verified_linkedin_${scheduledDate}`,
            `${rule.name}: Verified LinkedIn post completed for scheduled date ${scheduledDate}.`,
            undefined,
            { scheduledDate }
          );
        }
      }
    }

    // ────────────────────────────────────────────────────────────────────────
    // 5. ON-DUTY ACTIVITY PASS RULES
    // ────────────────────────────────────────────────────────────────────────
    else if (rule.category === "ON_DUTY") {
      const sub = (rule.subCategory || "REJECTED_PASS").toUpperCase();
      for (const pass of user.passes) {
        if (!isDateWithinRuleWindow(pass.date)) continue;

        if (pass.status === "REJECTED" && (sub === "REJECTED_PASS" || rule.type === "DEDUCTION")) {
          addCandidate(
            rule,
            "ActivityPass",
            pass.id,
            `${rule.name}: Rejected on-duty pass for ${pass.date} (${pass.destination}): ${pass.reason}.`,
            undefined,
            { passId: pass.id, date: pass.date }
          );
        } else if (pass.status === "APPROVED" && (sub === "APPROVED_PASS" || rule.type === "REWARD")) {
          addCandidate(
            rule,
            "ActivityPass",
            pass.id,
            `${rule.name}: Approved on-duty activity pass for ${pass.date} (${pass.destination}).`,
            undefined,
            { passId: pass.id, date: pass.date }
          );
        }
      }
    }

    // ────────────────────────────────────────────────────────────────────────
    // 6. TASK SPRINT RULES
    // ────────────────────────────────────────────────────────────────────────
    else if (rule.category === "TASK") {
      const sub = (rule.subCategory || "OVERDUE_TASK").toUpperCase();
      for (const task of user.tasksAssigned) {
        if (!task.dueDate || !isDateWithinRuleWindow(task.dueDate)) continue;

        if (task.status !== "DONE" && task.dueDate < today && (sub === "OVERDUE_TASK" || rule.type === "DEDUCTION")) {
          addCandidate(
            rule,
            "Task",
            task.id,
            `${rule.name}: Overdue task "${task.title}" passed deadline ${task.dueDate}.`,
            undefined,
            { taskId: task.id, dueDate: task.dueDate }
          );
        } else if (task.status === "DONE" && task.dueDate >= today && (sub === "COMPLETED_TASK_ON_TIME" || rule.type === "REWARD")) {
          addCandidate(
            rule,
            "Task",
            task.id,
            `${rule.name}: Task "${task.title}" completed on time.`,
            undefined,
            { taskId: task.id, dueDate: task.dueDate }
          );
        }
      }
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // MANUAL ADJUSTMENTS
  // ──────────────────────────────────────────────────────────────────────────
  for (const m of user.rewardTransactions) {
    candidates.push({
      ruleId: m.ruleId || undefined,
      ruleCode: m.ruleCode,
      category: "MANUAL",
      type: "ADJUSTMENT",
      points: m.points,
      entityType: m.entityType,
      entityId: m.entityId,
      reason: m.reason,
      meta: m.meta,
      isManual: true,
      actorId: m.actorId,
      createdAt: m.createdAt,
    });
  }

  // Sort candidate transactions deterministically by date
  candidates.sort((a, b) => {
    const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return timeA - timeB;
  });

  // Calculate final score starting from baseScore (100)
  let currentScore = policy.baseScore;
  const finalTransactions: Array<CandidateTx & { previousScore: number; newScore: number }> = [];

  const breakdown: Record<RewardCategory, { additions: number; deductions: number; net: number; count: number }> = {
    ATTENDANCE: { additions: 0, deductions: 0, net: 0, count: 0 },
    WORKLOG: { additions: 0, deductions: 0, net: 0, count: 0 },
    TASK: { additions: 0, deductions: 0, net: 0, count: 0 },
    LEAVE: { additions: 0, deductions: 0, net: 0, count: 0 },
    ON_DUTY: { additions: 0, deductions: 0, net: 0, count: 0 },
    LINKEDIN: { additions: 0, deductions: 0, net: 0, count: 0 },
    OTHER: { additions: 0, deductions: 0, net: 0, count: 0 },
    MANUAL: { additions: 0, deductions: 0, net: 0, count: 0 },
  };

  for (const cand of candidates) {
    const prev = currentScore;
    const next = Math.max(policy.minScore, Math.min(policy.maxScore, currentScore + cand.points));
    currentScore = next;

    finalTransactions.push({
      ...cand,
      previousScore: prev,
      newScore: next,
    });

    const cat = cand.category in breakdown ? cand.category : "OTHER";
    breakdown[cat].count++;
    if (cand.points > 0) {
      breakdown[cat].additions += cand.points;
    } else {
      breakdown[cat].deductions += Math.abs(cand.points);
    }
    breakdown[cat].net += cand.points;
  }

  // Persist updated transactions and score if requested
  if (options.persist) {
    await prisma.$transaction(async (tx) => {
      // Delete non-manual automated transactions
      await tx.rewardTransaction.deleteMany({
        where: { userId, isManual: false },
      });

      // Insert fresh evaluated transactions
      const nonManuals = finalTransactions.filter((t) => !t.isManual);
      if (nonManuals.length > 0) {
        await tx.rewardTransaction.createMany({
          data: nonManuals.map((t) => ({
            userId,
            ruleId: t.ruleId || null,
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
          })),
          skipDuplicates: true,
        });
      }

      // Update user current rewardPoints
      await tx.user.update({
        where: { id: userId },
        data: { rewardPoints: currentScore },
      });
    });
  }

  return {
    userId,
    score: currentScore,
    baseScore: policy.baseScore,
    maxScore: policy.maxScore,
    minScore: policy.minScore,
    enabled: true,
    breakdown,
    transactions: finalTransactions,
  };
}

/**
 * Recalculate reward scores for all active users across the portal.
 * Applies to both STUDENT and STUDENT_ADMIN roles.
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

  const tx = await prisma.rewardTransaction.create({
    data: {
      userId,
      ruleCode: "MANUAL_ADJUSTMENT",
      category: "MANUAL",
      type: "ADJUSTMENT",
      points,
      previousScore: prevScore,
      newScore,
      entityType: "Manual",
      entityId: `manual_${Date.now()}`,
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
    transaction: tx,
    previousScore: prevScore,
    newScore,
  };
}

/**
 * Fetch detailed reward summary for an individual student (or STUDENT_ADMIN).
 */
export async function getUserRewardSummary(userId: string) {
  const policy = await ensureDefaultPolicyAndRules();

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      rollNo: true,
      department: true,
      rewardPoints: true,
      rewardPointsEnabled: true,
    },
  });

  const transactions = await prisma.rewardTransaction.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: {
      rule: { select: { name: true, code: true, category: true } },
      actor: { select: { id: true, name: true, role: true } },
    },
    take: 200,
  });

  const score = user.rewardPoints;

  let tier: "OUTSTANDING" | "GOOD" | "SATISFACTORY" | "AT_RISK" = "OUTSTANDING";
  let tierLabel = "Outstanding (95%+)";
  if (score < 65) {
    tier = "AT_RISK";
    tierLabel = "Needs Immediate Attention (< 65%)";
  } else if (score < 80) {
    tier = "SATISFACTORY";
    tierLabel = "Satisfactory (65%–79%)";
  } else if (score < 95) {
    tier = "GOOD";
    tierLabel = "Good Performance (80%–94%)";
  }

  const breakdown: Record<RewardCategory, { additions: number; deductions: number; net: number; count: number }> = {
    ATTENDANCE: { additions: 0, deductions: 0, net: 0, count: 0 },
    WORKLOG: { additions: 0, deductions: 0, net: 0, count: 0 },
    TASK: { additions: 0, deductions: 0, net: 0, count: 0 },
    LEAVE: { additions: 0, deductions: 0, net: 0, count: 0 },
    ON_DUTY: { additions: 0, deductions: 0, net: 0, count: 0 },
    LINKEDIN: { additions: 0, deductions: 0, net: 0, count: 0 },
    OTHER: { additions: 0, deductions: 0, net: 0, count: 0 },
    MANUAL: { additions: 0, deductions: 0, net: 0, count: 0 },
  };

  const monthlyTrends: Record<string, { additions: number; deductions: number; count: number }> = {};

  for (const t of transactions) {
    const cat = (t.category in breakdown ? t.category : "OTHER") as RewardCategory;
    breakdown[cat].count++;
    if (t.points > 0) {
      breakdown[cat].additions += t.points;
    } else {
      breakdown[cat].deductions += Math.abs(t.points);
    }
    breakdown[cat].net += t.points;

    const monthKey = t.createdAt.toISOString().slice(0, 7); // YYYY-MM
    if (!monthlyTrends[monthKey]) {
      monthlyTrends[monthKey] = { additions: 0, deductions: 0, count: 0 };
    }
    monthlyTrends[monthKey].count++;
    if (t.points > 0) {
      monthlyTrends[monthKey].additions += t.points;
    } else {
      monthlyTrends[monthKey].deductions += Math.abs(t.points);
    }
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
 * Includes both STUDENT and STUDENT_ADMIN, custom rules, and scheduled holidays.
 */
export async function getAdminRewardAnalytics() {
  const policy = await ensureDefaultPolicyAndRules();

  const [users, allTransactions, scheduledHolidays] = await Promise.all([
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
        role: true,
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
    prisma.scheduledHoliday.findMany({
      orderBy: { date: "asc" },
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
    scheduledHolidays,
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
