"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./attendance.module.css";

export default function AttendanceExportButton() {
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const requestRef = useRef<AbortController | null>(null);

  useEffect(() => () => requestRef.current?.abort(), []);

  async function downloadExcel() {
    if (requestRef.current) return;
    const controller = new AbortController();
    requestRef.current = controller;
    setExporting(true);
    setError("");
    try {
      const response = await fetch("/api/admin/attendance/export", {
        cache: "no-store",
        signal: controller.signal,
      });
      if (!response.ok) {
        const result = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(
          result?.error || "No pudimos generar el Excel. Inténtalo de nuevo.",
        );
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download =
        /filename="([^"]+)"/.exec(
          response.headers.get("Content-Disposition") ?? "",
        )?.[1] || "asistencia-dia-del-medico.xlsx";
      document.body.appendChild(link);
      link.click();
      link.remove();
      // Allow Safari to finish reading the file before releasing its URL.
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (caught) {
      if (!controller.signal.aborted) {
        setError(
          caught instanceof Error && !(caught instanceof TypeError)
            ? caught.message
            : "No pudimos descargar el Excel. Revisa tu conexión e inténtalo de nuevo.",
        );
      }
    } finally {
      if (!controller.signal.aborted) setExporting(false);
      requestRef.current = null;
    }
  }

  return (
    <div className={styles.exportControl}>
      <button
        type="button"
        className={`${styles.primaryButton} ${styles.exportButton}`}
        disabled={exporting}
        aria-busy={exporting}
        onClick={() => void downloadExcel()}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M12 3v12m-4-4 4 4 4-4M4 17v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
        </svg>
        <span aria-live="polite">
          {exporting ? "Generando Excel…" : "Descargar Excel"}
        </span>
      </button>
      {error && (
        <p className={styles.exportError} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
