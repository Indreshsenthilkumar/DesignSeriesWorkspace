import { PrismaClient } from "@prisma/client";
import { writeSheetRow } from "./google-sheets";

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
