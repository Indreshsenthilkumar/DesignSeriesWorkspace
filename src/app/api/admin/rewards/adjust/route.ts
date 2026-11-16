import { z } from "zod";
import { audit, fail, handler, ok } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { manuallyAdjustPoints } from "@/lib/rewards-engine";
import { requireRewardAdmin } from "../route";

const adjustSchema = z.object({
  userId: z.string().min(1),
  points: z.number().int().refine((p) => p !== 0, "Points delta cannot be zero"),
  reason: z.string().trim().min(5, "A clear audit reason (minimum 5 characters) is required"),
});

export const POST = handler(async (request: Request) => {
  let admin;
  try {
    admin = await requireRewardAdmin();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Access denied";
    return fail(message, 403);
  }

  const { userId, points, reason } = adjustSchema.parse(await request.json());

  const result = await manuallyAdjustPoints({
    userId,
    points,
    reason,
    actorId: admin.id,
  });

  // Create in-app notification for the user
  try {
    await prisma.notification.create({
      data: {
        title: `Reward Points ${points > 0 ? "Credit" : "Deduction"}: ${points > 0 ? "+" : ""}${points} pts`,
        body: `Your performance score was adjusted by staff: "${reason}". Updated score: ${result.newScore} pts.`,
        category: "GENERAL",
        audience: "USER",
        audienceValue: userId,
        link: "/rewards",
        authorId: admin.id,
      },
    });
  } catch {
    // If notification creation fails, don't abort the transaction
  }

  await audit(admin.id, "REWARD_MANUAL_ADJUST", "User", userId, {
    points,
    reason,
    previousScore: result.previousScore,
    newScore: result.newScore,
  });

  return ok(result);
});
