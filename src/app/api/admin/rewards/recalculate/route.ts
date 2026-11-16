import { z } from "zod";
import { audit, fail, handler, ok } from "@/lib/api";
import { calculateUserRewardScore, recalculateAllRewardScores } from "@/lib/rewards-engine";
import { requireRewardAdmin } from "../route";

const recalculateSchema = z.object({
  userId: z.string().optional(),
});

export const POST = handler(async (request: Request) => {
  let admin;
  try {
    admin = await requireRewardAdmin();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Access denied";
    return fail(message, 403);
  }

  const { userId } = recalculateSchema.parse(await request.json().catch(() => ({})));

  if (userId) {
    const result = await calculateUserRewardScore(userId, { persist: true, actorId: admin.id });
    await audit(admin.id, "REWARD_RECALCULATE_USER", "User", userId, { score: result.score });
    return ok({ userResult: result });
  }

  const result = await recalculateAllRewardScores(admin.id);
  await audit(admin.id, "REWARD_RECALCULATE_ALL", "System", "ALL", { count: result.totalRecalculated });
  return ok(result);
});
