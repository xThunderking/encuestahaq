"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { getAuth, signOut } from "firebase/auth";
import styles from "@/app/admin/admin.module.css";
import { firebaseApp } from "@/lib/firebase/client";

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
          await signOut(getAuth(firebaseApp));
        } finally {
          router.refresh();
        }
      }}
    >
      {loading ? "Saliendo..." : "Cerrar sesión"}
    </button>
  );
}
