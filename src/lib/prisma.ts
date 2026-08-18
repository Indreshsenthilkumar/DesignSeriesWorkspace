import { PrismaClient } from "@prisma/client";
import { writeSheetRow, getSheetRows } from "./google-sheets";
import * as fs from "fs";
import path from "path";

// Populate cache function directly in JS to avoid shell sub-processes
async function syncGoogleSheetsToLocalCache(prismaClient: any) {
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
    try {
      const rows = await getSheetRows(tab.name);
      await prismaClient[tab.model].deleteMany({});
      
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

      if (records.length > 0) {
        await prismaClient[tab.model].createMany({
          data: records,
        });
      }
    } catch (e) {
      console.error(`❌ Failed to sync ${tab.name}:`, e);
    }
  }
}

// Keep track of initialization state in memory
let isDatabaseInitialized = false;

async function ensureDatabaseInitialized(prismaClient: any) {
  if (isDatabaseInitialized) return;

  if (process.env.NODE_ENV === "production" && process.env.DATABASE_URL?.startsWith("file:/tmp/")) {
    const dbPath = process.env.DATABASE_URL.replace("file:", "");
    if (!fs.existsSync(dbPath)) {
      console.log("🛠️ Vercel Environment: Copying pre-built SQLite database cache to /tmp...");
      try {
        const dir = path.dirname(dbPath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        
        // Copy pre-built db file created during build time
        const sourceDbPath = path.join(process.cwd(), "prisma", "dev.db");
        if (fs.existsSync(sourceDbPath)) {
          fs.copyFileSync(sourceDbPath, dbPath);
          console.log("✅ Pre-built database copied to /tmp.");
        } else {
          console.error(`❌ Pre-built database not found at ${sourceDbPath}!`);
          // Try to locate it in fallback paths
          const fallbackPath = path.join(__dirname, "..", "..", "prisma", "dev.db");
          if (fs.existsSync(fallbackPath)) {
            fs.copyFileSync(fallbackPath, dbPath);
            console.log("✅ Pre-built database copied from fallback path to /tmp.");
          } else {
            console.error("❌ Fallback database path also not found! Creating empty file.");
            fs.writeFileSync(dbPath, "");
          }
        }
        
        // Block and wait for Google Sheets data sync on first query execution
        console.log("⏳ Initializing local SQLite cache from Google Sheets...");
        await syncGoogleSheetsToLocalCache(prismaClient);
        console.log("✅ SQLite cache successfully populated from Google Sheets.");
      } catch (err) {
        console.error("❌ Auto-initialization failed:", err);
      }
    }
  }
  isDatabaseInitialized = true;
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

const basePrisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

const prismaToSheetMapping: Record<string, string> = {
  user: "Users",
  attendance: "Attendance",
  worklog: "Worklogs",
  task: "Tasks",
  activitypass: "ActivityPasses",
  notification: "Notifications",
  notificationread: "NotificationReads",
  note: "Notes",
  linkedinpost: "LinkedinPosts",
  rewardentry: "RewardEntries",
  extensionrequest: "ExtensionRequests",
  auditlog: "AuditLogs",
};

export const prisma = basePrisma.$extends({
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        // Intercept operation to ensure database is copied and synced before executing query
        await ensureDatabaseInitialized(basePrisma);
        
        const result = await query(args);
        
        // Mirror write operations back to Google Sheets
        const writeActions = ["create", "update", "upsert", "delete"];
        if (writeActions.includes(operation)) {
          const sheetName = prismaToSheetMapping[model.toLowerCase()];
          if (sheetName) {
            let action: "CREATE" | "UPDATE" | "DELETE" = "UPDATE";
            if (operation === "create") action = "CREATE";
            if (operation === "delete") action = "DELETE";

            writeSheetRow(sheetName, action, result).catch((err) =>
              console.error(`❌ Google Sheets sync failed on ${operation} for ${model}:`, err)
            );
          }
        }
        
        return result;
      }
    },
  },
});

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = basePrisma;
export default prisma;
