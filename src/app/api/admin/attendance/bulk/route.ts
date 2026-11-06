import { z } from "zod";

import { audit, fail, handler, ok } from "@/lib/api";
import { ApiError, hashPassword, requireApiUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can, type PermissionSubject } from "@/lib/permissions";
import { toDayKey } from "@/lib/dates";

const itemSchema = z.object({
  date: z.string().trim().min(1, "Date is required"),
  rollNo: z.string().trim().min(1, "Roll number is required").max(60),
  name: z.string().trim().max(160).optional().default(""),
  email: z.string().trim().max(180).optional().default(""),
  hour: z.coerce.number().int().min(1).max(7),
  reason: z.string().trim().max(400).optional().default("Missed OTP Attendance Log"),
  timestamp: z.string().trim().optional(),
});

const bulkSchema = z.object({
  records: z.array(itemSchema).min(1, "Please provide at least one attendance record."),
});

/**
 * Standardize dates like '2026-10-09', '09-10-2026', '09/10/2026', '2026/10/09' to 'YYYY-MM-DD'.
 */
function normalizeDateStr(raw: string): string | null {
  const clean = raw.trim();
  // Standard YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean;
  // YYYY/MM/DD
  if (/^\d{4}\/\d{2}\/\d{2}$/.test(clean)) return clean.replace(/\//g, "-");

  // DD-MM-YYYY or DD/MM/YYYY
  const dmyMatch = clean.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, "0");
    const month = dmyMatch[2].padStart(2, "0");
    const year = dmyMatch[3];
    return `${year}-${month}-${day}`;
  }

  // Fallback to JS Date parse
  const parsed = new Date(clean);
  if (!isNaN(parsed.getTime())) {
    return toDayKey(parsed);
  }
  return null;
}

/**
 * Parse optional timestamp like '2026-10-09 19:40:49'.
 */
function parseTimestamp(raw?: string): Date | null {
  if (!raw) return null;
  const parsed = new Date(raw.trim());
  if (!isNaN(parsed.getTime())) return parsed;
  return null;
}

export const POST = handler(async (request: Request) => {
  const admin = await requireApiUser();
  const subject = admin as PermissionSubject;
  const allowed =
    subject.role === "SUPER_ADMIN" ||
    subject.role === "ADMIN" ||
    subject.role === "MENTOR" ||
    subject.role === "STUDENT_ADMIN" ||
    can(subject, "permAttendanceLogs");

  if (!allowed) {
    throw new ApiError(403, "You do not have permission to import attendance logs.");
  }

  const { records } = bulkSchema.parse(await request.json());

  let successCount = 0;
  let createdUsersCount = 0;
  const errors: Array<{ row: number; rollNo: string; date: string; hour: number; error: string }> = [];

  // Cache user lookups across thousands of rows to avoid repeat queries
  const userCache = new Map<string, { id: string; name: string; rollNo: string; email: string; department: string; year: string }>();

  for (let i = 0; i < records.length; i++) {
    const raw = records[i];
    const rowNum = i + 1;
    const normalizedRoll = raw.rollNo.toUpperCase().trim();
    const normalizedEmail = (raw.email || "").toLowerCase().trim();
    const normalizedDate = normalizeDateStr(raw.date);

    if (!normalizedDate) {
      errors.push({
        row: rowNum,
        rollNo: raw.rollNo,
        date: raw.date,
        hour: raw.hour,
        error: `Invalid date format: "${raw.date}". Use YYYY-MM-DD.`,
      });
      continue;
    }

    if (raw.hour < 1 || raw.hour > 7) {
      errors.push({
        row: rowNum,
        rollNo: raw.rollNo,
        date: raw.date,
        hour: raw.hour,
        error: `Hour must be between 1 and 7 (received: ${raw.hour}).`,
      });
      continue;
    }

    try {
      // 1. Look up user by roll number or email
      let user = userCache.get(normalizedRoll) || (normalizedEmail ? userCache.get(normalizedEmail) : undefined);

      if (!user) {
        const found = await prisma.user.findFirst({
          where: {
            OR: [
              { rollNo: normalizedRoll },
              ...(normalizedEmail ? [{ email: normalizedEmail }] : []),
            ],
          },
          select: {
            id: true,
            name: true,
            rollNo: true,
            email: true,
            department: true,
            year: true,
          },
        });

        if (found) {
          user = found;
        } else {
          // If user does not exist in portal, auto-create a student profile so attendance isn't dropped
          const defaultPassword = normalizedRoll || "designseries@2026";
          const fallbackEmail = normalizedEmail || `${normalizedRoll.toLowerCase()}@bitsathy.ac.in`;
          const created = await prisma.user.create({
            data: {
              id: fallbackEmail,
              rollNo: normalizedRoll,
              email: fallbackEmail,
              name: raw.name?.trim() || normalizedRoll,
              department: "",
              year: "",
              role: "STUDENT",
              passwordHash: await hashPassword(defaultPassword),
              mustChangePassword: true,
            },
            select: {
              id: true,
              name: true,
              rollNo: true,
              email: true,
              department: true,
              year: true,
            },
          });
          user = created;
          createdUsersCount++;
        }

        userCache.set(normalizedRoll, user);
        if (normalizedEmail) userCache.set(normalizedEmail, user);
      }

      const parsedTime = parseTimestamp(raw.timestamp) || new Date();
      const attendanceReason = raw.reason?.trim() || "Missed OTP Attendance Log";

      // 2. Upsert attendance for (userId, date, hour)
      await prisma.attendance.upsert({
        where: {
          userId_date_hour: {
            userId: user.id,
            date: normalizedDate,
            hour: raw.hour,
          },
        },
        update: {
          reason: attendanceReason,
          status: "PRESENT",
          source: "ADMIN_BULK",
          markedBy: admin.id,
          createdAt: parsedTime,
        },
        create: {
          userId: user.id,
          rollNo: user.rollNo || normalizedRoll,
          name: user.name || raw.name?.trim() || "",
          email: user.email || normalizedEmail || "",
          department: user.department || "",
          year: user.year || "",
          date: normalizedDate,
          hour: raw.hour,
          reason: attendanceReason,
          status: "PRESENT",
          source: "ADMIN_BULK",
          markedBy: admin.id,
          createdAt: parsedTime,
        },
      });

      successCount++;
    } catch (err: any) {
      errors.push({
        row: rowNum,
        rollNo: raw.rollNo,
        date: raw.date,
        hour: raw.hour,
        error: err?.message || "Failed to save attendance record.",
      });
    }
  }

  // Audit log
  await audit(admin.id, "ATTENDANCE_BULK_IMPORT", "Attendance", `imported:${successCount}`, {
    totalRequested: records.length,
    successCount,
    createdUsersCount,
    errorCount: errors.length,
  });

  return ok({
    total: records.length,
    imported: successCount,
    createdUsers: createdUsersCount,
    errors,
  });
});
