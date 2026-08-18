import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader || authHeader !== `Bearer ${process.env.SHEETS_WEBHOOK_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = await req.json();
    const { sheetName, eventType, headers, data } = payload;

    const record: Record<string, any> = {};
    headers.forEach((header: string, index: number) => {
      let val = data[index];
      if (val === undefined || val === null || val === "") {
        record[header] = null;
      } else if (header.endsWith("At") || header === "lastLoginAt" || header === "reviewedAt" || header === "completedAt") {
        record[header] = new Date(val);
      } else if (val === "true" || val === true) {
        record[header] = true;
      } else if (val === "false" || val === false) {
        record[header] = false;
      } else if (!isNaN(Number(val)) && typeof val === "string") {
        record[header] = Number(val);
      } else {
        record[header] = val;
      }
    });

    if (!record.id) {
      return NextResponse.json({ error: "Missing record ID" }, { status: 400 });
    }

    // Map sheet name to Prisma model name
    const modelMapping: Record<string, string> = {
      Users: "user",
      Attendance: "attendance",
      Worklogs: "worklog",
      Tasks: "task",
      ActivityPasses: "activityPass",
      Notifications: "notification",
      NotificationReads: "notificationRead",
      Notes: "note",
      LinkedinPosts: "linkedinPost",
      RewardEntries: "rewardEntry",
      ExtensionRequests: "extensionRequest",
      AuditLogs: "auditLog",
    };

    const prismaModel = modelMapping[sheetName];
    if (!prismaModel) {
      return NextResponse.json({ error: `Unsupported sheet: ${sheetName}` }, { status: 400 });
    }

    const dbModel = (prisma as any)[prismaModel];

    if (eventType === "UPDATE" || eventType === "INSERT") {
      await dbModel.upsert({
        where: { id: record.id },
        update: record,
        create: record,
      });
      console.log(`📡 Real-time Sync: Upserted record ${record.id} in model ${prismaModel}`);
    } else if (eventType === "DELETE") {
      await dbModel.delete({
        where: { id: record.id },
      });
      console.log(`📡 Real-time Sync: Deleted record ${record.id} in model ${prismaModel}`);
    }

    return NextResponse.json({ status: "SUCCESS" });
  } catch (error: any) {
    console.error("❌ Webhook sync error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
