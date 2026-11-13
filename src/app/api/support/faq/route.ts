import { fail, handler, ok } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { ensureFaqArticles } from "@/lib/support-seed";

export const GET = handler(async (request: Request) => {
  await ensureFaqArticles();

  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category") || "ALL";
  const moduleName = searchParams.get("module") || "ALL";
  const query = (searchParams.get("q") || "").trim().toLowerCase();

  const where: any = {};

  if (category !== "ALL") {
    where.category = category;
  }
  if (moduleName !== "ALL") {
    where.module = moduleName;
  }
  if (query) {
    where.OR = [
      { title: { contains: query, mode: "insensitive" } },
      { question: { contains: query, mode: "insensitive" } },
      { answer: { contains: query, mode: "insensitive" } },
      { tags: { contains: query, mode: "insensitive" } },
    ];
  }

  const articles = await prisma.faqArticle.findMany({
    where,
    orderBy: [{ helpfulCount: "desc" }, { createdAt: "asc" }],
  });

  return ok({ articles });
});

export const POST = handler(async (request: Request) => {
  const body = await request.json();
  const id = body.id;
  if (!id) return fail("Article ID required", 400);

  const article = await prisma.faqArticle.update({
    where: { id },
    data: { helpfulCount: { increment: 1 } },
  });

  return ok({ article });
});
