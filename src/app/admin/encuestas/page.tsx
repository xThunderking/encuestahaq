import { cookies } from "next/headers";
import AdminHeader from "@/components/admin/admin-header";
import AdminLogin from "@/components/admin/admin-login";
import ClearSurveysButton from "@/components/admin/clear-surveys-button";
import {
  ADMIN_SESSION_COOKIE,
  verifyAdminSessionToken,
} from "@/lib/security/admin-session";
import {
  getAdminDashboardData,
  motivationNames,
  ratingNames,
  serviceNames,
} from "@/modules/responses/get-admin-dashboard-data";
import styles from "../admin.module.css";

const prefix = "servicios_externos_diagnostico_pregunta_";

export default async function SurveysPage() {
  const token = (await cookies()).get(ADMIN_SESSION_COOKIE)?.value;
  if (!verifyAdminSessionToken(token)) return <AdminLogin />;
  const { responses } = await getAdminDashboardData();

  return (
    <main className={styles.dashboard}>
      <AdminHeader active="surveys" />
      <div className={styles.dashboardContent}>
        <div className={styles.titleRow}>
          <div>
            <p className={styles.eyebrow}>Administración</p>
            <h1>Encuestas</h1>
            <p>Se muestran los últimos 25 registros.</p>
          </div>
          <ClearSurveysButton />
        </div>
        {responses.length === 0 ? (
          <div className={styles.emptyState}>
            <h3>Aún no hay respuestas</h3>
            <p>Las encuestas completadas aparecerán aquí.</p>
          </div>
        ) : (
          <div className={styles.tableScroll}>
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Servicio</th>
                  <th>Motivo</th>
                  <th>Evaluación</th>
                  <th>Recomendación</th>
                  <th>Estacionamiento</th>
                  <th>Comentarios</th>
                  <th>Idioma</th>
                </tr>
              </thead>
              <tbody>
                {responses.map((response) => {
                  const answers = response.answers;
                  const service = String(answers[`${prefix}3`] ?? "");
                  const motivation = String(answers[`${prefix}1`] ?? "");
                  const rating = String(
                    answers[`${prefix}${service === "1" ? "28" : "6"}`] ?? "",
                  );
                  const parkingUsed = String(answers[`${prefix}33`] ?? "");
                  const parkingRating = String(answers[`${prefix}34`] ?? "");
                  const comment = String(answers[`${prefix}15`] ?? "").trim();
                  const date = response.submittedAt
                    ? new Intl.DateTimeFormat("es-MX", {
                        dateStyle: "medium",
                        timeStyle: "short",
                        timeZone: "America/Mexico_City",
                      }).format(response.submittedAt)
                    : "Pendiente";

                  return (
                    <tr key={response.id}>
                      <td data-label="Fecha">{date}</td>
                      <td data-label="Servicio">
                        {serviceNames[service] ?? "Sin dato"}
                      </td>
                      <td data-label="Motivo">
                        {motivationNames[motivation] ?? "Sin dato"}
                      </td>
                      <td data-label="Evaluación">
                        <span
                          className={`${styles.rating} ${styles[`rating_${rating}`] ?? ""}`}
                        >
                          {ratingNames[rating] ?? "Sin dato"}
                        </span>
                      </td>
                      <td data-label="Recomendación">
                        {String(answers[`${prefix}14`] ?? "Sin dato")}
                      </td>
                      <td data-label="Estacionamiento">
                        {parkingUsed === "1"
                          ? (ratingNames[parkingRating] ?? "Sin dato")
                          : parkingUsed === "0"
                            ? "No utilizó"
                            : "Sin dato"}
                      </td>
                      <td data-label="Comentarios">
                        {comment ? (
                          <p className={styles.responseComment}>{comment}</p>
                        ) : (
                          "Sin comentario"
                        )}
                      </td>
                      <td data-label="Idioma">
                        {response.locale === "en" ? "Inglés" : "Español"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
