const placeholders = ["Graficas", "Respuestas", "Reportes"];

export default function AdminPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-6 px-6 py-16">
      <section className="space-y-3">
        <h1 className="text-3xl font-semibold">Panel administrativo</h1>
        <p className="text-lg text-slate-700">
          Marcadores provisionales para modulos futuros.
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {placeholders.map((item) => (
          <article key={item} className="border border-slate-300 p-4">
            <h2 className="text-lg font-medium">{item}</h2>
            <p className="mt-2 text-sm text-slate-600">Pendiente</p>
          </article>
        ))}
      </section>
    </main>
  );
}
