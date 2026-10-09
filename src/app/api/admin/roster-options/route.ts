import { z } from "zod";
import { handler, ok, fail, audit } from "@/lib/api";
import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const DEFAULT_DEPARTMENTS = [
  "Artificial Intelligence and Data Science",
  "Computer Science and Engineering",
  "Information Technology",
  "Electronics and Communication Engineering",
  "Mechanical Engineering",
  "Electrical and Electronics Engineering",
  "Civil Engineering",
  "Biotechnology",
  "Mechatronics Engineering",
];

const DEFAULT_YEARS = [
  "1st Year",
  "2nd Year",
  "3rd Year",
  "4th Year",
  "Staff",
];

const DEFAULT_DOMAINS = [
  "UI/UX Design",
  "Full Stack Development",
  "AI & Machine Learning",
  "Mobile App Development",
  "Cloud & DevOps",
  "Cybersecurity",
  "Data not Feeded",
];

const DEFAULT_MENTORS = [
  "Dr. Sarah Jenkins - Lead Architect",
  "Prof. Alex Rivera - Systems & UI",
  "Elena Rostova - Full Stack Specialist",
  "Karthik Raman - AI/ML Lead",
];

/**
 * Fetch all roster options (Departments, Years, Domains, Mentors).
 * If the database has not been initialized with options yet, seeds the defaults.
 */
export const GET = handler(async () => {
  await requireApiPermission("permUserManagement");

  let options = await prisma.rosterOption.findMany({
    orderBy: [{ order: "asc" }, { value: "asc" }],
  });

  // Seed default options if table is empty
  if (options.length === 0) {
    const seedData: Array<{ category: string; value: string; label: string; order: number }> = [
      ...DEFAULT_DEPARTMENTS.map((d, i) => ({ category: "DEPARTMENT", value: d, label: d, order: i })),
      ...DEFAULT_YEARS.map((y, i) => ({ category: "YEAR", value: y, label: y, order: i })),
      ...DEFAULT_DOMAINS.map((dm, i) => ({ category: "DOMAIN", value: dm, label: dm, order: i })),
      ...DEFAULT_MENTORS.map((m, i) => ({ category: "MENTOR", value: m, label: m, order: i })),
    ];

    await prisma.rosterOption.createMany({
      data: seedData,
      skipDuplicates: true,
    });

    options = await prisma.rosterOption.findMany({
      orderBy: [{ order: "asc" }, { value: "asc" }],
    });
  }

  // Also query active staff members (Mentors & Admins) from User table to include as mentors
  const staffUsers = await prisma.user.findMany({
    where: {
      role: { in: ["MENTOR", "ADMIN", "SUPER_ADMIN"] },
      systemStatus: "ACTIVE",
    },
    select: { name: true, role: true, department: true },
    orderBy: { name: "asc" },
  });

  const staffMentorNames = staffUsers.map((u) => u.name);

  // Group options by category
  const departments = options.filter((o) => o.category === "DEPARTMENT").map((o) => ({ id: o.id, value: o.value }));
  const years = options.filter((o) => o.category === "YEAR").map((o) => ({ id: o.id, value: o.value }));
  const domains = options.filter((o) => o.category === "DOMAIN").map((o) => ({ id: o.id, value: o.value }));
  
  // Combine custom mentors and staff users
  const configuredMentors = options.filter((o) => o.category === "MENTOR").map((o) => ({ id: o.id, value: o.value }));
  const mentorSet = new Set(configuredMentors.map((m) => m.value));
  for (const name of staffMentorNames) {
    if (!mentorSet.has(name)) {
      configuredMentors.push({ id: `staff-${name}`, value: name });
    }
  }

  return ok({
    departments,
    years,
    domains,
    mentors: configuredMentors,
  });
});

// ---------------------------------------------------------------------------

const addOptionSchema = z.object({
  category: z.enum(["DEPARTMENT", "YEAR", "DOMAIN", "MENTOR"]),
  value: z.string().trim().min(1, "Value cannot be empty").max(120),
});

/**
 * Add a new option to a category.
 */
export const POST = handler(async (request: Request) => {
  const admin = await requireApiPermission("permUserManagement");
  const { category, value } = addOptionSchema.parse(await request.json());

  const existing = await prisma.rosterOption.findUnique({
    where: { category_value: { category, value } },
  });

  if (existing) {
    return fail(`"${value}" already exists in ${category.toLowerCase()}s.`, 409);
  }

  const highestOrder = await prisma.rosterOption.aggregate({
    where: { category },
    _max: { order: true },
  });

  const created = await prisma.rosterOption.create({
    data: {
      category,
      value,
      label: value,
      order: (highestOrder._max.order ?? 0) + 1,
    },
  });

  await audit(admin.id, "ROSTER_OPTION_CREATE", "RosterOption", created.id, { category, value });

  return ok(created);
});

// ---------------------------------------------------------------------------

const updateOptionSchema = z.object({
  id: z.string().min(1),
  value: z.string().trim().min(1, "Value cannot be empty").max(120),
  propagateToUsers: z.boolean().default(true),
});

/**
 * Update an existing option value and optionally propagate rename to existing users.
 */
export const PUT = handler(async (request: Request) => {
  const admin = await requireApiPermission("permUserManagement");
  const { id, value, propagateToUsers } = updateOptionSchema.parse(await request.json());

  const current = await prisma.rosterOption.findUnique({ where: { id } });
  if (!current) return fail("Option not found.", 404);

  const oldValue = current.value;

  const updated = await prisma.rosterOption.update({
    where: { id },
    data: { value, label: value },
  });

  // Optionally propagate rename across existing users
  if (propagateToUsers && oldValue !== value) {
    if (current.category === "DEPARTMENT") {
      await prisma.user.updateMany({ where: { department: oldValue }, data: { department: value } });
    } else if (current.category === "YEAR") {
      await prisma.user.updateMany({ where: { year: oldValue }, data: { year: value } });
    } else if (current.category === "DOMAIN") {
      await prisma.user.updateMany({ where: { domain: oldValue }, data: { domain: value } });
    } else if (current.category === "MENTOR") {
      await prisma.user.updateMany({ where: { mentorName: oldValue }, data: { mentorName: value } });
    }
  }

  await audit(admin.id, "ROSTER_OPTION_UPDATE", "RosterOption", id, {
    category: current.category,
    oldValue,
    newValue: value,
    propagated: propagateToUsers,
  });

  return ok(updated);
});

// ---------------------------------------------------------------------------

const deleteOptionSchema = z.object({
  id: z.string().min(1),
});

/**
 * Delete an option.
 */
export const DELETE = handler(async (request: Request) => {
  const admin = await requireApiPermission("permUserManagement");
  const { id } = deleteOptionSchema.parse(await request.json());

  const current = await prisma.rosterOption.findUnique({ where: { id } });
  if (!current) return fail("Option not found.", 404);

  await prisma.rosterOption.delete({ where: { id } });

  await audit(admin.id, "ROSTER_OPTION_DELETE", "RosterOption", id, {
    category: current.category,
    value: current.value,
  });

  return ok({ id, deleted: true });
});
