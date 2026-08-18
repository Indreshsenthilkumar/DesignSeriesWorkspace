import { getSheetsClient } from "../src/lib/google-sheets";
import { PrismaClient } from "@prisma/client";
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


const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID;
const prisma = new PrismaClient();

async function main() {
  console.log("🧹 Clearing all data from Google Sheets and local database...");
  const sheets = getSheetsClient();

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

  // 1. Clear all rows in Google Sheets (except header row 1)
  for (const tab of tabs) {
    console.log(`Clearing tab "${tab.name}"...`);
    try {
      // Clear everything from row 2 onwards
      await sheets.spreadsheets.values.clear({
        spreadsheetId: SPREADSHEET_ID,
        range: `${tab.name}!A2:Z`,
      });
    } catch (e) {
      console.warn(`Could not clear tab ${tab.name}:`, e);
    }

    // Clear local SQLite table
    await (prisma as any)[tab.model].deleteMany({});
  }

  // 2. Re-create exactly ONE default Super Admin user in Google Sheets so they can log in
  // Default password hash for "designseries@2026"
  const defaultAdmin = {
    id: "cm01adminid1234567890",
    name: "Super Admin",
    rollNo: "20354",
    email: "do20354@bitsathy.ac.in",
    department: "Administration",
    year: "Staff",
    mobile: "9876543210",
    domain: "Administration",
    mentorName: "Director",
    linkedin: "",
    github: "",
    role: "SUPER_ADMIN",
    systemStatus: "ACTIVE",
    // bcrypt hash of "designseries@2026"
    passwordHash: "$2a$10$9c3w1c/56T0pWv5U70qU9.nS.oQ/7T4f.8vLXe3nS77jX.eW5uW4q",
    mustChangePassword: "false",
    rewardPoints: "0",
    avatarSeed: "42",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const userHeaders = [
    "id", "name", "rollNo", "email", "department", "year", "mobile", "domain",
    "mentorName", "linkedin", "github", "role", "systemStatus", "passwordHash",
    "mustChangePassword", "rewardPoints", "avatarSeed", "createdAt", "updatedAt"
  ];

  const adminRow = userHeaders.map(h => (defaultAdmin as any)[h]);

  console.log("👤 Creating default Super Admin user in Google Sheets...");
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: "Users!A:A",
    valueInputOption: "RAW",
    requestBody: {
      values: [adminRow],
    },
  });

  // 3. Sync SQLite from Google Sheets (which now only has the one admin user)
  console.log("🔄 Syncing local database cache...");
  // Clear and insert to local prisma User table
  await prisma.user.create({
    data: {
      id: defaultAdmin.id,
      name: defaultAdmin.name,
      rollNo: defaultAdmin.rollNo,
      email: defaultAdmin.email,
      department: defaultAdmin.department,
      year: defaultAdmin.year,
      mobile: defaultAdmin.mobile,
      domain: defaultAdmin.domain,
      mentorName: defaultAdmin.mentorName,
      linkedin: defaultAdmin.linkedin,
      github: defaultAdmin.github,
      role: defaultAdmin.role,
      systemStatus: defaultAdmin.systemStatus,
      passwordHash: defaultAdmin.passwordHash,
      mustChangePassword: false,
      rewardPoints: 0,
      avatarSeed: 42,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
  });

  console.log("✅ All test data cleared! Only 1 Super Admin remains in Google Sheets and local database.");
}

main()
  .catch((e) => {
    console.error("❌ Cleanup failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
