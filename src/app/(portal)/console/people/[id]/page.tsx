import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { requireUser } from "@/lib/auth";
import { PERMISSIONS, type Permission } from "@/lib/constants";
import { can, isStaff, type PermissionSubject } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { attendanceSummary, filterOptions } from "@/lib/queries";
import { titleCase } from "@/lib/utils";

import { type PersonRow } from "../PeopleClient";
import { PersonDetailClient } from "./PersonDetailClient";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const decodedId = decodeURIComponent(id).trim();

  const person = await prisma.user.findFirst({
    where: {
      OR: [
        { id: decodedId },
        { id },
        { rollNo: { equals: decodedId, mode: "insensitive" } },
        { email: { equals: decodedId, mode: "insensitive" } },
      ],
    },
    select: { name: true },
  });

  return { title: person?.name ? `${titleCase(person.name)} · People` : "Person" };
}

export default async function PersonPage({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await requireUser();
  const subject = viewer as PermissionSubject;
  const canManage = isStaff(subject) || viewer.role === "STUDENT_ADMIN" || can(subject, "permUserManagement");
  if (!canManage) {
    redirect("/dashboard?denied=1");
  }

  const { id } = await params;
  const decodedId = decodeURIComponent(id).trim();

  const [person, options] = await Promise.all([
    prisma.user.findFirst({
      where: {
        OR: [
          { id: decodedId },
          { id },
          { rollNo: { equals: decodedId, mode: "insensitive" } },
          { email: { equals: decodedId, mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        name: true,
        rollNo: true,
        email: true,
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
        createdAt: true,
        mustChangePassword: true,
        permOverview: true,
        permLeaveRequests: true,
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
        portalNavDisabled: true,
      },
    }),
    filterOptions(),
  ]);

  if (!person) notFound();

  const showAttendance = can(subject, "permAttendanceLogs") || isStaff(subject) || viewer.role === "STUDENT_ADMIN";
  const showWorklogs = can(subject, "permWorklogs") || isStaff(subject) || viewer.role === "STUDENT_ADMIN";

  const [attendance, worklogs, tasks, passes, linkedin, rewards] = await Promise.all([
    showAttendance
      ? attendanceSummary(person.id, { days: 30, joinedAt: person.createdAt })
      : Promise.resolve(null),
    showWorklogs
      ? prisma.worklog.findMany({
          where: { userId: person.id },
          orderBy: { date: "desc" },
          take: 10,
          select: { id: true, date: true, s1: true, s2: true, s3: true, s4: true, s5: true, status: true, mentorRemark: true },
        })
      : Promise.resolve([]),
    prisma.task.findMany({
      where: { assigneeId: person.id },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: { id: true, title: true, status: true, priority: true, dueDate: true, points: true },
    }),
    prisma.activityPass.findMany({
      where: { userId: person.id },
      orderBy: { date: "desc" },
      take: 6,
      select: { id: true, date: true, destination: true, status: true, fromTime: true, toTime: true },
    }),
    prisma.linkedinPost.findMany({
      where: { userId: person.id },
      orderBy: { postedOn: "desc" },
      take: 5,
      select: { id: true, url: true, postedOn: true, verified: true, reactions: true },
    }),
    prisma.rewardEntry.findMany({
      where: { userId: person.id },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: { id: true, points: true, reason: true, source: true },
    }),
  ]);

  const personRow: PersonRow = {
    id: person.id,
    name: person.name,
    rollNo: person.rollNo,
    email: person.email,
    department: person.department,
    year: person.year,
    mobile: person.mobile,
    domain: person.domain,
    mentorName: person.mentorName,
    gender: person.gender || "",
    legend: person.legend || "",
    designation: person.designation || "",
    linkedin: person.linkedin || "",
    github: person.github || "",
    role: person.role,
    systemStatus: person.systemStatus,
    rewardPoints: person.rewardPoints,
    lastLoginAt: person.lastLoginAt?.toISOString() ?? null,
    portalNavDisabled: person.portalNavDisabled || "",
    permissions: Object.fromEntries(
      PERMISSIONS.map((permission) => [permission, person[permission as keyof typeof person] === true])
    ) as Record<Permission, boolean>,
  };

  const createdAtStr = person.createdAt
    ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric" }).format(person.createdAt)
    : "—";

  return (
    <PersonDetailClient
      person={personRow}
      actorRole={viewer.role}
      canManage={canManage}
      options={options}
      attendance={attendance}
      worklogs={worklogs}
      tasks={tasks}
      passes={passes}
      linkedin={linkedin}
      rewards={rewards}
      createdAtStr={createdAtStr}
      mustChangePassword={person.mustChangePassword}
    />
  );
}
