export default function AuthShell({ brand, form }) {
  return (
    <section className="flex min-h-screen items-center justify-center bg-canvas p-4 md:p-8">
      <article className="flex w-full max-w-6xl min-h-[80vh] flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl md:flex-row">
        <aside className="relative flex flex-col overflow-hidden bg-primary p-8 text-white md:w-1/2 md:p-12">
          <span className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/10" aria-hidden />
          <div className="relative z-10 flex flex-1 flex-col items-center justify-center text-center">
            {brand}
          </div>
        </aside>
        <section className="flex flex-1 flex-col justify-center p-8 md:w-1/2 md:p-12">{form}</section>
      </article>
    </section>
  )
}
