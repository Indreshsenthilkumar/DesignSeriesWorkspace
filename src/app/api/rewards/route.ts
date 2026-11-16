import { fail, handler, ok } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { calculateUserRewardScore, getUserRewardSummary } from "@/lib/rewards-engine";

export const GET = handler(async () => {
  const user = await requireApiUser();
  if (user.systemStatus === "SUSPENDED") {
    return fail("Account is suspended.", 403);
  }

  // Check if reward points is disabled for this user via portalNavDisabled
  const disabledList = (user.portalNavDisabled || "")
    .split(",")
    .map((s) => s.trim().toLowerCase());
  if (disabledList.includes("rewards") || user.rewardPointsEnabled === false) {
    return fail("Reward Points feature is not enabled for your account.", 403);
  }

  await calculateUserRewardScore(user.id, { persist: true });
  const summary = await getUserRewardSummary(user.id);
  return ok(summary);
});
