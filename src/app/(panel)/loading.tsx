/**
 * Loading skeleton para el panel. Se renderiza mientras los Server Components
 * de cada page hacen sus queries a Supabase. Mejora drásticamente la sensación
 * de velocidad — el sidebar y el header siguen visibles, solo el contenido
 * principal aparece como skeleton.
 */
export default function PanelLoading() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="h-7 w-48 animate-pulse rounded bg-stone-200" />
          <div className="mt-2 h-4 w-72 animate-pulse rounded bg-stone-100" />
        </div>
        <div className="h-10 w-32 animate-pulse rounded-lg bg-stone-200" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="rounded-xl border border-stone-200 bg-white p-4"
          >
            <div className="h-3 w-20 animate-pulse rounded bg-stone-100" />
            <div className="mt-3 h-7 w-24 animate-pulse rounded bg-stone-200" />
            <div className="mt-2 h-3 w-32 animate-pulse rounded bg-stone-100" />
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-stone-200 bg-white p-6">
        <div className="space-y-3">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="h-10 w-10 animate-pulse rounded-full bg-stone-100" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-1/3 animate-pulse rounded bg-stone-200" />
                <div className="h-3 w-1/2 animate-pulse rounded bg-stone-100" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
