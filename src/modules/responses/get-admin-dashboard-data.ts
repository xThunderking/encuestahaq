import { prisma } from "@/lib/db/prisma";

export async function getAdminDashboardData() {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [total, recentTotal, languageGroups, responses] = await Promise.all([
    prisma.surveyResponse.count(),
    prisma.surveyResponse.count({
      where: { submittedAt: { gte: sevenDaysAgo } },
    }),
    prisma.surveyResponse.groupBy({ by: ["locale"], _count: { _all: true } }),
    prisma.surveyResponse.findMany({
      orderBy: { submittedAt: "desc" },
      take: 25,
    }),
  ]);

  return { total, recentTotal, languageGroups, responses };
}
