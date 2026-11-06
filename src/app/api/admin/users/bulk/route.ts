import { z } from "zod";

import { audit, fail, handler, ok } from "@/lib/api";
import { ApiError, hashPassword, requireApiUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ROLES, type Role } from "@/lib/constants";
import { can, isStaff, type PermissionSubject } from "@/lib/permissions";

const itemSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(160),
  rollNo: z.string().trim().min(1, "Roll number is required").max(60),
  email: z.string().trim().email("Invalid email address").max(180),
  department: z.string().trim().max(180).default(""),
  year: z.string().trim().max(120).default(""),
  mobile: z.string().trim().max(40).default(""),
  domain: z.string().trim().max(160).default("Data not Feeded"),
  mentorName: z.string().trim().max(160).default(""),
  linkedin: z.string().trim().max(400).default(""),
  github: z.string().trim().max(400).default(""),
  role: z.string().trim().default("STUDENT"),
  password: z.string().trim().optional(),
});

const bulkSchema = z.object({
  users: z.array(itemSchema).min(1, "Please provide at least one user to import."),
});

function normalizeRole(raw: string): Role {
  const clean = raw.trim().toUpperCase().replace(/\s+/g, "_");
  if (clean === "STUDENT_ADMIN" || clean === "STUDENT+ADMIN" || clean === "STUDENT_+_ADMIN" || clean.includes("STUDENT_ADMIN") || clean.includes("STUDENT+")) {
    return "STUDENT_ADMIN";
  }
  if (clean === "SUPER_ADMIN" || clean === "SUPERADMIN") return "SUPER_ADMIN";
  if (clean === "ADMIN") return "ADMIN";
  if (clean === "MENTOR") return "MENTOR";
  return "STUDENT";
}

export const POST = handler(async (request: Request) => {
  const admin = await requireApiUser();
  const subject = admin as PermissionSubject;
  const allowed =
    subject.role === "SUPER_ADMIN" ||
    subject.role === "ADMIN" ||
    subject.role === "MENTOR" ||
    subject.role === "STUDENT_ADMIN" ||
    can(subject, "permUserManagement");

  if (!allowed) {
    throw new ApiError(403, "You do not have permission to import users.");
  }

  const { users } = bulkSchema.parse(await request.json());

  let createdCount = 0;
  let updatedCount = 0;
  const errors: Array<{ row: number; email: string; rollNo: string; error: string }> = [];

  for (let i = 0; i < users.length; i++) {
    const raw = users[i];
    const rowNum = i + 1;
    const normalizedEmail = raw.email.toLowerCase().trim();
    const normalizedRollNo = raw.rollNo.toUpperCase().trim();
    const targetRole = normalizeRole(raw.role);

    try {
      const existing = await prisma.user.findFirst({
        where: {
          OR: [{ email: normalizedEmail }, { rollNo: normalizedRollNo }],
        },
      });

      if (existing) {
        // Update existing record
        await prisma.user.update({
          where: { id: existing.id },
          data: {
            name: raw.name.trim(),
            rollNo: normalizedRollNo,
            email: normalizedEmail,
            department: raw.department.trim() || existing.department,
            year: raw.year.trim() || existing.year,
            mobile: raw.mobile.trim() || existing.mobile,
            domain: raw.domain.trim() || existing.domain,
            mentorName: raw.mentorName.trim() || existing.mentorName,
            linkedin: raw.linkedin.trim() || existing.linkedin,
            github: raw.github.trim() || existing.github,
            role: targetRole,
            ...(raw.password
              ? {
                  passwordHash: await hashPassword(raw.password),
                  mustChangePassword: true,
                }
              : {}),
          },
        });
        updatedCount++;
      } else {
        // Create new record
        const initialPassword = raw.password?.trim() || normalizedRollNo || "designseries@2026";
        await prisma.user.create({
          data: {
            id: normalizedEmail,
            name: raw.name.trim(),
            rollNo: normalizedRollNo,
            email: normalizedEmail,
            department: raw.department.trim(),
            year: raw.year.trim(),
            mobile: raw.mobile.trim(),
            domain: raw.domain.trim() || "Data not Feeded",
            mentorName: raw.mentorName.trim(),
            linkedin: raw.linkedin.trim(),
            github: raw.github.trim(),
            role: targetRole,
            systemStatus: "ACTIVE",
            passwordHash: await hashPassword(initialPassword),
            mustChangePassword: true,
            // If created as admin/super admin, automatically enable admin permissions
            ...(targetRole === "ADMIN" || targetRole === "STUDENT_ADMIN"
              ? {
                  permUserManagement: true,
                  permAttendanceLogs: true,
                  permWorklogs: true,
                  permMentorTasks: true,
                  permActivityApproval: true,
                  permNotifications: true,
                  permScanStudentQr: true,
                }
              : {}),
          },
        });
        createdCount++;
      }
    } catch (err: any) {
      errors.push({
        row: rowNum,
        email: normalizedEmail,
        rollNo: normalizedRollNo,
        error: err.message || "Failed to process record",
      });
    }
  }

  await audit(admin.id, "USER_BULK_IMPORT", "User", "", {
    total: users.length,
    created: createdCount,
    updated: updatedCount,
    errorsCount: errors.length,
  });

  return ok({
    total: users.length,
    created: createdCount,
    updated: updatedCount,
    errors,
  });
});
