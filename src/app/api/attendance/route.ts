import { z } from "zod";

import { audit, fail, handler, ok } from "@/lib/api";
import { requireApiPermission, requireApiUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ATTENDANCE_CUTOFF_MINUTES, ATTENDANCE_HOURS, REWARD_RULES } from "@/lib/constants";
import { minutesSinceMidnight, toDayKey } from "@/lib/dates";

const checkInSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format."),
  hours: z.array(z.number().int().min(1).max(7)).min(1, "Select at least one hour."),
  reason: z.string().trim().min(4, "Please describe what you worked on (at least 4 characters).").max(400),
});

/**
 * Missed OTP Attendance — Student Submission.
 *
 * Rules:
 * 1. Date must be the current calendar day (same-day submission only).
 * 2. Only ONE submission allowed per day. Records cannot be edited, appended to, or deleted once submitted.
 * 3. Row-per-Hour Storage: Each selected hour is stored as a distinct database row sharing
 *    the same student details, reason, date, and authoritative submission timestamp.
 * 4. 23:30 cutoff enforcement.
 */
export const POST = handler(async (request: Request) => {
  const user = await requireApiUser();
  const { date, hours, reason } = checkInSchema.parse(await request.json());

  const today = toDayKey();
  if (date > today) return fail("You cannot submit Missed OTP Attendance for a future date.", 422);
  if (date < today) {
    return fail(
      "Back-dated Missed OTP Attendance must be added by your mentor or an administrator.",
      422
    );
  }
  if (minutesSinceMidnight() > ATTENDANCE_CUTOFF_MINUTES) {
    return fail("Missed OTP Attendance for today closed at 11:30 PM.", 422);
  }

  // Enforce one-submission-per-day rule
  const existingSubmissions = await prisma.attendance.findMany({
    where: { userId: user.id, date },
    select: { id: true, hour: true },
  });

  if (existingSubmissions.length > 0) {
    return fail(
      "You have already submitted Missed OTP Attendance for today. Only one submission is allowed per day, and records cannot be edited or deleted.",
      409
    );
  }

  // Deduplicate and sort requested hours (1 to 7)
  const uniqueHours = Array.from(new Set(hours)).sort((a, b) => a - b);
  if (uniqueHours.length === 0) {
    return fail("Select at least one valid hour (1 to 7).", 422);
  }

  // Authoritative timestamp for all rows in this submission batch
  const submissionTimestamp = new Date();

  // Create Row-per-Hour records
  const recordsData = uniqueHours.map((hour) => ({
    userId: user.id,
    rollNo: user.rollNo || "",
    name: user.name || "",
    email: user.email || user.id,
    department: user.department || "",
    year: user.year || "",
    date,
    hour,
    reason: reason.trim(),
    status: "PRESENT",
    source: "SELF",
    createdAt: submissionTimestamp,
  }));

  await prisma.attendance.createMany({
    data: recordsData,
  });

  // Award reward points if a full day (all 7 hours) was submitted
  if (uniqueHours.length >= ATTENDANCE_HOURS.length) {
    await prisma.$transaction([
      prisma.rewardEntry.create({
        data: {
          userId: user.id,
          points: REWARD_RULES.fullDayAttendance,
          reason: `Full Missed OTP Attendance on ${date}`,
          source: "ATTENDANCE",
          createdAt: submissionTimestamp,
        },
      }),
      prisma.user.update({
        where: { id: user.id },
        data: { rewardPoints: { increment: REWARD_RULES.fullDayAttendance } },
      }),
    ]);
  }

  await audit(user.id, "MISSED_OTP_ATTENDANCE_SUBMIT", "Attendance", `${user.id}:${date}`, {
    hours: uniqueHours,
    hoursCount: uniqueHours.length,
    timestamp: submissionTimestamp.toISOString(),
  });

  return ok({
    date,
    recorded: uniqueHours,
    recordedHours: uniqueHours,
    totalHours: uniqueHours.length,
    timestamp: submissionTimestamp.toISOString(),
  });
});

// ---------------------------------------------------------------------------

const manualSchema = z.object({
  userId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  hours: z.array(z.number().int().min(1).max(7)).min(1),
  status: z.enum(["PRESENT", "LATE", "EXCUSED", "ABSENT"]).default("PRESENT"),
  reason: z.string().trim().max(400).default("Added by admin"),
});

/** Admin manual entry — can back-date, and overwrites whatever is there. */
export const PUT = handler(async (request: Request) => {
  const admin = await requireApiPermission("permAttendanceLogs");
  const { userId, date, hours, status, reason } = manualSchema.parse(await request.json());

  if (date > toDayKey()) return fail("You cannot record attendance for a future date.", 422);

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, rollNo: true, email: true, department: true, year: true }
  });
  if (!target) return fail("User is not on the roster.", 404);

  await prisma.$transaction([
    prisma.attendance.deleteMany({ where: { userId, date } }),
    prisma.attendance.createMany({
      data: hours.map((hour) => ({
        userId,
        rollNo: target.rollNo || "",
        email: target.email || target.id,
        name: target.name || "",
        department: target.department || "",
        year: target.year || "",
        date,
        hour,
        reason,
        status,
        source: "ADMIN",
        markedBy: admin.id,
      })),
    }),
  ]);

  await audit(admin.id, "ATTENDANCE_MANUAL", "Attendance", `${userId}:${date}`, { hours, status });

  return ok({ userId, date, hours, status });
});

// ---------------------------------------------------------------------------

const deleteSchema = z.object({
  userId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const DELETE = handler(async (request: Request) => {
  const admin = await requireApiPermission("permAttendanceLogs");
  const { userId, date } = deleteSchema.parse(await request.json());

  const { count } = await prisma.attendance.deleteMany({ where: { userId, date } });
  await audit(admin.id, "ATTENDANCE_CLEAR", "Attendance", `${userId}:${date}`, { removed: count });

  return ok({ removed: count });
});
