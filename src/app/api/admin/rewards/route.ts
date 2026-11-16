import { fail, handler, ok } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { can, isAdminLike, type PermissionSubject } from "@/lib/permissions";
import { getAdminRewardAnalytics } from "@/lib/rewards-engine";

export async function requireRewardAdmin() {
  const user = await requireApiUser();
  const subject = user as PermissionSubject;
  const allowed =
    isAdminLike(subject) ||
    can(subject, "permRewardManagement") ||
    can(subject, "permUserManagement");
  if (!allowed) {
    throw new Error("You do not have permission to manage reward points.");
  }
  return user;
}

export const GET = handler(async () => {
  try {
    await requireRewardAdmin();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Access denied";
    return fail(message, 403);
  }

  const data = await getAdminRewardAnalytics();
  return ok(data);
});
