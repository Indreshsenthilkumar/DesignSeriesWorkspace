import { prisma } from "./prisma";

export type TrackedSection =
  | "tasks"
  | "leaves"
  | "worklog"
  | "passes"
  | "console_leaves"
  | "console_tasks"
  | "console_worklogs"
  | "console_passes"
  | "announcements"
  | "support"
  | "console_support";

/**
 * Marks that a user has opened/read a specific section right now.
 * Non-blocking and catches errors so navigation is never interrupted.
 */
export async function markSectionViewed(userId: string, section: TrackedSection) {
  try {
    const delegate = (prisma as any)?.userSectionView;
    if (!delegate?.upsert) return;

    await delegate.upsert({
      where: {
        userId_section: {
          userId,
          section,
        },
      },
      update: {
        viewedAt: new Date(),
      },
      create: {
        userId,
        section,
        viewedAt: new Date(),
      },
    });
  } catch (err) {
    console.error(`[badge-tracking] Failed to mark section viewed for ${userId}:${section}`, err);
  }
}

/**
 * Returns a dictionary of section -> last viewed DateTime for the given user.
 */
export async function getSectionViewTimes(userId: string): Promise<Record<string, Date>> {
  try {
    const delegate = (prisma as any)?.userSectionView;
    if (!delegate?.findMany) return {};

    const views = await delegate.findMany({
      where: { userId },
      select: { section: true, viewedAt: true },
    });

    const result: Record<string, Date> = {};
    for (const v of views) {
      result[v.section] = v.viewedAt;
    }
    return result;
  } catch (err) {
    console.error(`[badge-tracking] Failed to get section view times for ${userId}`, err);
    return {};
  }
}
