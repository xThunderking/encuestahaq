"use client";

import { useState } from "react";
import styles from "@/app/admin/admin.module.css";

type ExportFormat = "excel" | "pdf";

function formatMonth(month: string) {
  return new Intl.DateTimeFormat("es-MX", {
    month: "long",
    year: "numeric",
    timeZone: "America/Mexico_City",
  }).format(new Date(`${month}-01T12:00:00`));
}

export default function ExportResultsButton() {
  const [exporting, setExporting] = useState<ExportFormat | null>(null);
  const [format, setFormat] = useState<ExportFormat | null>(null);
  const [months, setMonths] = useState<string[]>([]);
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);
  const [loadingMonths, setLoadingMonths] = useState(false);
  const [error, setError] = useState(false);

  async function openExportModal(selectedFormat: ExportFormat) {
    setFormat(selectedFormat);
    if (months.length) return;
    setLoadingMonths(true);
    try {
      const response = await fetch("/admin/export-months");
      if (!response.ok) throw new Error("Unable to load months");
      const data = (await response.json()) as { months: string[] };
      setMonths(data.months);
    } catch {
      setError(true);
    } finally {
      setLoadingMonths(false);
    }
  }

  function toggleMonth(month: string) {
    setSelectedMonths((current) =>
      current.includes(month)
        ? current.filter((item) => item !== month)
        : [...current, month],
    );
  }

  async function exportResults(selectedFormat: ExportFormat) {
    setExporting(selectedFormat);
    setError(false);
    try {
      const endpoint =
        selectedFormat === "excel" ? "/admin/export" : "/admin/export-pdf";
      const query = selectedMonths.length
        ? `?months=${encodeURIComponent(selectedMonths.join(","))}`
        : "";
      const response = await fetch(`${endpoint}${query}`);
      if (!response.ok) throw new Error("Export failed");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download =
        selectedFormat === "excel"
          ? "resultados-encuestas-varios-meses.xlsx"
          : "graficas-encuestas-varios-meses.pdf";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError(true);
    } finally {
      setExporting(null);
      setFormat(null);
    }
  }

  return (
    <div className={styles.exportControl}>
      <div className={styles.exportButtons}>
        <button
          type="button"
          className={styles.exportButton}
          onClick={() => void openExportModal("excel")}
          disabled={exporting !== null}
        >
          Exportar Excel
        </button>
        <button
          type="button"
          className={`${styles.exportButton} ${styles.exportPdfButton}`}
          onClick={() => void openExportModal("pdf")}
          disabled={exporting !== null}
        >
          Exportar PDF
        </button>
      </div>
      {error && (
        <span role="alert">
          No se pudo generar el archivo. Intenta nuevamente.
        </span>
      )}
      {format && (
        <div className={styles.exportModalBackdrop} role="presentation">
          <section
            className={styles.exportModal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="export-modal-title"
          >
            <h2 id="export-modal-title">Meses a exportar</h2>
            <p>Marca uno o varios meses. Sin selección se incluirán todos.</p>
            {loadingMonths ? (
              <p>Cargando meses…</p>
            ) : months.length ? (
              <div className={styles.exportMonthList}>
                {months.map((month) => (
                  <label key={month} className={styles.exportMonthOption}>
                    <input
                      type="checkbox"
                      checked={selectedMonths.includes(month)}
                      onChange={() => toggleMonth(month)}
                    />
                    <span>{formatMonth(month)}</span>
                  </label>
                ))}
              </div>
            ) : (
              <p>No hay meses con respuestas todavía.</p>
            )}
            <div className={styles.exportModalActions}>
              <button
                type="button"
                className={styles.exportCancelButton}
                onClick={() => setFormat(null)}
                disabled={exporting !== null}
              >
                Cancelar
              </button>
              <button
                type="button"
                className={styles.exportButton}
                onClick={() => void exportResults(format)}
                disabled={exporting !== null || loadingMonths}
              >
                {exporting
                  ? "Generando…"
                  : `Exportar ${format === "excel" ? "Excel" : "PDF"}`}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
