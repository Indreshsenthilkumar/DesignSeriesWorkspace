import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth";
import { calculateUserRewardScore, getUserRewardSummary } from "@/lib/rewards-engine";
import { RewardsClient } from "./RewardsClient";

export const metadata: Metadata = { title: "Reward Points" };
export const dynamic = "force-dynamic";

export default async function RewardsPage() {
  const user = await requireUser();

  // Check if disabled via portalNavDisabled
  const disabledList = (user.portalNavDisabled || "")
    .split(",")
    .map((s) => s.trim().toLowerCase());

  if (disabledList.includes("rewards") || user.rewardPointsEnabled === false) {
    return (
      <div className="mx-auto max-w-xl py-16 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-slate-500">
          <span className="text-2xl">🏆</span>
        </div>
        <h1 className="text-xl font-bold text-slate-800">Reward Points Disabled</h1>
        <p className="mt-2 text-sm text-slate-500">
          Reward Points access is currently not enabled for your account. Please reach out to your mentor or programme administrator if you believe this is in error.
        </p>
      </div>
    );
  }

  await calculateUserRewardScore(user.id, { persist: true });
  const initialSummary = await getUserRewardSummary(user.id);

  return <RewardsClient user={user} initialSummary={initialSummary} />;
}
