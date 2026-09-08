import { adminDb } from "@/lib/firebase-admin";

type DashboardResponse = {
  id: string;
  submissionId: string;
  surveyCode: string;
  locale: string;
  answers: Record<string, unknown>;
  submittedAt: Date | null;
};

export async function getAdminDashboardData() {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const snapshot = await adminDb.collection("surveyResponses").get();
  const allResponses: DashboardResponse[] = snapshot.docs
    .map((doc) => {
      const data = doc.data();
      const submittedAt = data.submittedAt?.toDate?.() ?? null;
      return {
        id: doc.id,
        submissionId: String(data.submissionId ?? doc.id),
        surveyCode: String(data.surveyCode ?? ""),
        locale: String(data.locale ?? ""),
        answers: (data.answers ?? {}) as Record<string, unknown>,
        submittedAt,
      };
    })
    .sort((a, b) => (b.submittedAt?.getTime() ?? 0) - (a.submittedAt?.getTime() ?? 0));
  const total = allResponses.length;
  const recentTotal = allResponses.filter(
    (response) => response.submittedAt && response.submittedAt >= sevenDaysAgo,
  ).length;
  const localeCounts = new Map<string, number>();
  for (const response of allResponses) {
    localeCounts.set(response.locale, (localeCounts.get(response.locale) ?? 0) + 1);
  }
  const languageGroups = [...localeCounts].map(([locale, count]) => ({
    locale,
    _count: { _all: count },
  }));
  const responses = allResponses.slice(0, 25);

  return { total, recentTotal, languageGroups, responses };
}
