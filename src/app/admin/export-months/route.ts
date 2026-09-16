import { cookies } from "next/headers";
import {
  ADMIN_SESSION_COOKIE,
  verifyAdminSessionToken,
} from "@/lib/security/admin-session";
import { getAllSurveyResponses } from "@/modules/responses/get-admin-dashboard-data";

export async function GET() {
  const token = (await cookies()).get(ADMIN_SESSION_COOKIE)?.value;
  if (!verifyAdminSessionToken(token)) {
    return Response.json({ error: "No autorizado." }, { status: 401 });
  }

  const formatter = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    timeZone: "America/Mexico_City",
  });
  const months = [
    ...new Set(
      (await getAllSurveyResponses()).flatMap((response) =>
        response.submittedAt ? [formatter.format(response.submittedAt)] : [],
      ),
    ),
  ]
    .sort()
    .reverse();

  return Response.json(
    { months },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
