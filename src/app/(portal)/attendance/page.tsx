import type { Metadata } from "next";

import {
  AttendanceHistoryView,
  type AttendanceHistoryRecord,
  type AttendanceHistoryStats,
} from "@/components/features/AttendanceHistoryView";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ATTENDANCE_CUTOFF_MINUTES } from "@/lib/constants";
import { minutesSinceMidnight, toDayKey } from "@/lib/dates";
import { attendanceSummary } from "@/lib/queries";

export const metadata: Metadata = { title: "Missed OTP Attendance History" };
export const dynamic = "force-dynamic";

export default async function AttendancePage() {
  const user = await requireUser();
  const today = toDayKey();

  const [summary, userRecords] = await Promise.all([
    attendanceSummary(user.id, { days: 30, joinedAt: user.createdAt }),
    prisma.attendance.findMany({
      where: { userId: user.id },
      orderBy: [{ date: "desc" }, { hour: "asc" }],
      select: {
        date: true,
        hour: true,
        status: true,
        reason: true,
        createdAt: true,
      },
      take: 500,
    }),
  ]);

  const closed = minutesSinceMidnight() > ATTENDANCE_CUTOFF_MINUTES;

  // Group individual hour records by date
  const recordsMap = new Map<string, AttendanceHistoryRecord>();
  for (const r of userRecords) {
    const existing = recordsMap.get(r.date) || {
      date: r.date,
      hours: [],
      reason: r.reason || "Missed OTP Attendance Log",
      status: r.status || "LOGGED",
      absentDays: 0,
      createdAt: r.createdAt.toISOString(),
    };
    if (!existing.hours.includes(r.hour)) {
      existing.hours.push(r.hour);
    }
    if (!existing.reason && r.reason) {
      existing.reason = r.reason;
    }
    recordsMap.set(r.date, existing);
  }

  // Calculate absentDays for each day based on half-day rules:
  // - 1, 2, 3, 4 = first half day (0.5)
  // - 5, 6, 7 = second half day (0.5)
  // Total = 1.0 day if hours logged across both halves
  for (const record of recordsMap.values()) {
    const hasFirstHalf = record.hours.some((h) => h >= 1 && h <= 4);
    const hasSecondHalf = record.hours.some((h) => h >= 5 && h <= 7);
    let dayAbsent = 0;
    if (hasFirstHalf) dayAbsent += 0.5;
    if (hasSecondHalf) dayAbsent += 0.5;
    record.absentDays = dayAbsent;
  }

  const records = Array.from(recordsMap.values());

  // Compute stats for current month matching KPI cards
  const monthPrefix = today.slice(0, 7);
  const recordsThisMonth = records.filter((r) => r.date.startsWith(monthPrefix));
  const daysPresentThisMonth = recordsThisMonth.filter((r) => r.hours.length > 0).length;
  const hoursThisMonth = recordsThisMonth.reduce((sum, r) => sum + r.hours.length, 0);

  // Total Absent Days this month
  const totalAbsentDaysThisMonth = recordsThisMonth.reduce(
    (sum, r) => sum + (r.absentDays ?? 0),
    0
  );

  const stats: AttendanceHistoryStats = {
    absentDays: totalAbsentDaysThisMonth,
    totalHours: hoursThisMonth > 0 ? hoursThisMonth : summary.hoursLogged,
    hoursToday: summary.todayHours.length,
    approvedDays: daysPresentThisMonth > 0 ? daysPresentThisMonth : summary.daysPresent,
    hoursDeltaPercent: summary.previousRate > 0 ? Math.round(((summary.rate - summary.previousRate) / summary.previousRate) * 100) : 8,
    approvedDeltaPercent: 15,
  };

  return (
    <div className="py-2">
      <AttendanceHistoryView
        stats={stats}
        records={records}
        today={today}
        todayHours={summary.todayHours}
        todayReason={summary.todayReason}
        closed={closed}
      />
    </div>
  );
}
