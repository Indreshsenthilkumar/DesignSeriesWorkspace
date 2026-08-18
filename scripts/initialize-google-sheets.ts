import { PrismaClient } from "@prisma/client";
import { getSheetsClient } from "../src/lib/google-sheets";

const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID;
const prisma = new PrismaClient();

async function main() {
  console.log("⚙️ Starting Google Sheets initialization...");
  const sheets = getSheetsClient();

  // Define all tabs and their required headers
  const requiredTabs = [
    {
      name: "Users",
      model: "user",
      headers: [
        "id", "name", "rollNo", "email", "department", "year", "mobile", "domain",
        "mentorName", "linkedin", "github", "role", "systemStatus", "passwordHash",
        "mustChangePassword", "rewardPoints", "avatarSeed", "createdAt", "updatedAt"
      ]
    },
    {
      name: "Attendance",
      model: "attendance",
      headers: ["id", "userId", "date", "hour", "reason", "status", "source", "markedBy", "createdAt"]
    },
    {
      name: "Worklogs",
      model: "worklog",
      headers: [
        "id", "userId", "date", "s1", "s2", "s3", "s4", "s5", "taskId", "status",
        "mentorRemark", "reviewedBy", "reviewedAt", "createdAt", "updatedAt"
      ]
    },
    {
      name: "Tasks",
      model: "task",
      headers: [
        "id", "title", "description", "authorId", "assigneeId", "domain", "year",
        "priority", "status", "dueDate", "points", "completedAt", "createdAt", "updatedAt"
      ]
    },
    {
      name: "ActivityPasses",
      model: "activityPass",
      headers: [
        "id", "userId", "date", "fromTime", "toTime", "destination", "reason", "category",
        "status", "passCode", "remark", "reviewerId", "reviewedAt", "createdAt", "updatedAt"
      ]
    },
    {
      name: "Notifications",
      model: "notification",
      headers: ["id", "title", "body", "category", "audience", "audienceValue", "pinned", "link", "authorId", "createdAt"]
    },
    {
      name: "NotificationReads",
      model: "notificationRead",
      headers: ["id", "notificationId", "userId", "readAt"]
    },
    {
      name: "Notes",
      model: "note",
      headers: ["id", "userId", "title", "body", "color", "pinned", "createdAt", "updatedAt"]
    },
    {
      name: "LinkedinPosts",
      model: "linkedinPost",
      headers: ["id", "userId", "url", "caption", "postedOn", "reactions", "comments", "verified", "createdAt"]
    },
    {
      name: "RewardEntries",
      model: "rewardEntry",
      headers: ["id", "userId", "points", "reason", "source", "createdAt"]
    },
    {
      name: "ExtensionRequests",
      model: "extensionRequest",
      headers: ["id", "userId", "date", "reason", "status", "remark", "reviewerId", "reviewedAt", "createdAt"]
    },
    {
      name: "AuditLogs",
      model: "auditLog",
      headers: ["id", "actorId", "action", "entity", "entityId", "meta", "createdAt"]
    }
  ];

  // 1. Fetch metadata about the existing sheets
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const existingSheetNames = meta.data.sheets?.map(s => s.properties?.title) || [];

  // 2. Automatically create missing tabs
  for (const tab of requiredTabs) {
    if (!existingSheetNames.includes(tab.name)) {
      console.log(`➕ Creating missing tab "${tab.name}"...`);
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: {
          requests: [
            {
              addSheet: {
                properties: {
                  title: tab.name,
                }
              }
            }
          ]
        }
      });
    }

    // 3. Write headers
    console.log(`✍️ Writing headers for tab "${tab.name}"...`);
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${tab.name}!A1:1`,
      valueInputOption: "RAW",
      requestBody: {
        values: [tab.headers]
      }
    });

    // 4. Push local SQLite database data (if any exists) to Google Sheets
    const localRecords = await (prisma as any)[tab.model].findMany();
    if (localRecords.length > 0) {
      console.log(`📤 Pushing ${localRecords.length} records from local cache to "${tab.name}" tab...`);
      const rowsToPush = localRecords.map((record: any) => {
        return tab.headers.map((header) => {
          const val = record[header];
          if (val === null || val === undefined) return "";
          if (val instanceof Date) return val.toISOString();
          if (typeof val === "object") return JSON.stringify(val);
          return String(val);
        });
      });

      // Batch update range below headers
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${tab.name}!A2`,
        valueInputOption: "RAW",
        requestBody: {
          values: rowsToPush
        }
      });
      console.log(`✅ Tab "${tab.name}" populated successfully.`);
    }
  }

  console.log("🎉 Google Sheets initialization complete!");
}

main()
  .catch((e) => {
    console.error("❌ Initialization failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
