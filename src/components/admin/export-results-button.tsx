"use client";

import { useState } from "react";
import styles from "@/app/admin/admin.module.css";

export default function ExportResultsButton() {
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState(false);

  async function exportResults() {
    setExporting(true);
    setError(false);
    try {
      const response = await fetch("/admin/export");
      if (!response.ok) throw new Error("Export failed");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `resultados-encuestas-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError(true);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className={styles.exportControl}>
      <button
        type="button"
        className={styles.exportButton}
        onClick={() => void exportResults()}
        disabled={exporting}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 3v11m0 0 4-4m-4 4-4-4M5 15v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4" />
        </svg>
        {exporting ? "Preparando Excel…" : "Exportar resultados"}
      </button>
      {error && <span role="alert">No se pudo generar el archivo. Intenta nuevamente.</span>}
    </div>
  );
}
