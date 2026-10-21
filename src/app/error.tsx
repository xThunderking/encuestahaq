"use client";

export default function AttendanceError({ retry }: { retry: () => void }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-blue-50 p-6">
      <section
        className="w-full max-w-lg rounded-2xl border border-blue-100 bg-white p-8 text-center shadow-sm"
        role="alert"
      >
        <p className="mb-3 text-sm font-semibold text-blue-700">
          Hospital Ángeles Health System
        </p>
        <h1 className="text-2xl font-bold text-blue-950">
          No pudimos cargar el registro
        </h1>
        <p className="mt-4 text-slate-600">
          Revisa la conexión a internet y vuelve a intentarlo para continuar con
          el registro de médicos.
        </p>
        <button
          className="mt-6 min-h-12 rounded-xl bg-blue-700 px-6 py-3 font-semibold text-white hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-700"
          type="button"
          onClick={() => retry()}
        >
          Volver a intentar
        </button>
      </section>
    </main>
  );
}
