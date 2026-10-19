"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { AttendanceGuest } from "@/modules/attendance/get-attendance-guests";

type Props = { initialGuests: AttendanceGuest[] };

const dateFormatter = new Intl.DateTimeFormat("es-MX", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "America/Mexico_City",
});

const inputClass =
  "mt-1 block min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 shadow-sm outline-none focus:border-sky-700 focus:ring-2 focus:ring-sky-700/20";

export default function AttendanceTable({ initialGuests }: Props) {
  const router = useRouter();
  const [guests, setGuests] = useState(initialGuests);
  const [hasTicket, setHasTicket] = useState(false);
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => setGuests(initialGuests), [initialGuests]);

  const checkedInCount = guests.filter((guest) => guest.checkedInAt).length;
  const filteredGuests = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("es-MX");
    if (!normalizedQuery) return guests;
    return guests.filter((guest) =>
      [guest.doctorName, guest.hospital, guest.ticketNumber ?? ""]
        .join(" ")
        .toLocaleLowerCase("es-MX")
        .includes(normalizedQuery),
    );
  }, [guests, query]);

  async function addGuest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    setSaving(true);

    const form = event.currentTarget;
    const formData = new FormData(form);
    const payload = {
      doctorName: formData.get("doctorName"),
      hospital: formData.get("hospital"),
      hasTicket,
      ticketNumber: hasTicket ? formData.get("ticketNumber") : "",
    };

    try {
      const response = await fetch("/api/admin/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "No fue posible guardar.");

      form.reset();
      setHasTicket(false);
      setNotice("Invitado agregado a la lista.");
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "No fue posible agregar al invitado.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function updateAttendance(guest: AttendanceGuest) {
    const action = guest.checkedInAt ? "undo" : "check-in";
    setError("");
    setNotice("");
    setPendingId(guest.id);

    try {
      const response = await fetch("/api/admin/attendance", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: guest.id, action }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "No fue posible actualizar.");

      setNotice(
        action === "check-in" ? "Asistencia registrada." : "Registro deshecho.",
      );
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "No fue posible actualizar el registro.",
      );
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <section className="mb-6 grid gap-4 sm:grid-cols-3" aria-label="Resumen">
        <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-600">Invitados en la lista</p>
          <p className="mt-1 text-3xl font-semibold text-slate-900">{guests.length}</p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-600">Asistencias registradas</p>
          <p className="mt-1 text-3xl font-semibold text-sky-800">{checkedInCount}</p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-600">Pendientes de registro</p>
          <p className="mt-1 text-3xl font-semibold text-slate-900">
            {guests.length - checkedInCount}
          </p>
        </article>
      </section>

      <section className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-lg font-semibold text-slate-900">Agregar invitado</h2>
        <p className="mt-1 text-sm text-slate-600">
          Captura los datos del médico. El número de boleto solo se solicita si tiene boleto.
        </p>
        <form className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4" onSubmit={addGuest}>
          <label className="text-sm font-medium text-slate-700">
            Nombre del médico
            <input
              className={inputClass}
              name="doctorName"
              autoComplete="name"
              maxLength={120}
              required
            />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Hospital
            <input
              className={inputClass}
              name="hospital"
              maxLength={120}
              required
            />
          </label>
          <div>
            <span className="text-sm font-medium text-slate-700">Boleto</span>
            <label className="mt-1 flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-slate-300 px-3 text-sm text-slate-800">
              <input
                className="size-4 accent-sky-800"
                type="checkbox"
                checked={hasTicket}
                onChange={(event) => setHasTicket(event.target.checked)}
              />
              Sí, tiene boleto
            </label>
          </div>
          {hasTicket ? (
            <label className="text-sm font-medium text-slate-700">
              No. de boleto
              <input
                className={inputClass}
                name="ticketNumber"
                maxLength={40}
                required
              />
            </label>
          ) : (
            <div className="flex items-end">
              <p className="pb-3 text-sm text-slate-500">
                Sin boleto: el número se guarda vacío.
              </p>
            </div>
          )}
          <div className="md:col-span-2 xl:col-span-4">
            {error && <p className="mb-3 text-sm text-red-700" role="alert">{error}</p>}
            {notice && <p className="mb-3 text-sm text-emerald-700" role="status">{notice}</p>}
            <button
              className="min-h-11 rounded-lg bg-sky-800 px-5 py-2.5 font-semibold text-white hover:bg-sky-900 disabled:cursor-wait disabled:opacity-60"
              type="submit"
              disabled={saving}
            >
              {saving ? "Guardando…" : "Agregar a la lista"}
            </button>
          </div>
        </form>
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Invitados</h2>
            <p className="mt-1 text-sm text-slate-600">
              Marca el registro cuando el médico llegue al evento.
            </p>
          </div>
          <label className="w-full text-sm font-medium text-slate-700 sm:max-w-sm">
            Buscar por médico, hospital o boleto
            <input
              className={inputClass}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[950px] w-full border-collapse text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
              <tr>
                <th className="px-4 py-3 font-semibold">Nombre del médico</th>
                <th className="px-4 py-3 font-semibold">Hospital</th>
                <th className="px-4 py-3 font-semibold">Boleto</th>
                <th className="px-4 py-3 font-semibold">No. de boleto</th>
                <th className="px-4 py-3 font-semibold">Registro</th>
                <th className="px-4 py-3 font-semibold">Hora y fecha de registro</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800">
              {filteredGuests.map((guest) => (
                <tr key={guest.id} className="hover:bg-slate-50/80">
                  <td className="px-4 py-3 font-medium">{guest.doctorName}</td>
                  <td className="px-4 py-3">{guest.hospital}</td>
                  <td className="px-4 py-3">{guest.hasTicket ? "Sí" : "No"}</td>
                  <td className="px-4 py-3">{guest.hasTicket ? guest.ticketNumber : "—"}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`mr-2 inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${guest.checkedInAt ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"}`}
                    >
                      {guest.checkedInAt ? "Registrado" : "Pendiente"}
                    </span>
                    <button
                      className={`min-h-9 rounded-md px-3 py-1.5 text-sm font-semibold disabled:cursor-wait disabled:opacity-60 ${guest.checkedInAt ? "border border-slate-300 bg-white text-slate-700 hover:bg-slate-100" : "bg-emerald-700 text-white hover:bg-emerald-800"}`}
                      type="button"
                      disabled={pendingId === guest.id}
                      onClick={() => void updateAttendance(guest)}
                    >
                      {pendingId === guest.id
                        ? "Guardando…"
                        : guest.checkedInAt
                          ? "Deshacer"
                          : "Registrar"}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    {guest.checkedInAt
                      ? dateFormatter.format(new Date(guest.checkedInAt))
                      : "Pendiente"}
                  </td>
                </tr>
              ))}
              {filteredGuests.length === 0 && (
                <tr>
                  <td className="px-4 py-10 text-center text-slate-500" colSpan={6}>
                    {guests.length === 0
                      ? "Todavía no hay invitados. Agrégalos con el formulario."
                      : "No hay invitados que coincidan con la búsqueda."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
