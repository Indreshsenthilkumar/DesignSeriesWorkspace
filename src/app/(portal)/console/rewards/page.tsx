import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { requireUser } from "@/lib/auth";
import { can, isAdminLike, type PermissionSubject } from "@/lib/permissions";
import { getAdminRewardAnalytics } from "@/lib/rewards-engine";
import { AdminRewardsClient } from "./AdminRewardsClient";

export const metadata: Metadata = { title: "Reward Points Management" };
export const dynamic = "force-dynamic";

export default async function AdminRewardsPage() {
  const user = await requireUser();
  const subject = user as PermissionSubject;

  const allowed =
    isAdminLike(subject) ||
    can(subject, "permRewardManagement") ||
    can(subject, "permUserManagement");

  if (!allowed) {
    redirect("/dashboard");
  }

  const initialData = await getAdminRewardAnalytics();

  return <AdminRewardsClient user={user} initialData={initialData} />;
}
