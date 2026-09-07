"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import styles from "@/app/admin/admin.module.css";

export default function AdminLogout() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  return (
    <button
      className={styles.logoutButton}
      type="button"
      disabled={loading}
      onClick={async () => {
        setLoading(true);
        try {
          await fetch("/api/admin/logout", { method: "POST" });
        } finally {
          router.refresh();
        }
      }}
    >
      {loading ? "Saliendo..." : "Cerrar sesión"}
    </button>
  );
}
