import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import * as fs from "fs";

// Load .env manually to ensure script is fully standalone
if (fs.existsSync(".env")) {
  const envContent = fs.readFileSync(".env", "utf8");
  envContent.split("\n").forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const [key, ...valueParts] = trimmed.split("=");
    if (key && valueParts.length > 0) {
      const val = valueParts.join("=").trim().replace(/^["'](.*)["']$/, "$1").replace(/\\n/g, "\n");
      process.env[key.trim()] = val;
    }
  });
}

const prisma = new PrismaClient();

async function main() {
  console.log("🧹 Clearing all demo data from the database...");

  // 1. Delete all transactional tables (LeaveRequest, Attendance, Worklog, Tasks, Passes, etc.)
  console.log("Deleting leave requests...");
  await prisma.leaveRequest.deleteMany({});

  console.log("Deleting attendance records...");
  await prisma.attendance.deleteMany({});

  console.log("Deleting worklogs...");
  await prisma.worklog.deleteMany({});

  console.log("Deleting tasks...");
  await prisma.task.deleteMany({});

  console.log("Deleting activity passes...");
  await prisma.activityPass.deleteMany({});

  console.log("Deleting notification reads...");
  await prisma.notificationRead.deleteMany({});

  console.log("Deleting notifications...");
  await prisma.notification.deleteMany({});

  console.log("Deleting notes...");
  await prisma.note.deleteMany({});

  console.log("Deleting LinkedIn posts...");
  await prisma.linkedinPost.deleteMany({});

  console.log("Deleting reward entries...");
  await prisma.rewardEntry.deleteMany({});

  console.log("Deleting extension requests...");
  await prisma.extensionRequest.deleteMany({});

  console.log("Deleting audit logs...");
  await prisma.auditLog.deleteMany({});

  // 2. Delete all demo users except the official Super Admin & Admin
  console.log("Deleting all demo users...");
  await prisma.user.deleteMany({
    where: {
      email: {
        notIn: ["do20354@bitsathy.ac.in", "admin@bitsathy.ac.in"],
      },
      rollNo: {
        notIn: ["20354", "ADMIN01"],
      },
    },
  });

  // 3. Ensure Super Admin and Admin accounts exist with valid password hashes
  const adminPasswordHash = await bcrypt.hash("designseries@2026", 10);

  const superAdminEmail = "do20354@bitsathy.ac.in";
  await prisma.user.upsert({
    where: { email: superAdminEmail },
    update: {
      name: "Super Admin",
      rollNo: "20354",
      department: "Administration",
      year: "Staff",
      mobile: "9876543210",
      domain: "Administration",
      mentorName: "Director",
      role: "SUPER_ADMIN",
      systemStatus: "ACTIVE",
      passwordHash: adminPasswordHash,
      mustChangePassword: false,
      permUserManagement: true,
      permScanStudentQr: true,
      permMentorTasks: true,
      permLinkedinTracker: true,
      permWorklogs: true,
      permNotifications: true,
      permAttendanceLogs: true,
      permExtensionRequest: true,
      permAdminDatabase: true,
      permActivityApproval: true,
    },
    create: {
      id: superAdminEmail,
      email: superAdminEmail,
      name: "Super Admin",
      rollNo: "20354",
      department: "Administration",
      year: "Staff",
      mobile: "9876543210",
      domain: "Administration",
      mentorName: "Director",
      role: "SUPER_ADMIN",
      systemStatus: "ACTIVE",
      passwordHash: adminPasswordHash,
      mustChangePassword: false,
      permUserManagement: true,
      permScanStudentQr: true,
      permMentorTasks: true,
      permLinkedinTracker: true,
      permWorklogs: true,
      permNotifications: true,
      permAttendanceLogs: true,
      permExtensionRequest: true,
      permAdminDatabase: true,
      permActivityApproval: true,
    },
  });

  const adminEmail = "admin@bitsathy.ac.in";
  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      name: "Portal Admin",
      rollNo: "ADMIN01",
      department: "DesignSeries Administration",
      year: "Staff",
      mobile: "9876543211",
      domain: "Administration",
      mentorName: "Director",
      role: "ADMIN",
      systemStatus: "ACTIVE",
      passwordHash: adminPasswordHash,
      mustChangePassword: false,
      permUserManagement: true,
      permScanStudentQr: true,
      permMentorTasks: true,
      permLinkedinTracker: true,
      permWorklogs: true,
      permNotifications: true,
      permAttendanceLogs: true,
      permExtensionRequest: true,
      permAdminDatabase: true,
      permActivityApproval: true,
    },
    create: {
      id: adminEmail,
      email: adminEmail,
      name: "Portal Admin",
      rollNo: "ADMIN01",
      department: "DesignSeries Administration",
      year: "Staff",
      mobile: "9876543211",
      domain: "Administration",
      mentorName: "Director",
      role: "ADMIN",
      systemStatus: "ACTIVE",
      passwordHash: adminPasswordHash,
      mustChangePassword: false,
      permUserManagement: true,
      permScanStudentQr: true,
      permMentorTasks: true,
      permLinkedinTracker: true,
      permWorklogs: true,
      permNotifications: true,
      permAttendanceLogs: true,
      permExtensionRequest: true,
      permAdminDatabase: true,
      permActivityApproval: true,
    },
  });

  // Optional: clear Google Sheets if credentials are present
  if (process.env.GOOGLE_SPREADSHEET_ID) {
    try {
      const { getSheetsClient } = await import("../src/lib/google-sheets");
      const sheets = getSheetsClient();
      const sheetTabs = [
        "Attendance",
        "Worklogs",
        "Tasks",
        "ActivityPasses",
        "Notifications",
        "NotificationReads",
        "Notes",
        "LinkedinPosts",
        "RewardEntries",
        "ExtensionRequests",
        "AuditLogs",
        "LeaveRequests",
      ];
      for (const tab of sheetTabs) {
        try {
          await sheets.spreadsheets.values.clear({
            spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID,
            range: `${tab}!A2:Z`,
          });
        } catch (e) {
          // ignore if tab doesn't exist
        }
      }
      console.log("Cleared Google Sheets transaction tabs.");
    } catch (e) {
      console.log("Skipping Google Sheets cleanup (not configured or offline).");
    }
  }

  const remainingUsers = await prisma.user.count();
  const remainingAttendance = await prisma.attendance.count();
  const remainingWorklogs = await prisma.worklog.count();
  const remainingLeaves = await prisma.leaveRequest.count();

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("✅ All demo data successfully wiped from the database!");
  console.log(`   • Users in DB:          ${remainingUsers} (Super Admin & Admin only)`);
  console.log(`   • Attendance in DB:     ${remainingAttendance}`);
  console.log(`   • Worklogs in DB:       ${remainingWorklogs}`);
  console.log(`   • Leave Requests in DB: ${remainingLeaves}`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
}

main()
  .catch((e) => {
    console.error("❌ Cleanup failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
