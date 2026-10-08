import { z } from "zod";
import { NextResponse } from "next/server";

import { audit, fail, ok } from "@/lib/api";
import { createSession, hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  role: z.enum(["SUPER_ADMIN", "ADMIN", "STUDENT"]).optional(),
  email: z.string().optional(),
});

async function getOrCreateDevUser(role?: "SUPER_ADMIN" | "ADMIN" | "STUDENT", email?: string) {
  if (email) {
    const existing = await prisma.user.findFirst({
      where: {
        OR: [{ email: email.toLowerCase().trim() }, { rollNo: email.toUpperCase().trim() }],
      },
    });
    if (existing) return existing;

    const defaultPassHash = await hashPassword("designseries@2026");
    return prisma.user.create({
      data: {
        id: email.toLowerCase().trim(),
        name: email.split("@")[0].toUpperCase(),
        email: email.toLowerCase().trim(),
        rollNo: `DEV-${Date.now().toString().slice(-6)}`,
        role: role ?? "STUDENT",
        department: "Information Technology",
        year: "2025-2029 - IIB",
        domain: "Customer Experience (CX) Full Stack",
        passwordHash: defaultPassHash,
        systemStatus: "ACTIVE",
        mustChangePassword: false,
      },
    });
  }

  const targetRole = role ?? "SUPER_ADMIN";

  // Check if an existing account matches
  if (targetRole === "SUPER_ADMIN") {
    const existingSuper = await prisma.user.findFirst({
      where: {
        OR: [
          { email: "indreshs.it24@bitsathy.ac.in" },
          { role: "SUPER_ADMIN" },
        ],
      },
    });
    if (existingSuper) return existingSuper;
  } else if (targetRole === "ADMIN") {
    const existingAdmin = await prisma.user.findFirst({
      where: { role: "ADMIN" },
    });
    if (existingAdmin) return existingAdmin;
  } else {
    const existingStudent = await prisma.user.findFirst({
      where: { role: "STUDENT" },
    });
    if (existingStudent) return existingStudent;
  }

  // Auto-provision if not found
  const defaultPassHash = await hashPassword("designseries@2026");

  if (targetRole === "SUPER_ADMIN") {
    return prisma.user.create({
      data: {
        id: "indreshs.it24@bitsathy.ac.in",
        name: "Indresh S (Super Admin)",
        email: "indreshs.it24@bitsathy.ac.in",
        rollNo: "7376241IT101",
        department: "Information Technology",
        year: "2024-2028 - III",
        domain: "Customer Experience (CX) Full Stack",
        role: "SUPER_ADMIN",
        systemStatus: "ACTIVE",
        passwordHash: defaultPassHash,
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
  }

  if (targetRole === "ADMIN") {
    return prisma.user.create({
      data: {
        id: "mentor.dev@bitsathy.ac.in",
        name: "Dev Mentor / Staff",
        email: "mentor.dev@bitsathy.ac.in",
        rollNo: "737624STAFF01",
        department: "Information Technology",
        year: "Faculty / Staff",
        domain: "Customer Experience (CX) Full Stack",
        role: "ADMIN",
        systemStatus: "ACTIVE",
        passwordHash: defaultPassHash,
        mustChangePassword: false,
        permUserManagement: false,
        permScanStudentQr: true,
        permMentorTasks: true,
        permLinkedinTracker: true,
        permWorklogs: true,
        permNotifications: true,
        permAttendanceLogs: true,
        permExtensionRequest: true,
        permAdminDatabase: false,
        permActivityApproval: true,
      },
    });
  }

  // STUDENT
  return prisma.user.create({
    data: {
      id: "student.dev@bitsathy.ac.in",
      name: "Dev Student",
      email: "student.dev@bitsathy.ac.in",
      rollNo: "7376241IT999",
      department: "Information Technology",
      year: "2025-2029 - IIB",
      domain: "Customer Experience (CX) Full Stack",
      role: "STUDENT",
      systemStatus: "ACTIVE",
      passwordHash: defaultPassHash,
      mustChangePassword: false,
    },
  });
}

export async function POST(request: Request) {
  try {
    let body = {};
    try {
      body = await request.json();
    } catch {
      // empty body is fine, defaults to SUPER_ADMIN
    }

    const { role, email } = schema.parse(body);
    const user = await getOrCreateDevUser(role, email);

    await createSession({
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    });

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    await audit(user.id, "DEV_LOGIN", "User", user.id, { role: user.role });

    return ok({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    });
  } catch (error) {
    console.error("[dev-login] error:", error);
    return fail("Developer login failed", 500);
  }
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const roleParam = (url.searchParams.get("role")?.toUpperCase() ?? "SUPER_ADMIN") as
      | "SUPER_ADMIN"
      | "ADMIN"
      | "STUDENT";
    const emailParam = url.searchParams.get("email") ?? undefined;

    const user = await getOrCreateDevUser(roleParam, emailParam);

    await createSession({
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    });

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    await audit(user.id, "DEV_LOGIN_GET", "User", user.id, { role: user.role });

    return NextResponse.redirect(new URL("/dashboard", request.url));
  } catch (error) {
    console.error("[dev-login-get] error:", error);
    return NextResponse.redirect(new URL("/login?error=dev_login_failed", request.url));
  }
}
