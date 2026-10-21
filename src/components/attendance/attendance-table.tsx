"use client";

import {
  type CSSProperties,
  type FormEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { AttendanceGuest } from "@/modules/attendance/get-attendance-guests";
import Image from "next/image";
import styles from "./attendance.module.css";
import { useLiveAttendance } from "./use-live-attendance";
import AttendanceExportButton from "./attendance-export-button";
import AttendanceImport from "./attendance-import";
import {
  isValidTicketNumber,
  TICKET_NUMBER_FORMAT_MESSAGE,
} from "@/modules/attendance/ticket-number-format";

type View = "table" | "register" | "stats";
type Modal = { kind: "ticket" | "undo"; guest: AttendanceGuest } | null;
type ArrivalConfirmation = {
  doctorName: string;
  alreadyRegistered: boolean;
  returnTo: "table" | "register";
};
const WELCOME_RETURN_DELAY_MS = 5_000;
type IconName =
  | "search"
  | "list"
  | "person"
  | "chart"
  | "ticket"
  | "check"
  | "arrow"
  | "close"
  | "refresh"
  | "clock";

function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, ReactNode> = {
    search: (
      <>
        <circle cx="10.8" cy="10.8" r="6.8" />
        <path d="m16 16 4.5 4.5" />
      </>
    ),
    list: (
      <>
        <rect x="4" y="3" width="16" height="18" rx="3" />
        <path d="M8 8h8M8 12h8M8 16h5" />
      </>
    ),
    person: (
      <>
        <circle cx="10" cy="7" r="4" />
        <path d="M3 21v-2a7 7 0 0 1 14 0v2M20 8v6m-3-3h6" />
      </>
    ),
    chart: (
      <>
        <path d="M4 3v18h17M9 16v-5m5 5V6m5 10v-7" />
      </>
    ),
    ticket: (
      <>
        <path d="M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v3a2 2 0 0 0 0 4v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-3a2 2 0 0 0 0-4Z" />
        <path d="M15 5v3m0 3v2m0 3v3" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
    close: <path d="m6 6 12 12M18 6 6 18" />,
    refresh: (
      <>
        <path d="M20 7v5h-5M4 17v-5h5" />
        <path d="M6.1 7a7 7 0 0 1 11.6-2L20 8M4 16l2.3 3A7 7 0 0 0 18 17" />
      </>
    ),
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-MX")
    .trim();
}

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export default function AttendanceTable({
  initialGuests,
}: {
  initialGuests: AttendanceGuest[];
}) {
  const { guests, refreshing, syncStatus, refresh, rememberGuest } =
    useLiveAttendance(initialGuests);
  const [view, setView] = useState<View>("table");
  const [query, setQuery] = useState("");
  const [draftName, setDraftName] = useState("");
  const [saving, setSaving] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [modal, setModal] = useState<Modal>(null);
  const [ticketNumber, setTicketNumber] = useState("");
  const [modalError, setModalError] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [arrivalConfirmation, setArrivalConfirmation] =
    useState<ArrivalConfirmation | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const ticketInputRef = useRef<HTMLInputElement>(null);
  const doctorNameInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const confirmationHeadingRef = useRef<HTMLHeadingElement>(null);
  const isSearching = query.trim().length > 0;

  const officialGuests = useMemo(
    () => guests.filter((guest) => guest.isExtra !== true),
    [guests],
  );
  const extraGuests = useMemo(
    () => guests.filter((guest) => guest.isExtra === true),
    [guests],
  );
  const registeredCount = officialGuests.filter(
    (guest) => guest.checkedInAt,
  ).length;
  const ticketCount = officialGuests.filter((guest) => guest.hasTicket).length;
  const pendingCount = officialGuests.length - registeredCount;
  const extraRegisteredCount = extraGuests.filter(
    (guest) => guest.checkedInAt,
  ).length;
  const attendancePercent = officialGuests.length
    ? Math.round((registeredCount / officialGuests.length) * 100)
    : 0;
  const filteredGuests = useMemo(() => {
    const terms = normalize(query).split(/\s+/).filter(Boolean);
    if (!terms.length) return [];
    return officialGuests
      .filter((guest) => {
        const text = normalize(
          `${guest.doctorName} ${guest.ticketNumber ?? ""}`,
        );
        return terms.every((term) => text.includes(term));
      })
      .sort((a, b) => a.doctorName.localeCompare(b.doctorName, "es"));
  }, [officialGuests, query]);

  async function refreshGuests(silent = false) {
    try {
      await refresh();
    } catch (caught) {
      if (!silent)
        setError(
          caught instanceof Error
            ? caught.message
            : "No pudimos actualizar la lista.",
        );
    }
  }

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (modal && !dialog.open) {
      dialog.showModal();
      if (modal.kind === "ticket") ticketInputRef.current?.focus();
    } else if (!modal && dialog.open) {
      dialog.close();
    }
    if (!modal) return;
    const viewport = window.visualViewport;
    const fitDialog = () => {
      dialog.style.setProperty(
        "--dialog-viewport-height",
        `${viewport?.height ?? window.innerHeight}px`,
      );
      dialog.style.setProperty(
        "--dialog-viewport-top",
        `${viewport?.offsetTop ?? 0}px`,
      );
    };
    fitDialog();
    viewport?.addEventListener("resize", fitDialog);
    viewport?.addEventListener("scroll", fitDialog);
    window.addEventListener("resize", fitDialog);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
      viewport?.removeEventListener("resize", fitDialog);
      viewport?.removeEventListener("scroll", fitDialog);
      window.removeEventListener("resize", fitDialog);
      dialog.style.removeProperty("--dialog-viewport-height");
      dialog.style.removeProperty("--dialog-viewport-top");
    };
  }, [modal]);

  useEffect(() => {
    if (!arrivalConfirmation) return;
    const timer = window.setTimeout(() => {
      setArrivalConfirmation(null);
      setQuery("");
      setNotice("");
      setView(arrivalConfirmation.returnTo);
    }, WELCOME_RETURN_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [arrivalConfirmation]);

  useEffect(() => {
    if (modal) return;
    if (view === "register" && !arrivalConfirmation) {
      doctorNameInputRef.current?.focus({ preventScroll: true });
      return;
    }
    if (view !== "table") return;
    if (arrivalConfirmation)
      confirmationHeadingRef.current?.focus({ preventScroll: true });
    else searchInputRef.current?.focus({ preventScroll: true });
  }, [view, arrivalConfirmation, modal]);

  function navigate(next: View) {
    setView(next);
    setArrivalConfirmation(null);
    if (next === "table") setQuery("");
    setError("");
    setNotice("");
  }

  function openReception() {
    setDraftName(query.trim());
    navigate("register");
  }

  async function updateAttendance(
    guest: AttendanceGuest,
    action: "check-in" | "check-in-no-ticket" | "undo",
    number?: string,
  ) {
    setError("");
    setModalError("");
    setNotice("");
    setPendingId(guest.id);
    try {
      const response = await fetch("/api/admin/attendance", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: guest.id,
          action,
          ...(action === "check-in" && number ? { ticketNumber: number } : {}),
          ...(action === "undo"
            ? { expectedCheckedInAt: guest.checkedInAt }
            : {}),
        }),
      });
      const result = (await response.json()) as {
        error?: string;
        alreadyRegistered?: boolean;
      };
      if (!response.ok)
        throw new Error(
          result.error ??
            "No pudimos guardar la asistencia. Inténtalo nuevamente.",
        );
      void refreshGuests(true);
      if (action !== "undo") {
        setArrivalConfirmation({
          doctorName: guest.doctorName,
          alreadyRegistered: result.alreadyRegistered === true,
          returnTo: "table",
        });
        setQuery("");
        setView("table");
      } else {
        setNotice(
          `Se canceló el registro de asistencia de ${guest.doctorName}.`,
        );
      }
      return true;
    } catch (caught) {
      const message =
        caught instanceof Error
          ? caught.message
          : "No pudimos guardar el registro.";
      if (modal) setModalError(message);
      else setError(message);
      return false;
    } finally {
      setPendingId(null);
    }
  }

  function registerArrival(guest: AttendanceGuest) {
    setError("");
    setNotice("");
    setModalError("");
    if (guest.hasTicket) {
      setTicketNumber(guest.ticketNumber ?? "");
      setModal({ kind: "ticket", guest });
    } else {
      void updateAttendance(guest, "check-in");
    }
  }

  async function addGuest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setError("");
    setNotice("");
    setSaving(true);
    const payload = {
      doctorName: String(data.get("doctorName") ?? "").trim(),
    };
    try {
      const response = await fetch("/api/admin/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as { id?: string; error?: string };
      if (!response.ok || !result.id)
        throw new Error(
          result.error ??
            "No pudimos agregar al médico. Revisa los datos e inténtalo nuevamente.",
        );
      const guest: AttendanceGuest = {
        ...payload,
        id: result.id,
        isExtra: true,
        hasTicket: false,
        ticketNumber: null,
        checkedInAt: new Date().toISOString(),
      };
      rememberGuest(guest);
      void refreshGuests(true);
      form.reset();
      setDraftName("");
      setQuery("");
      setView("register");
      setArrivalConfirmation({
        doctorName: guest.doctorName,
        alreadyRegistered: false,
        returnTo: "register",
      });
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "No pudimos agregar al médico.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function confirmModal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!modal) return;
    const number = ticketNumber;
    if (modal.kind === "ticket" && !isValidTicketNumber(number)) {
      setModalError(TICKET_NUMBER_FORMAT_MESSAGE);
      return;
    }
    const saved = await updateAttendance(
      modal.guest,
      modal.kind === "ticket" ? "check-in" : "undo",
      modal.kind === "ticket" ? number : undefined,
    );
    if (saved) setModal(null);
  }

  async function confirmWithoutTicket() {
    if (!modal || modal.kind !== "ticket") return;
    const saved = await updateAttendance(modal.guest, "check-in-no-ticket");
    if (saved) setModal(null);
  }

  const modalBusy = modal ? pendingId === modal.guest.id : false;

  return (
    <div className={styles.app}>
      <header className={styles.navbar}>
        <div className={styles.navbarInner}>
          <div className={styles.brand}>
            <Image
              className={styles.brandLogo}
              src="/hospital-angeles-queretaro-matched.png"
              alt="Hospital Ángeles Querétaro"
              width={415}
              height={238}
              preload
            />
            <div>
              <p className={styles.brandHospital}>
                Hospital Ángeles Health System
              </p>
              <h1>
                Lista de invitados desayuno evento{" "}
                <strong>Día del Médico</strong>
              </h1>
            </div>
            <Image
              className={styles.brandSecondaryLogo}
              src="/hospital-angeles-centro-sur-matched.png"
              alt="Hospital Ángeles Centro Sur"
              width={415}
              height={238}
              preload
            />
          </div>
          <nav className={styles.menu} aria-label="Navegación principal">
            {(
              [
                ["table", "list", "Menú principal"],
                ["register", "person", "Registro doctor"],
                ["stats", "chart", "Estadísticas"],
              ] as const
            ).map(([destination, icon, label]) => (
              <button
                key={destination}
                type="button"
                className={view === destination ? styles.menuActive : ""}
                aria-current={view === destination ? "page" : undefined}
                onClick={() => navigate(destination)}
              >
                <Icon name={icon} size={18} />
                <span>{label}</span>
              </button>
            ))}
          </nav>
        </div>
      </header>

      <div className={styles.content}>
        <div
          className={styles.syncStatus}
          data-state={syncStatus}
          role="status"
        >
          <i aria-hidden="true" />
          <span>
            {syncStatus === "live"
              ? "Conectado · Actualización en tiempo real"
              : syncStatus === "offline"
                ? "Sin conexión. Conecta este equipo a internet."
                : syncStatus === "connecting"
                  ? "Conectando la lista en tiempo real…"
                  : "Reconectando… Los datos pueden estar desactualizados."}
          </span>
        </div>
        <section
          className={styles.eventProgress}
          aria-label="Progreso del evento"
        >
          <span className={styles.eventProgressIcon} aria-hidden="true">
            <Icon name="chart" size={24} />
          </span>
          <div className={styles.eventProgressSummary}>
            <p>Avance de la lista oficial</p>
            <div aria-live="polite" aria-atomic="true">
              <strong>
                {registeredCount} de {officialGuests.length} médicos registrados
              </strong>
              <span>{pendingCount} pendientes</span>
            </div>
          </div>
          <div className={styles.eventProgressBar}>
            <span>{attendancePercent}% de asistencia</span>
            <progress
              value={registeredCount}
              max={Math.max(officialGuests.length, 1)}
              aria-label="Asistencia confirmada"
            />
          </div>
        </section>
        {error && (
          <div className={`${styles.message} ${styles.error}`} role="alert">
            <span>{error}</span>
            <button
              type="button"
              aria-label="Cerrar aviso"
              onClick={() => setError("")}
            >
              <Icon name="close" size={18} />
            </button>
          </div>
        )}
        {notice && (
          <div className={`${styles.message} ${styles.success}`} role="status">
            <Icon name="check" />
            <span>{notice}</span>
            <button
              type="button"
              aria-label="Cerrar aviso"
              onClick={() => setNotice("")}
            >
              <Icon name="close" size={18} />
            </button>
          </div>
        )}

        {(view === "table" || view === "register") && arrivalConfirmation && (
          <section
            className={styles.confirmationPanel}
            aria-labelledby="arrival-confirmed-title"
          >
            <div className={styles.confirmationContent} role="status">
              <span className={styles.confirmationIcon} aria-hidden="true">
                <Icon name="check" size={48} />
              </span>
              <p className={styles.eyebrow}>Asistencia registrada</p>
              <h2
                id="arrival-confirmed-title"
                ref={confirmationHeadingRef}
                tabIndex={-1}
              >
                {arrivalConfirmation.alreadyRegistered
                  ? "Tu asistencia ya está registrada"
                  : "¡Registro confirmado!"}
              </h2>
              <p className={styles.confirmationName}>
                {arrivalConfirmation.doctorName}
              </p>
              <p className={styles.confirmationDescription}>
                {arrivalConfirmation.alreadyRegistered
                  ? "Tu registro original está confirmado. ¡Disfruta del evento!"
                  : "Tu llegada se guardó correctamente. ¡Disfruta del desayuno y feliz Día del Médico!"}
              </p>
            </div>
            <div className={styles.confirmationReturn}>
              <p>
                {arrivalConfirmation.returnTo === "register"
                  ? "Volveremos al registro en 5 segundos para continuar con el siguiente médico."
                  : "Volveremos a la bienvenida en 5 segundos para recibir al siguiente médico."}
              </p>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={() => navigate(arrivalConfirmation.returnTo)}
              >
                {arrivalConfirmation.returnTo === "register"
                  ? "Volver al registro"
                  : "Volver a la bienvenida"}{" "}
                <Icon name="arrow" size={18} />
              </button>
            </div>
            <div className={styles.returnProgress} aria-hidden="true" />
          </section>
        )}

        {view === "table" && !arrivalConfirmation && (
          <section
            className={`${styles.listPanel} ${!isSearching ? styles.welcomePanel : ""}`}
            aria-labelledby="guest-list-title"
          >
            <div className={styles.listHeading}>
              <div>
                {!isSearching && (
                  <p className={styles.welcomeEyebrow}>
                    Hospital Ángeles Health System
                  </p>
                )}
                <h2 id="guest-list-title">
                  {isSearching
                    ? "Encuentra tu nombre"
                    : "¡Bienvenido al Día del Médico!"}
                </h2>
                <p>
                  {isSearching ? (
                    "Selecciona Registrar llegada junto a tu nombre y confirma tu boleto."
                  ) : (
                    <>
                      <span className={styles.welcomeMessageCompact}>
                        Busca tu nombre y registra tu llegada.
                      </span>
                      <span className={styles.welcomeMessageWide}>
                        Nos alegra recibirte. Busca tu nombre para registrar tu
                        llegada y disfrutar del desayuno.
                      </span>
                    </>
                  )}
                </p>
              </div>
              {isSearching && (
                <div className={styles.headingActions}>
                  <span className={styles.invitedCount}>
                    {filteredGuests.length}{" "}
                    {filteredGuests.length === 1
                      ? "coincidencia"
                      : "coincidencias"}
                  </span>
                  <button
                    type="button"
                    className={styles.iconButton}
                    aria-label="Actualizar lista de invitados"
                    title="Actualizar lista"
                    disabled={refreshing}
                    onClick={() => void refreshGuests()}
                  >
                    <Icon name="refresh" />
                  </button>
                </div>
              )}
            </div>
            <div className={styles.searchArea}>
              <label className={styles.searchBox} htmlFor="guest-search">
                <Icon name="search" size={24} />
                <input
                  ref={searchInputRef}
                  id="guest-search"
                  type="search"
                  aria-label="Buscar médico por nombre, apellidos o boleto"
                  placeholder="Tu nombre o apellidos…"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  autoComplete="off"
                />
              </label>
              <div className={styles.listTools}>
                <button
                  type="button"
                  className={styles.textButton}
                  onClick={openReception}
                >
                  ¿No estás en la lista? <Icon name="arrow" size={16} />
                </button>
              </div>
            </div>
            {!isSearching && (
              <ol
                className={styles.welcomeSteps}
                aria-label="Cómo registrar tu llegada"
              >
                <li>
                  <span>
                    <Icon name="search" size={22} />
                  </span>
                  <div>
                    <strong>Busca tu nombre</strong>
                    <p>Escribe tu nombre o apellidos</p>
                  </div>
                </li>
                <li>
                  <span>
                    <Icon name="ticket" size={22} />
                  </span>
                  <div>
                    <strong>Confirma tu llegada</strong>
                    <p>Ten a la mano tu boleto</p>
                  </div>
                </li>
                <li>
                  <span>
                    <Icon name="check" size={22} />
                  </span>
                  <div>
                    <strong>¡Disfruta el evento!</strong>
                    <p>Tu asistencia quedará registrada</p>
                  </div>
                </li>
              </ol>
            )}
            {isSearching && (
              <>
                <div className={styles.tableScroll}>
                  <table className={styles.table} role="table">
                    <caption className={styles.srOnly}>
                      Lista de médicos invitados y estado de asistencia
                    </caption>
                    <thead>
                      <tr>
                        <th scope="col">Nombre del médico</th>
                        <th scope="col">Boleto</th>
                        <th scope="col">No. de boleto</th>
                        <th scope="col">Estado</th>
                        <th scope="col">Registro de asistencia</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredGuests.map((guest) => (
                        <tr
                          key={guest.id}
                          className={
                            guest.checkedInAt
                              ? styles.registeredRow
                              : styles.pendingRow
                          }
                        >
                          <td data-label="Médico">
                            <div className={styles.doctorCell}>
                              <span className={styles.avatar}>
                                {initials(guest.doctorName)}
                              </span>
                              <span className={styles.doctorName}>
                                {guest.doctorName}
                              </span>
                            </div>
                          </td>
                          <td data-label="Boleto">
                            <span
                              className={
                                guest.hasTicket
                                  ? styles.ticketBadge
                                  : styles.mutedBadge
                              }
                            >
                              {guest.hasTicket && (
                                <Icon name="ticket" size={14} />
                              )}
                              {guest.hasTicket ? "Con boleto" : "Sin boleto"}
                            </span>
                          </td>
                          <td data-label="No. de boleto">
                            <span className={styles.ticketNumber}>
                              {guest.hasTicket && guest.ticketNumber
                                ? guest.ticketNumber
                                : "—"}
                            </span>
                          </td>
                          <td data-label="Estado">
                            <span
                              className={`${styles.statusBadge} ${
                                guest.checkedInAt
                                  ? styles.registeredStatus
                                  : styles.pendingStatus
                              }`}
                            >
                              <Icon
                                name={guest.checkedInAt ? "check" : "clock"}
                                size={17}
                              />
                              {guest.checkedInAt ? "Registrado" : "Pendiente"}
                            </span>
                          </td>
                          <td data-label="Registro">
                            {guest.checkedInAt ? (
                              <div className={styles.registeredActions}>
                                <button
                                  type="button"
                                  className={styles.undoButton}
                                  disabled={pendingId !== null}
                                  onClick={() => {
                                    setModalError("");
                                    setModal({ kind: "undo", guest });
                                  }}
                                >
                                  Deshacer registro
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                className={styles.arrivalButton}
                                disabled={pendingId !== null}
                                onClick={() => registerArrival(guest)}
                              >
                                {pendingId === guest.id
                                  ? "Registrando…"
                                  : "Registrar llegada"}
                                <Icon name="arrow" size={16} />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                      {filteredGuests.length === 0 && (
                        <tr>
                          <td colSpan={6} className={styles.emptyCell}>
                            <div className={styles.emptyState}>
                              <span className={styles.emptyIcon}>
                                <Icon name="search" size={30} />
                              </span>
                              <h3>
                                {query.trim()
                                  ? "No encontramos coincidencias"
                                  : "La lista está lista para recibir invitados"}
                              </h3>
                              <p>
                                {query.trim()
                                  ? "Prueba con tus apellidos o revisa la escritura. Si no apareces, una recepcionista puede agregarte."
                                  : "Las recepcionistas pueden agregar a los médicos desde Registro doctor."}
                              </p>
                              <button
                                type="button"
                                className={styles.secondaryButton}
                                onClick={openReception}
                              >
                                <Icon name="person" size={18} />
                                Ir a Registro doctor
                              </button>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <footer className={styles.tableFooter}>
                  <span aria-live="polite">
                    {query.trim()
                      ? `${filteredGuests.length} de ${officialGuests.length} invitados`
                      : `${officialGuests.length} invitados · ${registeredCount} registrados · ${pendingCount} pendientes`}
                  </span>
                  <span>
                    <i />
                    {syncStatus === "live"
                      ? "Lista sincronizada en tiempo real"
                      : "Esperando sincronización"}
                  </span>
                </footer>
              </>
            )}
          </section>
        )}

        {view === "register" && !arrivalConfirmation && (
          <section
            className={styles.registrationLayout}
            aria-labelledby="registration-title"
          >
            <aside className={styles.receptionInfo}>
              <span className={styles.sectionIcon}>
                <Icon name="person" size={27} />
              </span>
              <p className={styles.eyebrow}>Módulo de recepción</p>
              <h2 id="registration-title">Un lugar para cada médico.</h2>
              <p>
                Si el médico no aparece en la lista, agrega sus datos aquí y
                continúa con el registro de su llegada.
              </p>
              <ol className={styles.receptionSteps}>
                <li>
                  <span>1</span>
                  <div>
                    <strong>Captura sus datos</strong>
                    <p>Nombre completo del médico.</p>
                  </div>
                </li>
                <li>
                  <span>2</span>
                  <div>
                    <strong>Registra su llegada</strong>
                    <p>Guarda sus datos y confirma su asistencia.</p>
                  </div>
                </li>
              </ol>
              <button
                type="button"
                className={styles.backLink}
                onClick={() => navigate("table")}
              >
                ← Volver a la bienvenida
              </button>
            </aside>
            <form className={styles.registrationForm} onSubmit={addGuest}>
              <div className={styles.formHeading}>
                <h3>Registro doctor</h3>
                <p>
                  Los campos con <span aria-hidden="true">*</span> son
                  obligatorios.
                </p>
              </div>
              <fieldset disabled={saving}>
                <legend className={styles.srOnly}>Datos del médico</legend>
                <label className={styles.field} htmlFor="doctor-name">
                  Nombre completo del médico <span>*</span>
                  <input
                    ref={doctorNameInputRef}
                    id="doctor-name"
                    name="doctorName"
                    placeholder="Ej. María López Hernández"
                    autoComplete="name"
                    minLength={2}
                    maxLength={120}
                    required
                    value={draftName}
                    onChange={(event) => setDraftName(event.target.value)}
                  />
                </label>
              </fieldset>
              <div className={styles.formActions}>
                <button
                  type="submit"
                  name="action"
                  value="check-in"
                  className={styles.primaryButton}
                  disabled={saving}
                >
                  {saving ? "Guardando médico…" : "Agregar y registrar llegada"}
                  <Icon name="arrow" size={18} />
                </button>
              </div>
            </form>
          </section>
        )}

        {view === "stats" && (
          <section aria-labelledby="stats-title" className={styles.statsPage}>
            <div className={styles.pageHeading}>
              <div>
                <p className={styles.eyebrow}>El evento en números</p>
                <h2 id="stats-title">Estadísticas de asistencia</h2>
                <p>Consulta el avance del registro de los médicos invitados.</p>
              </div>
              <div className={styles.statsActions}>
                <AttendanceExportButton />
                <button
                  type="button"
                  className={styles.secondaryButton}
                  aria-label={
                    refreshing
                      ? "Actualizando estadísticas"
                      : "Actualizar estadísticas"
                  }
                  disabled={refreshing}
                  onClick={() => void refreshGuests()}
                >
                  <Icon name="refresh" size={17} />
                  {refreshing ? "Actualizando…" : "Actualizar"}
                </button>
              </div>
            </div>
            <div className={styles.metricGrid}>
              {(
                [
                  ["list", "Lista oficial", officialGuests.length],
                  ["check", "Asistencias confirmadas", registeredCount],
                  ["person", "Pendientes de llegada", pendingCount],
                  ["ticket", "Invitados con boleto", ticketCount],
                ] as const
              ).map(([icon, label, value]) => (
                <article className={styles.metric} key={label}>
                  <span className={styles.metricIcon}>
                    <Icon name={icon} />
                  </span>
                  <p>{label}</p>
                  <strong>{value}</strong>
                </article>
              ))}
            </div>
            <div className={styles.statsGrid}>
              <article className={styles.statsCard}>
                <h3>Avance de asistencia</h3>
                <p>De todos los médicos en la lista</p>
                <div
                  className={styles.donut}
                  style={
                    { "--progress": `${attendancePercent}%` } as CSSProperties
                  }
                  role="img"
                  aria-label={`${attendancePercent}% de asistencia confirmada`}
                >
                  <div>
                    <strong>
                      {attendancePercent}
                      <small>%</small>
                    </strong>
                    <span>de asistencia</span>
                  </div>
                </div>
                <div className={styles.chartLegend}>
                  <span>
                    <i />
                    Confirmados <strong>{registeredCount}</strong>
                  </span>
                  <span>
                    <i />
                    Pendientes <strong>{pendingCount}</strong>
                  </span>
                </div>
              </article>
            </div>
            <section
              className={styles.extrasReport}
              aria-labelledby="extras-report-title"
            >
              <div className={styles.extrasHeader}>
                <div>
                  <p className={styles.eyebrow}>Registros de recepción</p>
                  <h3 id="extras-report-title">EXTRAS</h3>
                  <p>Doctores agregados fuera de la lista oficial.</p>
                </div>
                <span className={styles.extrasTotal}>
                  {extraGuests.length} en total
                </span>
              </div>
              <div className={styles.extrasMetrics}>
                <div>
                  <span>Total</span>
                  <strong>{extraGuests.length}</strong>
                </div>
                <div>
                  <span>Asistieron</span>
                  <strong>{extraRegisteredCount}</strong>
                </div>
                <div>
                  <span>Pendientes</span>
                  <strong>{extraGuests.length - extraRegisteredCount}</strong>
                </div>
              </div>
              {extraGuests.length ? (
                <ul className={styles.extrasList}>
                  {[...extraGuests]
                    .sort((a, b) =>
                      a.doctorName.localeCompare(b.doctorName, "es"),
                    )
                    .map((guest) => (
                      <li className={styles.extraGuestRow} key={guest.id}>
                        <div>
                          <strong>{guest.doctorName}</strong>
                        </div>
                        <span
                          className={`${styles.statusBadge} ${
                            guest.checkedInAt
                              ? styles.registeredStatus
                              : styles.pendingStatus
                          }`}
                        >
                          {guest.checkedInAt ? "Asistió" : "Pendiente"}
                        </span>
                      </li>
                    ))}
                </ul>
              ) : (
                <p className={styles.extrasEmpty}>
                  Aún no hay registros en este apartado.
                </p>
              )}
            </section>
            <AttendanceImport onImported={() => void refreshGuests(true)} />
          </section>
        )}
        <footer className={styles.appFooter}>
          <span>Hospital Ángeles Health System</span>
          <span>Desayuno · Día del Médico</span>
        </footer>
      </div>

      <dialog
        ref={dialogRef}
        className={styles.dialog}
        aria-labelledby="attendance-dialog-title"
        aria-describedby="attendance-dialog-description"
        onCancel={(event) => {
          if (modalBusy) event.preventDefault();
          else setModal(null);
        }}
        onClose={() => setModal(null)}
      >
        {modal && (
          <form onSubmit={confirmModal}>
            <div className={styles.dialogTop}>
              <span className={styles.dialogIcon}>
                <Icon
                  name={modal.kind === "ticket" ? "ticket" : "refresh"}
                  size={28}
                />
              </span>
              <button
                type="button"
                className={styles.iconButton}
                aria-label="Cerrar ventana"
                disabled={modalBusy}
                onClick={() => setModal(null)}
              >
                <Icon name="close" />
              </button>
            </div>
            <p className={styles.eyebrow}>
              {modal.kind === "ticket"
                ? "Un último paso"
                : "Corregir asistencia"}
            </p>
            <h2 id="attendance-dialog-title">
              {modal.kind === "ticket"
                ? "Confirma tu boleto"
                : "¿Deshacer este registro?"}
            </h2>
            <p
              id="attendance-dialog-description"
              className={styles.dialogDescription}
            >
              {modal.kind === "ticket"
                ? "Escribe el número del boleto que recibiste en la entrada para confirmar tu llegada."
                : "El médico volverá a aparecer como pendiente de llegada. Podrás registrar su asistencia nuevamente."}
            </p>
            <div className={styles.dialogGuest}>
              <span className={styles.avatar}>
                {initials(modal.guest.doctorName)}
              </span>
              <div>
                <strong>{modal.guest.doctorName}</strong>
              </div>
            </div>
            {modal.kind === "ticket" && (
              <label className={styles.field} htmlFor="arrival-ticket">
                Número de boleto <span>*</span>
                <input
                  ref={ticketInputRef}
                  id="arrival-ticket"
                  className={styles.largeTicketInput}
                  placeholder="Ej. 248"
                  value={ticketNumber}
                  onChange={(event) => {
                    setTicketNumber(event.target.value);
                    setModalError("");
                  }}
                  inputMode="numeric"
                  maxLength={4}
                  required
                  autoComplete="off"
                  disabled={modalBusy}
                />
                <small>Formato de 3 dígitos: del 001 al 999.</small>
              </label>
            )}
            {modalError && (
              <p className={styles.modalError} role="alert">
                {modalError}
              </p>
            )}
            <button
              className={styles.primaryButton}
              type="submit"
              disabled={modalBusy}
            >
              {modalBusy
                ? "Guardando…"
                : modal.kind === "ticket"
                  ? "Confirmar mi llegada"
                  : "Sí, deshacer registro"}
              <Icon
                name={modal.kind === "ticket" ? "check" : "refresh"}
                size={19}
              />
            </button>
            {modal.kind === "ticket" && (
              <button
                type="button"
                className={styles.noTicketButton}
                disabled={modalBusy}
                onClick={() => void confirmWithoutTicket()}
              >
                No traigo boleto
              </button>
            )}
            <button
              type="button"
              className={styles.dialogCancel}
              disabled={modalBusy}
              onClick={() => setModal(null)}
            >
              Cancelar y volver a la lista
            </button>
          </form>
        )}
      </dialog>
    </div>
  );
}
