import { z } from "zod";
import { audit, fail, handler, ok } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requireRewardAdmin } from "../route";

const policySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(2).max(100).optional(),
  baseScore: z.number().int().min(1).max(1000).optional(),
  maxScore: z.number().int().min(1).max(1000).optional(),
  minScore: z.number().int().min(0).max(100).optional(),
  periodType: z.enum(["MONTHLY", "SEMESTER", "ANNUAL", "CUSTOM"]).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  description: z.string().max(300).optional(),
});

export const PATCH = handler(async (request: Request) => {
  let admin;
  try {
    admin = await requireRewardAdmin();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Access denied";
    return fail(message, 403);
  }

  const { id, ...data } = policySchema.parse(await request.json());

  const policy = await prisma.rewardPolicy.update({
    where: { id },
    data,
  });

  await audit(admin.id, "REWARD_POLICY_UPDATE", "RewardPolicy", id, {
    changes: data,
  });

  return ok({ policy });
});
