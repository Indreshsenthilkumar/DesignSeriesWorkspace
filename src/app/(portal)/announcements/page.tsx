import type { Metadata } from "next";

import { PageHeader } from "@/components/shell/PageHeader";
import { requireUser } from "@/lib/auth";
import { visibleNotifications } from "@/lib/queries";
import { prisma } from "@/lib/prisma";
import { markSectionViewed } from "@/lib/badge-tracking";

import { AnnouncementsClient, type AnnouncementRow } from "./AnnouncementsClient";

export const metadata: Metadata = { title: "Announcements" };
export const dynamic = "force-dynamic";

export default async function AnnouncementsPage() {
  const user = await requireUser();
  const items = await visibleNotifications(user);

  // Mark all unread announcements as read upon visiting the page
  const unreadItems = items.filter((item) => !item.read);
  if (unreadItems.length > 0) {
    await prisma.notificationRead.createMany({
      data: unreadItems.map((n) => ({
        notificationId: n.id,
        userId: user.id,
      })),
      skipDuplicates: true,
    });
  }
  await markSectionViewed(user.id, "announcements");

  const rows: AnnouncementRow[] = items.map((item) => ({
    id: item.id,
    title: item.title,
    body: item.body,
    category: item.category,
    audience: item.audience,
    audienceValue: item.audienceValue,
    pinned: item.pinned,
    link: item.link,
    createdAt: item.createdAt.toISOString(),
    authorName: item.author.name,
    read: item.read,
  }));

  const unread = rows.filter((row) => !row.read).length;

  return (
    <div>
      <PageHeader
        title="Announcements"
        description={
          unread > 0
            ? `${unread} unread. Notices addressed to everyone, to your year, or to your domain all appear here.`
            : "You are up to date. Notices addressed to everyone, to your year, or to your domain all appear here."
        }
      />
      <AnnouncementsClient items={rows} />
    </div>
  );
}
