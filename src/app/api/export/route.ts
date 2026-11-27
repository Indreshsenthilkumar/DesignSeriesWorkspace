import { handler, fail, audit } from "@/lib/api";
import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { toCsv } from "@/lib/utils";
import { toDayKey } from "@/lib/dates";
import type { Permission } from "@/lib/constants";

/**
 * CSV export for the admin console.
 *
 * `?table=students|attendance|worklogs|passes|tasks|linkedin|rewards|audit`
 * Optional `?from=YYYY-MM-DD&to=YYYY-MM-DD` narrows the date-bearing tables.
 *
 * Each table declares the permission that unlocks it, so an admin who can only
 * see attendance cannot pull the worklog corpus.
 */

const TABLE_PERMISSION: Record<string, Permission> = {
  students: "permUserManagement",
  attendance: "permAttendanceLogs",
  worklogs: "permWorklogs",
  passes: "permActivityApproval",
  tasks: "permMentorTasks",
  linkedin: "permLinkedinTracker",
  rewards: "permAdminDatabase",
  audit: "permAdminDatabase",
};

export const GET = handler(async (request: Request) => {
  const url = new URL(request.url);
  const table = (url.searchParams.get("table") ?? "students").toLowerCase();
  const from = url.searchParams.get("from") ?? "";
  const to = url.searchParams.get("to") ?? "";

  const permission = TABLE_PERMISSION[table];
  if (!permission) return fail(`Unknown table "${table}".`, 400);

  const admin = await requireApiPermission(permission);

  const dateFilter =
    from && to ? { date: { gte: from, lte: to } } : from ? { date: { gte: from } } : {};

  let csv = "";

  switch (table) {
    case "students": {
      const roleParam = url.searchParams.get("role") ?? "";
      const yearParam = url.searchParams.get("year") ?? "";
      const genderParam = url.searchParams.get("gender") ?? "";
      const domainParam = url.searchParams.get("domain") ?? "";
      const mentorParam = url.searchParams.get("mentor") ?? "";
      const deptParam = url.searchParams.get("department") ?? "";
      const statusParam = url.searchParams.get("status") ?? "";

      const where: any = {};

      if (roleParam && roleParam !== "ALL") {
        if (roleParam === "STUDENT") {
          where.role = { in: ["STUDENT", "STUDENT_ADMIN"] };
        } else {
          where.role = roleParam;
        }
      }

      if (yearParam && yearParam !== "ALL") {
        where.year = { contains: yearParam };
      }

      if (deptParam && deptParam !== "ALL") {
        where.department = deptParam;
      }

      if (domainParam && domainParam !== "ALL") {
        where.domain = domainParam;
      }

      if (mentorParam && mentorParam !== "ALL") {
        where.mentorName = { contains: mentorParam };
      }

      if (statusParam && statusParam !== "ALL") {
        where.systemStatus = statusParam;
      }

      const rows = await prisma.user.findMany({
        where,
        orderBy: [{ role: "asc" }, { name: "asc" }],
        select: {
          name: true, rollNo: true, email: true, department: true, year: true,
          gender: true, mobile: true, domain: true, mentorName: true, designation: true,
          linkedin: true, github: true, role: true, systemStatus: true, rewardPoints: true,
          lastLoginAt: true, createdAt: true,
        },
      });

      // Filter by gender in memory if specified to also handle legacy records with gender in year
      const filteredRows = genderParam && genderParam !== "ALL"
        ? rows.filter((r) => {
            const resolvedGender = r.gender?.trim() ||
              (/\bfemale\b/i.test(r.year || "") ? "Female" : /\bmale\b/i.test(r.year || "") ? "Male" : "");
            return resolvedGender.toLowerCase() === genderParam.toLowerCase();
          })
        : rows;

      csv = toCsv(
        [
          "Name", "Roll No", "Email", "Mobile", "Department", "Batch / Year", "Gender",
          "Domain", "Mentor", "Designation", "Role", "Status", "Points", "LinkedIn", "GitHub", "Last Login", "Created At"
        ],
        filteredRows.map((r) => {
          const resolvedGender = r.gender?.trim() ||
            (/\bfemale\b/i.test(r.year || "") ? "Female" : /\bmale\b/i.test(r.year || "") ? "Male" : "");
          return [
            r.name, r.rollNo, r.email, r.mobile || "", r.department, r.year, resolvedGender,
            r.domain, r.mentorName, r.designation || "", r.role, r.systemStatus, r.rewardPoints,
            r.linkedin || "", r.github || "",
            r.lastLoginAt ? r.lastLoginAt.toISOString() : "Never",
            r.createdAt ? r.createdAt.toISOString() : "",
          ];
        })
      );
      break;
    }

    case "attendance": {
      const rows = await prisma.attendance.findMany({
        where: dateFilter,
        orderBy: [{ date: "desc" }, { hour: "asc" }],
        take: 50_000,
        select: {
          date: true, hour: true, status: true, source: true, reason: true, createdAt: true,
          user: { select: { name: true, rollNo: true, email: true, domain: true, year: true } },
        },
      });
      csv = toCsv(
        ["Date", "Hour", "Name", "Roll No", "Email", "Year", "Domain", "Status", "Source", "Reason", "Logged at"],
        rows.map((r) => [
          r.date, r.hour, r.user.name, r.user.rollNo, r.user.email, r.user.year, r.user.domain,
          r.status, r.source, r.reason, r.createdAt.toISOString(),
        ])
      );
      break;
    }

    case "worklogs": {
      const rows = await prisma.worklog.findMany({
        where: dateFilter,
        orderBy: [{ date: "desc" }],
        take: 50_000,
        select: {
          date: true, s1: true, s2: true, s3: true, s4: true, s5: true,
          status: true, mentorRemark: true, createdAt: true,
          user: { select: { name: true, rollNo: true, email: true, domain: true, year: true } },
        },
      });
      csv = toCsv(
        ["Date", "Name", "Roll No", "Email", "Year", "Domain", "Slot 1", "Slot 2", "Slot 3", "Slot 4", "Extra", "Status", "Mentor remark", "Submitted at"],
        rows.map((r) => [
          r.date, r.user.name, r.user.rollNo, r.user.email, r.user.year, r.user.domain,
          r.s1, r.s2, r.s3, r.s4, r.s5, r.status, r.mentorRemark, r.createdAt.toISOString(),
        ])
      );
      break;
    }

    case "passes": {
      const rows = await prisma.activityPass.findMany({
        where: dateFilter,
        orderBy: { createdAt: "desc" },
        take: 20_000,
        select: {
          passCode: true, date: true, fromTime: true, toTime: true, destination: true,
          reason: true, category: true, status: true, remark: true, reviewedAt: true,
          user: { select: { name: true, rollNo: true, email: true } },
          reviewer: { select: { name: true } },
        },
      });
      csv = toCsv(
        ["Pass code", "Date", "From", "To", "Name", "Roll No", "Email", "Category", "Destination", "Reason", "Status", "Reviewer", "Remark", "Decided at"],
        rows.map((r) => [
          r.passCode, r.date, r.fromTime, r.toTime, r.user.name, r.user.rollNo, r.user.email,
          r.category, r.destination, r.reason, r.status, r.reviewer?.name ?? "", r.remark,
          r.reviewedAt ? r.reviewedAt.toISOString() : "",
        ])
      );
      break;
    }

    case "tasks": {
      const rows = await prisma.task.findMany({
        orderBy: { createdAt: "desc" },
        take: 20_000,
        select: {
          title: true, description: true, priority: true, status: true, dueDate: true,
          points: true, createdAt: true, completedAt: true,
          assignee: { select: { name: true, rollNo: true, domain: true } },
          author: { select: { name: true } },
        },
      });
      csv = toCsv(
        ["Title", "Assignee", "Roll No", "Domain", "Assigned by", "Priority", "Status", "Due", "Points", "Created", "Completed"],
        rows.map((r) => [
          r.title, r.assignee?.name ?? "—", r.assignee?.rollNo ?? "", r.assignee?.domain ?? "",
          r.author.name, r.priority, r.status, r.dueDate ?? "", r.points,
          r.createdAt.toISOString(), r.completedAt ? r.completedAt.toISOString() : "",
        ])
      );
      break;
    }

    case "linkedin": {
      const rows = await prisma.linkedinPost.findMany({
        orderBy: { postedOn: "desc" },
        take: 20_000,
        select: {
          url: true, caption: true, postedOn: true, reactions: true, comments: true, verified: true,
          user: { select: { name: true, rollNo: true, domain: true } },
        },
      });
      csv = toCsv(
        ["Posted on", "Name", "Roll No", "Domain", "URL", "Caption", "Reactions", "Comments", "Verified"],
        rows.map((r) => [
          r.postedOn, r.user.name, r.user.rollNo, r.user.domain, r.url, r.caption,
          r.reactions, r.comments, r.verified ? "TRUE" : "FALSE",
        ])
      );
      break;
    }

    case "rewards": {
      const rows = await prisma.rewardEntry.findMany({
        orderBy: { createdAt: "desc" },
        take: 50_000,
        select: {
          points: true, reason: true, source: true, createdAt: true,
          user: { select: { name: true, rollNo: true } },
        },
      });
      csv = toCsv(
        ["Awarded at", "Name", "Roll No", "Points", "Source", "Reason"],
        rows.map((r) => [r.createdAt.toISOString(), r.user.name, r.user.rollNo, r.points, r.source, r.reason])
      );
      break;
    }

    case "audit": {
      const rows = await prisma.auditLog.findMany({
        orderBy: { createdAt: "desc" },
        take: 20_000,
        select: {
          action: true, entity: true, entityId: true, meta: true, createdAt: true,
          actor: { select: { name: true, email: true } },
        },
      });
      csv = toCsv(
        ["Timestamp", "Actor", "Email", "Action", "Entity", "Entity id", "Details"],
        rows.map((r) => [
          r.createdAt.toISOString(), r.actor?.name ?? "system", r.actor?.email ?? "",
          r.action, r.entity, r.entityId, r.meta,
        ])
      );
      break;
    }
  }

  await audit(admin.id, "EXPORT", "System", table, { from, to });

  const filename = `designseries-${table}-${toDayKey()}.csv`;

  return new Response(`﻿${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
});
