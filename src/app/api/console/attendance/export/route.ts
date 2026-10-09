import { z } from "zod";
import { handler, ok, fail, audit } from "@/lib/api";
import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * Fetch attendance records for custom export.
 * Permitted for admins and mentors with `permAttendanceLogs`.
 */
export const GET = handler(async (request: Request) => {
  const admin = await requireApiPermission("permAttendanceLogs");
  const url = new URL(request.url);

  const from = url.searchParams.get("from") || "";
  const to = url.searchParams.get("to") || "";
  const year = url.searchParams.get("year") || "";
  const domain = url.searchParams.get("domain") || "";

  const where: Record<string, any> = {};

  if (from && to) {
    where.date = { gte: from, lte: to };
  } else if (from) {
    where.date = { gte: from };
  } else if (to) {
    where.date = { lte: to };
  }

  const userWhere: Record<string, any> = {};
  if (year && year !== "ALL") {
    userWhere.year = year;
  }
  if (domain && domain !== "ALL") {
    userWhere.domain = domain;
  }

  if (Object.keys(userWhere).length > 0) {
    where.user = userWhere;
  }

  const rows = await prisma.attendance.findMany({
    where,
    orderBy: [{ date: "desc" }, { rollNo: "asc" }, { hour: "asc" }],
    take: 50_000,
    select: {
      id: true,
      date: true,
      hour: true,
      status: true,
      source: true,
      reason: true,
      createdAt: true,
      user: {
        select: {
          name: true,
          rollNo: true,
          email: true,
          department: true,
          year: true,
          domain: true,
          mentorName: true,
        },
      },
    },
  });

  await audit(admin.id, "EXPORT_ATTENDANCE_QUERY", "Attendance", "cohort", {
    from,
    to,
    year,
    domain,
    count: rows.length,
  });

  return ok({
    records: rows.map((r) => ({
      date: r.date,
      rollNo: r.user.rollNo || "—",
      name: r.user.name,
      email: r.user.email,
      department: r.user.department || "—",
      year: r.user.year || "—",
      domain: r.user.domain || "—",
      mentor: r.user.mentorName || "—",
      hour: r.hour,
      status: r.status,
      source: r.source,
      reason: r.reason || "—",
      createdAt: r.createdAt ? new Date(r.createdAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) : "—",
    })),
    total: rows.length,
  });
});
