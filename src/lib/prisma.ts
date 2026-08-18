import { PrismaClient } from "@prisma/client";
import { writeSheetRow } from "./google-sheets";
import { execSync } from "child_process";
import * as fs from "fs";
import path from "path";

// Automatically initialize and seed the SQLite database in /tmp if running on Vercel
if (process.env.NODE_ENV === "production" && process.env.DATABASE_URL?.startsWith("file:/tmp/")) {
  const dbPath = process.env.DATABASE_URL.replace("file:", "");
  if (!fs.existsSync(dbPath)) {
    console.log("🛠️ Vercel Environment: Initializing SQLite database cache in /tmp...");
    try {
      const dir = path.dirname(dbPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      // Push the database schema
      execSync("npx prisma db push --accept-data-loss", {
        stdio: "inherit",
        env: { ...process.env }
      });
      console.log("✅ Schema created.");
      
      // Populate from Google Sheets
      execSync("npx tsx scripts/sync-sheets-to-db.ts", {
        stdio: "inherit",
        env: { ...process.env }
      });
      console.log("✅ Seeding from Google Sheets complete.");
    } catch (err) {
      console.error("❌ Auto-initialization failed:", err);
    }
  }
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
      async create({ model, args, query }) {
        const result = await query(args);
        const sheetName = prismaToSheetMapping[model.toLowerCase()];
        if (sheetName) {
          writeSheetRow(sheetName, "CREATE", result).catch((err) =>
            console.error(`❌ Google Sheets sync failed on create for ${model}:`, err)
          );
        }
        return result;
      },
      async update({ model, args, query }) {
        const result = await query(args);
        const sheetName = prismaToSheetMapping[model.toLowerCase()];
        if (sheetName) {
          writeSheetRow(sheetName, "UPDATE", result).catch((err) =>
            console.error(`❌ Google Sheets sync failed on update for ${model}:`, err)
          );
        }
        return result;
      },
      async upsert({ model, args, query }) {
        const result = await query(args);
        const sheetName = prismaToSheetMapping[model.toLowerCase()];
        if (sheetName) {
          writeSheetRow(sheetName, "UPDATE", result).catch((err) =>
            console.error(`❌ Google Sheets sync failed on upsert for ${model}:`, err)
          );
        }
        return result;
      },
      async delete({ model, args, query }) {
        const result = await query(args);
        const sheetName = prismaToSheetMapping[model.toLowerCase()];
        if (sheetName) {
          writeSheetRow(sheetName, "DELETE", result).catch((err) =>
            console.error(`❌ Google Sheets sync failed on delete for ${model}:`, err)
          );
        }
        return result;
      },
    },
  },
});

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = basePrisma;
export default prisma;
