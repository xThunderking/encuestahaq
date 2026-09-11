"use client";

import { useState } from "react";
import styles from "@/app/admin/admin.module.css";

export default function ExportResultsButton() {
  const [exporting, setExporting] = useState<"excel" | "pdf" | null>(null);
  const [error, setError] = useState(false);

  async function exportResults(format: "excel" | "pdf") {
    setExporting(format);
    setError(false);
    try {
      const response = await fetch(
        format === "excel" ? "/admin/export" : "/admin/export-pdf",
      );
      if (!response.ok) throw new Error("Export failed");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      const date = new Date().toISOString().slice(0, 10);
      anchor.download =
        format === "excel"
          ? `resultados-encuestas-${date}.xlsx`
          : `graficas-encuestas-${date}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError(true);
    } finally {
      setExporting(null);
    }
  }

  return (
    <div className={styles.exportControl}>
      <div className={styles.exportButtons}>
      <button
        type="button"
        className={styles.exportButton}
        onClick={() => void exportResults("excel")}
        disabled={exporting !== null}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 3v11m0 0 4-4m-4 4-4-4M5 15v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4" />
        </svg>
        {exporting === "excel" ? "Preparando Excel…" : "Exportar Excel"}
      </button>
      <button
        type="button"
        className={`${styles.exportButton} ${styles.exportPdfButton}`}
        onClick={() => void exportResults("pdf")}
        disabled={exporting !== null}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 3v11m0 0 4-4m-4 4-4-4M5 15v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4" />
        </svg>
        {exporting === "pdf" ? "Preparando PDF..." : "Exportar PDF"}
      </button>
      </div>
      {error && <span role="alert">No se pudo generar el archivo. Intenta nuevamente.</span>}
    </div>
  );
}
