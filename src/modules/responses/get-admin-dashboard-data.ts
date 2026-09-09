import "server-only";

import { adminDb } from "@/lib/firebase-admin";

const answerPrefix = "servicios_externos_diagnostico_pregunta_";

export type DashboardResponse = {
  id: string;
  submissionId: string;
  surveyCode: string;
  locale: string;
  answers: Record<string, unknown>;
  submittedAt: Date | null;
};

export type ChartDatum = { name: string; value: number };

export type DashboardAnalytics = {
  dailyResponses: ChartDatum[];
  services: ChartDatum[];
  motivations: ChartDatum[];
  satisfaction: ChartDatum[];
  languages: ChartDatum[];
  npsDistribution: ChartDatum[];
  contactConsent: ChartDatum[];
  attributeRatings: ChartDatum[];
  nps: number | null;
  averageRecommendation: number | null;
  completionWithContact: number;
};

export const serviceNames: Record<string, string> = {
  "0": "Banco de Sangre",
  "1": "Check-up",
  "2": "Colonoscopia/Endoscopia",
  "3": "Hemodiálisis",
  "4": "Hemodinamia",
  "5": "Imagenología",
  "6": "Laboratorio",
  "7": "Urgencias",
  "8": "Otro",
};

export const motivationNames: Record<string, string> = {
  "0": "Solicitud médica",
  "1": "Referencia personal",
  "2": "Convenio",
  "3": "Ubicación",
  "4": "Confianza en la marca",
  "5": "Otro",
  "6": "Publicidad",
  "7": "Paciente recurrente",
};

export const ratingNames: Record<string, string> = {
  excellent: "Excelente",
  good: "Bueno",
  fair: "Regular",
  poor: "Malo",
};

const attributeNames: Record<string, string> = {
  "6": "Satisfacción general",
  "7": "Atención al recibirle",
  "8": "Claridad de indicaciones",
  "9": "Tiempo de espera",
  "10": "Personal durante procedimiento",
  "11": "Instalaciones y limpieza",
  "21": "Rapidez para agendar",
  "22": "Información previa",
  "23": "Personal de admisión",
  "24": "Instalaciones de check-up",
  "25": "Tiempos de check-up",
  "26": "Personal de enfermería",
  "27": "Personal médico",
  "28": "Satisfacción de check-up",
};

const ratingScores: Record<string, number> = {
  excellent: 4,
  good: 3,
  fair: 2,
  poor: 1,
};

function answer(response: DashboardResponse, question: string) {
  return response.answers[`${answerPrefix}${question}`];
}

function countValues(
  responses: DashboardResponse[],
  question: string,
  labels: Record<string, string>,
) {
  const counts = new Map<string, number>();
  for (const response of responses) {
    const raw = answer(response, question);
    if (raw === undefined || raw === null || raw === "") continue;
    const key = String(raw);
    const name = labels[key] ?? key;
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return [...counts]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

function buildDailyResponses(responses: DashboardResponse[]) {
  const labelFormatter = new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "short",
    timeZone: "America/Mexico_City",
  });
  const keyFormatter = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "America/Mexico_City",
  });
  const counts = new Map<string, number>();
  for (const response of responses) {
    if (!response.submittedAt) continue;
    const key = keyFormatter.format(response.submittedAt);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Array.from({ length: 14 }, (_, index) => {
    const date = new Date();
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() - (13 - index));
    return {
      name: labelFormatter.format(date),
      value: counts.get(keyFormatter.format(date)) ?? 0,
    };
  });
}

export function buildDashboardAnalytics(
  responses: DashboardResponse[],
): DashboardAnalytics {
  const services = countValues(responses, "3", serviceNames);
  const motivations = countValues(responses, "1", motivationNames);
  const languages = [
    {
      name: "Español",
      value: responses.filter((item) => item.locale === "es").length,
    },
    {
      name: "Inglés",
      value: responses.filter((item) => item.locale === "en").length,
    },
  ].filter((item) => item.value > 0);

  const satisfactionCounts = new Map<string, number>();
  const npsCounts = Array.from({ length: 11 }, (_, score) => ({
    name: String(score),
    value: 0,
  }));
  const recommendationScores: number[] = [];
  let promoters = 0;
  let detractors = 0;
  let contactYes = 0;
  let contactNo = 0;

  for (const response of responses) {
    const service = String(answer(response, "3") ?? "");
    const rating = String(
      answer(response, service === "1" ? "28" : "6") ?? "",
    );
    if (ratingNames[rating]) {
      const label = ratingNames[rating];
      satisfactionCounts.set(label, (satisfactionCounts.get(label) ?? 0) + 1);
    }

    const score = Number(answer(response, "14"));
    if (Number.isInteger(score) && score >= 0 && score <= 10) {
      npsCounts[score].value += 1;
      recommendationScores.push(score);
      if (score >= 9) promoters += 1;
      if (score <= 6) detractors += 1;
    }

    const consent = String(answer(response, "32") ?? "");
    if (consent === "1") contactYes += 1;
    if (consent === "0") contactNo += 1;
  }

  const attributeRatings = Object.entries(attributeNames)
    .map(([question, name]) => {
      const scores = responses
        .map(
          (response) =>
            ratingScores[String(answer(response, question) ?? "")],
        )
        .filter((score): score is number => Number.isFinite(score));
      return {
        name,
        value: scores.length
          ? Number(
              (
                scores.reduce((sum, score) => sum + score, 0) / scores.length
              ).toFixed(2),
            )
          : 0,
      };
    })
    .filter((item) => item.value > 0);

  const recommendationTotal = recommendationScores.length;
  return {
    dailyResponses: buildDailyResponses(responses),
    services,
    motivations,
    satisfaction: [...satisfactionCounts].map(([name, value]) => ({
      name,
      value,
    })),
    languages,
    npsDistribution: npsCounts,
    contactConsent: [
      { name: "Sí", value: contactYes },
      { name: "No", value: contactNo },
    ].filter((item) => item.value > 0),
    attributeRatings,
    nps: recommendationTotal
      ? Math.round(((promoters - detractors) / recommendationTotal) * 100)
      : null,
    averageRecommendation: recommendationTotal
      ? Number(
          (
            recommendationScores.reduce((sum, score) => sum + score, 0) /
            recommendationTotal
          ).toFixed(1),
        )
      : null,
    completionWithContact: responses.length
      ? Math.round((contactYes / responses.length) * 100)
      : 0,
  };
}

export async function getAllSurveyResponses() {
  const snapshot = await adminDb.collection("surveyResponses").get();
  return snapshot.docs
    .map<DashboardResponse>((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        submissionId: String(data.submissionId ?? doc.id),
        surveyCode: String(data.surveyCode ?? ""),
        locale: String(data.locale ?? ""),
        answers: (data.answers ?? {}) as Record<string, unknown>,
        submittedAt: data.submittedAt?.toDate?.() ?? null,
      };
    })
    .sort(
      (a, b) =>
        (b.submittedAt?.getTime() ?? 0) - (a.submittedAt?.getTime() ?? 0),
    );
}

export async function getAdminDashboardData() {
  const allResponses = await getAllSurveyResponses();
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const recentTotal = allResponses.filter(
    (response) => response.submittedAt && response.submittedAt >= sevenDaysAgo,
  ).length;

  return {
    total: allResponses.length,
    recentTotal,
    analytics: buildDashboardAnalytics(allResponses),
    responses: allResponses.slice(0, 25),
  };
}
