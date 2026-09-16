import { cookies } from "next/headers";
import AdminHeader from "@/components/admin/admin-header";
import AdminLogin from "@/components/admin/admin-login";
import ExportResultsButton from "@/components/admin/export-results-button";
import {
  ADMIN_SESSION_COOKIE,
  verifyAdminSessionToken,
} from "@/lib/security/admin-session";
import { getAdminDashboardData } from "@/modules/responses/get-admin-dashboard-data";
import styles from "./admin.module.css";

export default async function AdminPage() {
  const token = (await cookies()).get(ADMIN_SESSION_COOKIE)?.value;
  if (!verifyAdminSessionToken(token)) return <AdminLogin />;

  const { total, recentTotal, analytics } = await getAdminDashboardData();
  const spanishTotal =
    analytics.languages.find((item) => item.name === "Español")?.value ?? 0;

  return (
    <main className={styles.dashboard}>
      <AdminHeader active="home" />
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
      </div>
    </main>
  );
}
