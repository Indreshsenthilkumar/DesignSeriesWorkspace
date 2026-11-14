import { PrismaClient } from "@prisma/client";
import { writeSheetRow } from "./google-sheets";

function makePrismaClient() {
  const base = new PrismaClient({
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

  return base.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const result = await query(args);

          // Mirror write operations back to Google Sheets if configured
          const writeActions = ["create", "update", "upsert", "delete"];
          if (writeActions.includes(operation) && process.env.GOOGLE_SPREADSHEET_ID) {
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
        },
      },
    },
  });
}

type ExtendedPrismaClient = ReturnType<typeof makePrismaClient>;

const globalForPrisma = globalThis as unknown as {
  prisma?: ExtendedPrismaClient;
};

export const prisma = globalForPrisma.prisma ?? makePrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export default prisma;
