// Shared loading UI for route Suspense boundaries (loading.tsx files).
export default function RouteSpinner() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4">
      <div className="h-9 w-9 animate-spin rounded-full border-2 border-ink-700 border-t-ochre" />
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-parchment-400">Cargando…</p>
    </div>
  );
}
