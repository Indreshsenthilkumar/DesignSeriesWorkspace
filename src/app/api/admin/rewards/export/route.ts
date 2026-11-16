import { fail, handler } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requireRewardAdmin } from "../route";

export const GET = handler(async (request: Request) => {
  try {
    await requireRewardAdmin();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Access denied";
    return fail(message, 403);
  }

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") || "summary"; // "summary" | "ledger"

  if (type === "ledger") {
    const transactions = await prisma.rewardTransaction.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { name: true, rollNo: true, department: true } },
        rule: { select: { name: true, code: true } },
        actor: { select: { name: true } },
      },
      take: 5000,
    });

    const header = [
      "Timestamp",
      "Student Name",
      "Roll No",
      "Department",
      "Category",
      "Rule Code",
      "Rule Name",
      "Points Delta",
      "Previous Score",
      "New Score",
      "Reason",
      "Is Manual",
      "Adjusted By",
    ].join(",");

    const rows = transactions.map((t) =>
      [
        `"${t.createdAt.toISOString()}"`,
        `"${(t.user.name || "").replace(/"/g, '""')}"`,
        `"${t.user.rollNo || ""}"`,
        `"${t.user.department || ""}"`,
        `"${t.category}"`,
        `"${t.ruleCode}"`,
        `"${(t.rule?.name || "").replace(/"/g, '""')}"`,
        t.points,
        t.previousScore,
        t.newScore,
        `"${(t.reason || "").replace(/"/g, '""')}"`,
        t.isManual ? "YES" : "NO",
        `"${(t.actor?.name || "System").replace(/"/g, '""')}"`,
      ].join(",")
    );

    const csv = [header, ...rows].join("\n");
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="reward-points-ledger-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  }

  // Summary export
  const users = await prisma.user.findMany({
    where: {
      role: { in: ["STUDENT", "STUDENT_ADMIN"] },
      systemStatus: "ACTIVE",
    },
    select: {
      id: true,
      name: true,
      rollNo: true,
      email: true,
      department: true,
      year: true,
      domain: true,
      rewardPoints: true,
      rewardPointsEnabled: true,
      portalNavDisabled: true,
      attendance: { select: { id: true, status: true } },
      worklogs: { select: { id: true, status: true } },
      tasksAssigned: { select: { id: true, status: true } },
      leaveRequests: { select: { id: true, status: true } },
    },
    orderBy: [{ rewardPoints: "desc" }, { name: "asc" }],
  });

  const header = [
    "Student Name",
    "Roll No",
    "Email",
    "Department",
    "Year",
    "Domain",
    "Current Reward Score (%)",
    "Status Tier",
    "Feature Enabled",
    "Attendance Records",
    "Worklogs Submitted",
    "Tasks Assigned",
    "Leaves Requested",
  ].join(",");

  const rows = users.map((u) => {
    let tier = "Good (80-94%)";
    if (u.rewardPoints >= 95) tier = "Outstanding (95-100%)";
    else if (u.rewardPoints >= 65) tier = "Satisfactory (65-79%)";
    else tier = "At Risk (<65%)";

    const isFeatureDisabled =
      u.rewardPointsEnabled === false ||
      (u.portalNavDisabled || "").split(",").map((s) => s.trim().toLowerCase()).includes("rewards");

    return [
      `"${(u.name || "").replace(/"/g, '""')}"`,
      `"${u.rollNo}"`,
      `"${u.email}"`,
      `"${u.department || ""}"`,
      `"${u.year || ""}"`,
      `"${u.domain || ""}"`,
      u.rewardPoints,
      `"${tier}"`,
      isFeatureDisabled ? "NO" : "YES",
      u.attendance.length,
      u.worklogs.length,
      u.tasksAssigned.length,
      u.leaveRequests.length,
    ].join(",");
  });

  const csv = [header, ...rows].join("\n");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="reward-points-summary-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
});
