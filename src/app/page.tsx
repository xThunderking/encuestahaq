import { cookies } from "next/headers";
import AdminLogin from "@/components/admin/admin-login";
import AdminLogout from "@/components/admin/admin-logout";
import AttendanceTable from "@/components/attendance/attendance-table";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "@/lib/security/admin-session";
import { getAttendanceGuests } from "@/modules/attendance/get-attendance-guests";
import styles from "./admin/admin.module.css";

export default async function Home() {
  const token = (await cookies()).get(ADMIN_SESSION_COOKIE)?.value;
  if (!verifyAdminSessionToken(token)) return <AdminLogin />;

  const guests = await getAttendanceGuests();

  return (
    <main className={styles.dashboard}>
      <header className={styles.dashboardHeader}>
        <div className={styles.headerInner}>
          <div>
            <p className={styles.eyebrow}>Hospital Ángeles Querétaro</p>
            <h1 className="text-lg font-semibold text-slate-800 sm:text-xl">
              Lista de invitados desayuno evento Día del Médico
            </h1>
          </div>
          <AdminLogout />
        </div>
      </header>
      <AttendanceTable initialGuests={guests} />
    </main>
  );
}
