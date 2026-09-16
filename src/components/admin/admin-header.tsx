import Image from "next/image";
import Link from "next/link";
import AdminLogout from "@/components/admin/admin-logout";
import styles from "@/app/admin/admin.module.css";

export default function AdminHeader({ active }: { active: string }) {
  return (
    <header className={styles.dashboardHeader}>
      <div className={styles.headerInner}>
        <Link href="/admin" aria-label="Inicio del panel">
          <Image
            src="/hospital-angeles-header.png"
            alt="Hospital Angeles Health System"
            width={260}
            height={54}
            className={styles.headerLogo}
          />
        </Link>
        <nav className={styles.adminNav} aria-label="Navegación del panel">
          <Link
            href="/admin/graficos"
            className={active === "charts" ? styles.navActive : ""}
          >
            Gráficos
          </Link>
          <Link href="/" target="_blank">
            Ver encuesta
          </Link>
          <Link
            href="/admin/encuestas"
            className={active === "surveys" ? styles.navActive : ""}
          >
            Encuestas
          </Link>
          <AdminLogout />
        </nav>
      </div>
    </header>
  );
}
