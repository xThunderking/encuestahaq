"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "@/app/admin/admin.module.css";

export default function ClearSurveysButton() {
  const router = useRouter();
  const [clearing, setClearing] = useState(false);
  const [error, setError] = useState(false);

  async function clearSurveys() {
    const confirmed = window.confirm(
      "Esto eliminará permanentemente TODAS las respuestas de encuesta de la base de datos. Esta acción no se puede deshacer. ¿Deseas continuar?",
    );
    if (!confirmed) return;

    setClearing(true);
    setError(false);
    try {
      const response = await fetch("/api/admin/survey-responses", {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Unable to clear surveys");
      router.refresh();
    } catch {
      setError(true);
    } finally {
      setClearing(false);
    }
  }

  return (
    <div className={styles.clearSurveysControl}>
      <button
        type="button"
        className={styles.clearSurveysButton}
        onClick={() => void clearSurveys()}
        disabled={clearing}
      >
        {clearing ? "Vaciando encuestas…" : "Vaciar encuestas"}
      </button>
      {error && (
        <span role="alert">No se pudieron eliminar las encuestas.</span>
      )}
    </div>
  );
}
