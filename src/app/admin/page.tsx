import Image from "next/image";
import Link from "next/link";
import { cookies } from "next/headers";
import AdminLogin from "@/components/admin/admin-login";
import AdminLogout from "@/components/admin/admin-logout";
import AdminDashboardCharts from "@/components/admin/admin-dashboard-charts";
import ExportResultsButton from "@/components/admin/export-results-button";
import {
  ADMIN_SESSION_COOKIE,
  verifyAdminSessionToken,
} from "@/lib/security/admin-session";
import {
  getAdminDashboardData,
  ratingNames,
  serviceNames,
} from "@/modules/responses/get-admin-dashboard-data";
import styles from "./admin.module.css";

const answerPrefix = "servicios_externos_diagnostico_pregunta_";

function asAnswers(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function formatDate(date: Date | null) {
  if (!date) return "Pendiente";
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Mexico_City",
  }).format(date);
}

export default async function AdminPage() {
  const token = (await cookies()).get(ADMIN_SESSION_COOKIE)?.value;
  if (!verifyAdminSessionToken(token)) return <AdminLogin />;

  const { total, recentTotal, analytics, responses } =
    await getAdminDashboardData();
  const spanishTotal =
    analytics.languages.find((item) => item.name === "Español")?.value ?? 0;

  return (
    <main className={styles.dashboard}>
      <header className={styles.dashboardHeader}>
        <div className={styles.headerInner}>
          <Image
            src="/hospital-angeles-header.png"
            alt="Hospital Angeles Health System"
            width={260}
            height={54}
            className={styles.headerLogo}
          />
          <div className={styles.headerActions}>
            <Link href="/">Ver encuesta</Link>
            <AdminLogout />
          </div>
        </div>
      </header>
      <div className={styles.dashboardContent}>
        <div className={styles.titleRow}>
          <div>
            <p className={styles.eyebrow}>Administración</p>
            <h1>Panel de encuestas</h1>
            <p>Hospital Angeles Querétaro</p>
          </div>
          <ExportResultsButton />
        </div>
        <section className={styles.metrics} aria-label="Resumen de respuestas">
          <article>
            <span>Total de respuestas</span>
            <strong>{total}</strong>
          </article>
          <article>
            <span>Últimos 7 días</span>
            <strong>{recentTotal}</strong>
          </article>
          <article>
            <span>Encuestas en español</span>
            <strong>{spanishTotal}</strong>
          </article>
          <article>
            <span>NPS</span>
            <strong>{analytics.nps ?? "—"}</strong>
          </article>
          <article>
            <span>Promedio de recomendación</span>
            <strong>
              {analytics.averageRecommendation ?? "—"}
              {analytics.averageRecommendation !== null && <small>/10</small>}
            </strong>
          </article>
          <article>
            <span>Aceptó compartir contacto</span>
            <strong>{analytics.completionWithContact}%</strong>
          </article>
        </section>
        <section className={styles.surveySummary}>
          <div>
            <span className={styles.status}>Activa</span>
            <h2>Servicios externos de diagnóstico</h2>
            <p>{total} respuestas registradas</p>
          </div>
          <Link href="/">Abrir cuestionario</Link>
        </section>
        <AdminDashboardCharts analytics={analytics} />
        <section className={styles.responsesSection}>
          <div className={styles.sectionHeading}>
            <div>
              <h2>Respuestas recientes</h2>
              <p>Se muestran los últimos 25 registros.</p>
            </div>
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
                    <th>Folio</th>
                    <th>Fecha</th>
                    <th>Servicio</th>
                    <th>Evaluación</th>
                    <th>Recomendación</th>
                    <th>Idioma</th>
                  </tr>
                </thead>
                <tbody>
                  {responses.map((response) => {
                    const answers = asAnswers(response.answers);
                    const service = String(answers[`${answerPrefix}3`] ?? "");
                    const rating = String(
                      answers[
                        `${answerPrefix}${service === "1" ? "28" : "6"}`
                      ] ?? "",
                    );
                    const customService = answers[`${answerPrefix}18`];
                    return (
                      <tr key={response.id}>
                        <td data-label="Folio">#{response.id}</td>
                        <td data-label="Fecha">{formatDate(response.submittedAt)}</td>
                        <td data-label="Servicio">
                          {service === "8" && typeof customService === "string"
                            ? customService
                            : (serviceNames[service] ?? "Sin dato")}
                        </td>
                        <td data-label="Evaluación">
                          <span
                            className={`${styles.rating} ${styles[`rating_${rating}`] ?? ""}`}
                          >
                            {ratingNames[rating] ?? "Sin dato"}
                          </span>
                        </td>
                        <td data-label="Recomendación">
                          {String(answers[`${answerPrefix}14`] ?? "Sin dato")}
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
        </section>
      </div>
    </main>
  );
}
