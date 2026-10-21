"use client";

import { type FormEvent, useEffect, useRef, useState } from "react";
import {
  MAX_IMPORT_FILE_BYTES,
  MAX_IMPORT_ROWS,
  type AttendanceImportIssue,
  type AttendanceImportResult,
} from "@/modules/attendance/import-contract";
import styles from "./attendance.module.css";

export default function AttendanceImport({
  onImported,
}: {
  onImported: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");
  const [issues, setIssues] = useState<AttendanceImportIssue[]>([]);
  const [errorCount, setErrorCount] = useState(0);
  const [success, setSuccess] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const importRequest = useRef<AbortController | null>(null);
  const templateRequest = useRef<AbortController | null>(null);
  useEffect(
    () => () => {
      importRequest.current?.abort();
      templateRequest.current?.abort();
    },
    [],
  );

  function clearMessages() {
    setError("");
    setIssues([]);
    setErrorCount(0);
    setSuccess("");
  }

  async function downloadTemplate() {
    if (templateRequest.current) return;
    const controller = new AbortController();
    templateRequest.current = controller;
    setDownloading(true);
    clearMessages();
    try {
      const response = await fetch("/api/admin/attendance/template", {
        cache: "no-store",
        signal: controller.signal,
      });
      if (!response.ok)
        throw new Error(
          "No pudimos descargar la plantilla. Inténtalo nuevamente.",
        );
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = "plantilla-registro-medicos.xlsx";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      if (!controller.signal.aborted)
        setError(
          "No pudimos descargar la plantilla. Revisa tu conexión e inténtalo de nuevo.",
        );
    } finally {
      if (!controller.signal.aborted) setDownloading(false);
      templateRequest.current = null;
    }
  }

  async function importDoctors(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file || importRequest.current) return;
    clearMessages();
    if (!/\.xlsx$/i.test(file.name) || !file.size) {
      setError("Selecciona un archivo Excel .xlsx con datos de médicos.");
      return;
    }
    if (file.size > MAX_IMPORT_FILE_BYTES) {
      setError("El archivo debe pesar como máximo 2 MB.");
      return;
    }
    const controller = new AbortController();
    importRequest.current = controller;
    setImporting(true);
    try {
      const data = new FormData();
      data.append("file", file);
      const response = await fetch("/api/admin/attendance/import", {
        method: "POST",
        body: data,
        signal: controller.signal,
      });
      const result = (await response.json().catch(() => null)) as
        | (Partial<AttendanceImportResult> & {
            error?: string;
            issues?: AttendanceImportIssue[];
            errorCount?: number;
          })
        | null;
      if (!result)
        throw new Error(
          "No pudimos confirmar la importación. Intenta subir el mismo archivo nuevamente.",
        );
      if (!response.ok) {
        setIssues(result.issues ?? []);
        setErrorCount(result.errorCount ?? 0);
        throw new Error(
          result.error ??
            "No pudimos importar el archivo. Inténtalo nuevamente.",
        );
      }
      if (
        typeof result.imported !== "number" ||
        typeof result.skipped !== "number"
      ) {
        throw new Error(
          "No pudimos confirmar la importación. Intenta subir el mismo archivo nuevamente.",
        );
      }
      const addedMessage =
        result.imported === 1
          ? "Se agregó 1 médico pendiente de llegada."
          : `Se agregaron ${result.imported} médicos pendientes de llegada.`;
      const keptMessage =
        result.skipped === 1
          ? "Se conservó 1 médico que ya estaba en la lista."
          : `Se conservaron ${result.skipped} médicos que ya estaban en la lista.`;
      setSuccess(
        result.imported
          ? `${addedMessage}${result.skipped ? ` ${keptMessage}` : ""}`
          : result.skipped === 1
            ? "El médico ya estaba en la lista. Se conservaron sus datos y asistencia."
            : `Los ${result.skipped} médicos ya estaban en la lista. Se conservaron sus datos y asistencias.`,
      );
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
      onImported();
    } catch (caught) {
      if (!controller.signal.aborted) {
        setError(
          caught instanceof Error && !(caught instanceof TypeError)
            ? caught.message
            : "No pudimos subir el archivo. Revisa tu conexión e inténtalo nuevamente.",
        );
      }
    } finally {
      if (!controller.signal.aborted) setImporting(false);
      importRequest.current = null;
    }
  }

  return (
    <section
      className={styles.importCard}
      aria-labelledby="import-doctors-title"
    >
      <div className={styles.importHeading}>
        <div>
          <p className={styles.eyebrow}>Registro de médicos por Excel</p>
          <h3 id="import-doctors-title">Agrega tu lista de invitados</h3>
          <p>
            Descarga la plantilla, complétala y súbela aquí. Los médicos
            quedarán pendientes de llegada.
          </p>
        </div>
        <button
          type="button"
          className={styles.secondaryButton}
          disabled={downloading || importing}
          aria-busy={downloading}
          onClick={() => void downloadTemplate()}
        >
          <svg
            width="19"
            height="19"
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
          {downloading ? "Descargando…" : "Descargar plantilla"}
        </button>
      </div>
      <ul
        className={styles.importColumns}
        aria-label="Columnas de la plantilla"
      >
        <li>
          <span>1</span>
          <div>
            <strong>Nombre del médico</strong>
            <small>Nombre completo</small>
          </div>
        </li>
        <li>
          <span>2</span>
          <div>
            <strong>Boleto</strong>
            <small>SI o NO</small>
          </div>
        </li>
      </ul>
      <form
        className={styles.importForm}
        onSubmit={(event) => void importDoctors(event)}
      >
        <label className={styles.importFile} htmlFor="doctor-import-file">
          <strong>Selecciona tu plantilla completa</strong>
          <input
            ref={fileRef}
            id="doctor-import-file"
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            disabled={importing}
            required
            aria-describedby="doctor-import-help"
            onChange={(event) => {
              setFile(event.target.files?.[0] ?? null);
              clearMessages();
            }}
          />
          <small id="doctor-import-help">
            Excel .xlsx · Hasta {MAX_IMPORT_ROWS} médicos · Máximo 2 MB
          </small>
        </label>
        <button
          type="submit"
          className={styles.primaryButton}
          disabled={!file || importing || downloading}
          aria-busy={importing}
        >
          {importing ? "Importando médicos…" : "Importar médicos"}
        </button>
      </form>
      <p className={styles.importNote}>
        El número de boleto se confirma al llegar al evento. Si el médico ya
        está en la lista, se conservan sus datos.
      </p>
      {success && (
        <p
          className={`${styles.importFeedback} ${styles.importSuccess}`}
          role="status"
        >
          {success}
        </p>
      )}
      {error && (
        <div
          className={`${styles.importFeedback} ${styles.importError}`}
          role="alert"
        >
          <p>{error}</p>
          {issues.length > 0 && (
            <ul>
              {issues.map((issue, index) => (
                <li key={`${issue.row}-${index}`}>
                  <strong>Fila {issue.row}:</strong> {issue.message}
                </li>
              ))}
            </ul>
          )}
          {errorCount > issues.length && (
            <p>
              Se muestran los primeros {issues.length} de {errorCount} errores.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
