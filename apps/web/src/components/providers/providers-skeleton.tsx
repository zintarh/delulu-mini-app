"use client";

/**
 * Lightweight shell shown while the wallet/auth provider chunk loads.
 * Matches the main app chrome so the transition does not flash a blank screen.
 */
export function ProvidersSkeleton() {
  return (
    <div className="flex h-screen flex-col bg-background">
      <div className="hidden lg:block fixed inset-y-0 left-0 z-30 w-24 border-r border-border bg-background">
        <div className="flex h-full flex-col items-center gap-4 py-6">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-10 w-10 animate-pulse rounded-xl bg-secondary"
            />
          ))}
        </div>
      </div>
      <div className="flex flex-1 flex-col lg:pl-24">
        <div className="h-14 shrink-0 animate-pulse border-b border-border bg-secondary/40 lg:hidden" />
        <div className="flex flex-1 flex-col gap-4 p-4 lg:p-8">
          <div className="mx-auto h-10 w-full max-w-xl animate-pulse rounded-full bg-secondary lg:max-w-2xl" />
          <div className="mx-auto grid w-full max-w-6xl flex-1 grid-cols-2 gap-3 lg:grid-cols-3 lg:gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="min-h-[200px] animate-pulse rounded-2xl bg-secondary"
                style={{ animationDelay: `${i * 80}ms` }}
              />
            ))}
          </div>
        </div>
      </div>
      <div className="fixed bottom-0 left-0 right-0 z-40 h-16 border-t border-border bg-background/95 lg:hidden">
        <div className="flex h-full items-center justify-around px-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-8 w-8 animate-pulse rounded-full bg-secondary" />
          ))}
        </div>
      </div>
    </div>
  );
}
