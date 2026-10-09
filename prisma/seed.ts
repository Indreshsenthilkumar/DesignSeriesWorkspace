import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const DEFAULT_PASSWORD = process.env.SEED_DEFAULT_PASSWORD ?? "designseries@2026";

async function main() {
  console.log("🌱 Initializing clean production database on Neon...");

  const adminPasswordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);
  const superAdminRollHash = await bcrypt.hash("20354", 10);

  // 1. Super Admin Account
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

  // 2. Admin Account
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

  console.log("✅ Clean seed complete. Admin accounts configured:");
  console.log("   • Super Admin: do20354@bitsathy.ac.in (Roll: 20354 / Pwd: designseries@2026 or 20354)");
  console.log("   • Admin:       admin@bitsathy.ac.in   (Roll: ADMIN01 / Pwd: designseries@2026 or ADMIN01)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
