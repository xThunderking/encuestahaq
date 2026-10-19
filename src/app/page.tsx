export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-16 text-slate-800">
      <section className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm sm:p-12">
        <p className="mb-3 text-sm font-semibold uppercase tracking-[0.16em] text-sky-800">
          Hospital Ángeles Querétaro
        </p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Asistencia médica para eventos
        </h1>
        <p className="mt-4 max-w-xl text-base leading-7 text-slate-600">
          Este espacio se está preparando para el registro y control de asistencia.
        </p>
      </section>
    </main>
  );
}
