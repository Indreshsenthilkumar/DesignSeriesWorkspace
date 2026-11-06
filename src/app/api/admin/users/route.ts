import { z } from "zod";

import { audit, fail, handler, ok } from "@/lib/api";
import { ApiError, hashPassword, requireApiUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS, ROLES } from "@/lib/constants";
import { can, isStaff, outranks, type PermissionSubject } from "@/lib/permissions";

const permissionShape = Object.fromEntries(
  PERMISSIONS.map((p) => [p, z.boolean().optional()])
) as Record<(typeof PERMISSIONS)[number], z.ZodOptional<z.ZodBoolean>>;

const createSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(120),
  rollNo: z.string().trim().min(2, "Roll number must be at least 2 characters").max(40),
  email: z.string().trim().email("Invalid email address").max(160),
  department: z.string().trim().max(160).default(""),
  year: z.string().trim().max(80).default(""),
  mobile: z.string().trim().max(20).default(""),
  domain: z.string().trim().max(120).default("Data not Feeded"),
  mentorName: z.string().trim().max(120).default(""),
  gender: z.string().trim().max(40).default(""),
  legend: z.string().trim().max(40).default(""),
  designation: z.string().trim().max(160).default(""),
  linkedin: z.string().trim().max(300).default(""),
  github: z.string().trim().max(300).default(""),
  role: z.enum(ROLES).default("STUDENT"),
  password: z.string().min(3).max(200).optional(),
  portalNavDisabled: z.string().max(500).optional().default(""),
  ...permissionShape,
});

async function requireCanManageUsers() {
  const user = await requireApiUser();
  const subject = user as PermissionSubject;
  const allowed =
    subject.role === "SUPER_ADMIN" ||
    subject.role === "ADMIN" ||
    subject.role === "MENTOR" ||
    subject.role === "STUDENT_ADMIN" ||
    can(subject, "permUserManagement");
  if (!allowed) {
    throw new ApiError(403, "You do not have permission to manage accounts.");
  }
  return user;
}

export const POST = handler(async (request: Request) => {
  const admin = await requireCanManageUsers();
  const { password, ...data } = createSchema.parse(await request.json());

  const normalizedEmail = data.email.toLowerCase().trim();
  const normalizedRollNo = data.rollNo.toUpperCase().trim();

  const clash = await prisma.user.findFirst({
    where: { OR: [{ email: normalizedEmail }, { rollNo: normalizedRollNo }] },
    select: { id: true, email: true, rollNo: true },
  });
  if (clash) {
    if (clash.email.toLowerCase() === normalizedEmail) {
      return fail("An account already exists with that email address.", 409);
    }
    return fail("An account already exists with that roll number.", 409);
  }

  const initialPassword = password?.trim() || normalizedRollNo || "designseries@2026";
  const user = await prisma.user.create({
    data: {
      ...data,
      id: normalizedEmail,
      email: normalizedEmail,
      rollNo: normalizedRollNo,
      passwordHash: await hashPassword(initialPassword),
      mustChangePassword: true,
    },
    select: {
      id: true,
      name: true,
      email: true,
      rollNo: true,
      department: true,
      year: true,
      mobile: true,
      domain: true,
      mentorName: true,
      gender: true,
      legend: true,
      designation: true,
      linkedin: true,
      github: true,
      role: true,
      systemStatus: true,
      rewardPoints: true,
      lastLoginAt: true,
    },
  });

  await audit(admin.id, "USER_CREATE", "User", user.id, { role: user.role, email: user.email });

  return ok(user, 201);
});

// ---------------------------------------------------------------------------

const updateSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(2).max(120).optional(),
  department: z.string().trim().max(160).optional(),
  year: z.string().trim().max(80).optional(),
  mobile: z.string().trim().max(20).optional(),
  domain: z.string().trim().max(120).optional(),
  mentorName: z.string().trim().max(120).optional(),
  gender: z.string().trim().max(40).optional(),
  legend: z.string().trim().max(40).optional(),
  designation: z.string().trim().max(160).optional(),
  linkedin: z.string().trim().max(300).optional(),
  github: z.string().trim().max(300).optional(),
  role: z.enum(ROLES).optional(),
  systemStatus: z.enum(["ACTIVE", "SUSPENDED"]).optional(),
  resetPassword: z.string().min(10).max(200).optional(),
  portalNavDisabled: z.string().max(500).optional(),
  ...permissionShape,
});

export const PATCH = handler(async (request: Request) => {
  const admin = await requireCanManageUsers();
  const { id, resetPassword, ...changes } = updateSchema.parse(await request.json());

  const target = await prisma.user.findUnique({
    where: { id },
    select: { id: true, name: true, role: true },
  });
  if (!target) return fail("That account no longer exists.", 404);

  const data: Record<string, unknown> = { ...changes };
  if (resetPassword) {
    data.passwordHash = await hashPassword(resetPassword);
    data.mustChangePassword = true;
  }

  await prisma.user.update({ where: { id }, data });
  await audit(admin.id, "USER_UPDATE", "User", id, {
    fields: Object.keys(changes),
    passwordReset: Boolean(resetPassword),
  });

  return ok({ id, updated: Object.keys(data) });
});

// ---------------------------------------------------------------------------

/**
 * Deactivation rather than deletion: attendance, worklogs and passes are the
 * programme's record and must survive an account being closed.
 */
export const DELETE = handler(async (request: Request) => {
  const admin = await requireCanManageUsers();
  const { id } = z.object({ id: z.string().min(1) }).parse(await request.json());

  if (id === admin.id) return fail("You cannot suspend your own account.", 403);

  const target = await prisma.user.findUnique({ where: { id }, select: { role: true } });
  if (!target) return fail("That account no longer exists.", 404);

  await prisma.user.update({ where: { id }, data: { systemStatus: "SUSPENDED" } });
  await audit(admin.id, "USER_SUSPEND", "User", id);

  return ok({ id, systemStatus: "SUSPENDED" });
});
