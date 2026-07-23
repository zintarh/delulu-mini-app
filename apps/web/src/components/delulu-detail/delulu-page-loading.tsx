export function DeluluPageLoading() {
  return (
    <main className="h-full min-h-0 overflow-y-auto scrollbar-hide bg-background pb-20 lg:pb-8">
      <div className="lg:hidden sticky top-0 z-30 border-b border-border/40 bg-background/95 backdrop-blur-md">
        <div className="flex items-center gap-2 px-4 py-3">
          <div className="h-8 w-8 shrink-0 rounded-md bg-muted animate-pulse" />
          <div className="flex-1" />
          <div className="h-9 w-9 shrink-0 rounded-full bg-muted animate-pulse" />
        </div>
      </div>
      <div className="w-full space-y-6 px-3 py-5 pt-3 lg:px-6 lg:pt-6">
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="h-52 animate-pulse bg-muted sm:h-60" />
          <div className="space-y-3 p-5">
            <div className="h-7 w-2/3 animate-pulse rounded-md bg-muted" />
            <div className="h-4 w-1/3 animate-pulse rounded-md bg-muted" />
          </div>
        </div>
        <div className="h-40 animate-pulse rounded-2xl bg-muted" />
        <div className="h-64 animate-pulse rounded-2xl bg-muted" />
      </div>
    </main>
  );
}
