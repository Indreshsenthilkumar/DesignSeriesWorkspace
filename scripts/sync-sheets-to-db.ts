import { PrismaClient } from "@prisma/client";
import { getSheetRows } from "../src/lib/google-sheets";

const prisma = new PrismaClient();

async function main() {
  console.log("🔄 Starting database sync from Google Sheets...");

  const tabs = [
    { name: "Users", model: "user" },
    { name: "Attendance", model: "attendance" },
    { name: "Worklogs", model: "worklog" },
    { name: "Tasks", model: "task" },
    { name: "ActivityPasses", model: "activityPass" },
    { name: "Notifications", model: "notification" },
    { name: "NotificationReads", model: "notificationRead" },
    { name: "Notes", model: "note" },
    { name: "LinkedinPosts", model: "linkedinPost" },
    { name: "RewardEntries", model: "rewardEntry" },
    { name: "ExtensionRequests", model: "extensionRequest" },
    { name: "AuditLogs", model: "auditLog" }
  ];

  for (const tab of tabs) {
    console.log(`📥 Pulling tab "${tab.name}"...`);
    try {
      const rows = await getSheetRows(tab.name);
      console.log(`Fetched ${rows.length} rows for ${tab.name}.`);

      // Clear the local table
      await (prisma as any)[tab.model].deleteMany({});

      // Format date fields and boolean values correctly for Prisma
      const records = rows.map((row) => {
        const formatted: Record<string, any> = {};
        for (const [key, value] of Object.entries(row)) {
          if (value === "") {
            if (key.endsWith("Id") || key === "lastLoginAt" || key === "reviewedAt" || key === "completedAt" || key === "dueDate" || key === "markedBy") {
              formatted[key] = null;
            } else {
              formatted[key] = "";
            }
          } else if (key.endsWith("At") || key === "lastLoginAt" || key === "reviewedAt" || key === "completedAt") {
            const cleanVal = typeof value === "string" ? value.replace(/^\*/, "").trim() : value;
            const parsedDate = new Date(cleanVal);
            formatted[key] = isNaN(parsedDate.getTime()) ? new Date() : parsedDate;
          } else if (["rollNo", "mobile", "year", "date", "fromTime", "toTime", "dueDate"].includes(key)) {
            formatted[key] = String(value);
          } else {
            formatted[key] = value;
          }
        }
        return formatted;
      });

      // Insert all records
      if (records.length > 0) {
        await (prisma as any)[tab.model].createMany({
          data: records,
        });
      }
      console.log(`✅ Synced ${records.length} records into local table "${tab.model}".`);
    } catch (error) {
      console.error(`❌ Failed to sync tab ${tab.name}:`, error);
    }
  }

  console.log("🎉 Database sync complete!");
}

main()
  .catch((e) => {
    console.error("❌ Sync script failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
