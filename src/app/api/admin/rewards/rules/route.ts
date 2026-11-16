import { z } from "zod";
import { audit, fail, handler, ok } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requireRewardAdmin } from "../route";

const updateRuleSchema = z.object({
  id: z.string().min(1),
  points: z.number().int().min(0).max(100).optional(),
  isEnabled: z.boolean().optional(),
  isPercentage: z.boolean().optional(),
  description: z.string().max(300).optional(),
  name: z.string().min(2).max(100).optional(),
  maxDeductionsPerPeriod: z.number().int().min(1).nullable().optional(),
  gracePeriodDays: z.number().int().min(0).max(30).optional(),
});

export const PATCH = handler(async (request: Request) => {
  let admin;
  try {
    admin = await requireRewardAdmin();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Access denied";
    return fail(message, 403);
  }

  const { id, ...data } = updateRuleSchema.parse(await request.json());

  const rule = await prisma.rewardRule.update({
    where: { id },
    data,
  });

  await audit(admin.id, "REWARD_RULE_UPDATE", "RewardRule", id, {
    code: rule.code,
    changes: data,
  });

  return ok({ rule });
});

const createRuleSchema = z.object({
  code: z.string().min(3).max(40).regex(/^[A-Z0-9_]+$/, "Code must be uppercase with underscores (e.g. CUSTOM_RULE)"),
  name: z.string().min(2).max(100),
  category: z.enum(["ATTENDANCE", "LEAVE", "ON_DUTY", "WORKLOG", "TASK", "OTHER"]),
  type: z.enum(["DEDUCTION", "REWARD"]),
  points: z.number().int().min(0).max(100),
  isPercentage: z.boolean().default(true),
  isEnabled: z.boolean().default(true),
  description: z.string().max(300).default(""),
});

export const POST = handler(async (request: Request) => {
  let admin;
  try {
    admin = await requireRewardAdmin();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Access denied";
    return fail(message, 403);
  }

  const data = createRuleSchema.parse(await request.json());

  const policy = await prisma.rewardPolicy.findFirst({
    where: { isActive: true },
  });

  const rule = await prisma.rewardRule.create({
    data: {
      ...data,
      policyId: policy?.id,
    },
  });

  await audit(admin.id, "REWARD_RULE_CREATE", "RewardRule", rule.id, {
    code: rule.code,
    name: rule.name,
    points: rule.points,
  });

  return ok({ rule });
});
