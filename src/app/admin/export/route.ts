import { cookies } from "next/headers";
import {
  ADMIN_SESSION_COOKIE,
  verifyAdminSessionToken,
} from "@/lib/security/admin-session";
import {
  buildDashboardAnalytics,
  getAllSurveyResponses,
} from "@/modules/responses/get-admin-dashboard-data";
import { createSurveyExcel } from "@/modules/reports/create-survey-excel";

export async function GET() {
  const token = (await cookies()).get(ADMIN_SESSION_COOKIE)?.value;
  if (!verifyAdminSessionToken(token)) {
    return Response.json({ error: "No autorizado." }, { status: 401 });
  }

  try {
    const responses = await getAllSurveyResponses();
    const report = await createSurveyExcel(
      responses,
      buildDashboardAnalytics(responses),
    );
    const date = new Date().toISOString().slice(0, 10);

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
