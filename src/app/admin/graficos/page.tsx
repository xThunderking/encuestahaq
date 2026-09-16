import { cookies } from "next/headers";
import AdminDashboardCharts from "@/components/admin/admin-dashboard-charts";
import AdminHeader from "@/components/admin/admin-header";
import AdminLogin from "@/components/admin/admin-login";
import ExportResultsButton from "@/components/admin/export-results-button";
import {
  ADMIN_SESSION_COOKIE,
  verifyAdminSessionToken,
} from "@/lib/security/admin-session";
import { getAdminDashboardData } from "@/modules/responses/get-admin-dashboard-data";
import styles from "../admin.module.css";

export default async function ChartsPage() {
  const token = (await cookies()).get(ADMIN_SESSION_COOKIE)?.value;
  if (!verifyAdminSessionToken(token)) return <AdminLogin />;
  const { analytics } = await getAdminDashboardData();
  return (
    <main className={styles.dashboard}>
      <AdminHeader active="charts" />
      <div className={styles.dashboardContent}>
        <div className={styles.titleRow}>
          <div>
            <p className={styles.eyebrow}>Administración</p>
            <h1>Gráficos</h1>
            <p>Análisis de resultados de encuestas.</p>
          </div>
          <ExportResultsButton />
        </div>
        <AdminDashboardCharts analytics={analytics} />
      </div>
    </main>
  );
}
