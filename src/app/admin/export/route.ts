import { cookies } from "next/headers";
import {
  ADMIN_SESSION_COOKIE,
  verifyAdminSessionToken,
} from "@/lib/security/admin-session";
import {
  buildDashboardAnalytics,
  filterResponsesByMonths,
  getAllSurveyResponses,
} from "@/modules/responses/get-admin-dashboard-data";
import { createSurveyExcel } from "@/modules/reports/create-survey-excel";

export async function GET(request: Request) {
  const token = (await cookies()).get(ADMIN_SESSION_COOKIE)?.value;
  if (!verifyAdminSessionToken(token)) {
    return Response.json({ error: "No autorizado." }, { status: 401 });
  }

  try {
    const rawMonths = new URL(request.url).searchParams.get("months") ?? "";
    const months = rawMonths ? rawMonths.split(",") : [];
    if (months.some((month) => !/^\d{4}-(0[1-9]|1[0-2])$/.test(month))) {
      return Response.json({ error: "Mes no válido." }, { status: 400 });
    }
    const responses = filterResponsesByMonths(
      await getAllSurveyResponses(),
      months,
    );
    const report = await createSurveyExcel(
      responses,
      buildDashboardAnalytics(responses),
    );
    const date = months.length === 1 ? months[0] : "varios-meses";

    return new Response(new Uint8Array(report), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="resultados-encuestas-${date}.xlsx"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("Unable to export survey results", error);
    return Response.json(
      { error: "No fue posible generar el reporte." },
      { status: 500 },
    );
  }
}
