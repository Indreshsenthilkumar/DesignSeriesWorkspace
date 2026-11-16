import { z } from "zod";
import { audit, fail, handler, ok } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requireRewardAdmin } from "../route";

export const GET = handler(async () => {
  try {
    await requireRewardAdmin();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Access denied";
    return fail(message, 403);
  }

  const holidays = await prisma.scheduledHoliday.findMany({
    orderBy: { date: "asc" },
  });

  return ok({ holidays });
});

const createHolidaySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
  title: z.string().min(2, "Title is required").max(100),
  category: z.string().default("INSTITUTIONAL"),
  description: z.string().max(300).default(""),
});

export const POST = handler(async (request: Request) => {
  let admin;
  try {
    admin = await requireRewardAdmin();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Access denied";
    return fail(message, 403);
  }

  const data = createHolidaySchema.parse(await request.json());

  const holiday = await prisma.scheduledHoliday.upsert({
    where: { date: data.date },
    create: {
      date: data.date,
      title: data.title,
      category: data.category,
      description: data.description,
    },
    update: {
      title: data.title,
      category: data.category,
      description: data.description,
    },
  });

  await audit(admin.id, "REWARD_HOLIDAY_SCHEDULED", "ScheduledHoliday", holiday.id, {
    date: holiday.date,
    title: holiday.title,
  });

  return ok({ holiday });
});

const deleteHolidaySchema = z.object({
  id: z.string().min(1),
});

export const DELETE = handler(async (request: Request) => {
  let admin;
  try {
    admin = await requireRewardAdmin();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Access denied";
    return fail(message, 403);
  }

  const { id } = deleteHolidaySchema.parse(await request.json());

  const deleted = await prisma.scheduledHoliday.delete({
    where: { id },
  });

  await audit(admin.id, "REWARD_HOLIDAY_REMOVED", "ScheduledHoliday", id, {
    date: deleted.date,
    title: deleted.title,
  });

  return ok({ deleted });
});
