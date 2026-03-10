import { cn } from "@/lib/utils";

export function HotDeluluSkeleton() {
  return (
    <div
      className="relative rounded-3xl p-5 h-[200px] shrink-0 w-full overflow-hidden"
      style={{
        background: "linear-gradient(135deg, #f9e79f 0%, #f7dc6f 10%, #d4af37 25%)",
      }}
    >
      <div className="space-y-3 animate-pulse">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-black/20" />
          <div className="h-4 w-24 bg-black/20 rounded" />
          <div className="ml-auto h-6 w-12 bg-black/20 rounded-full" />
        </div>
        <div className="space-y-2">
          <div className="h-5 bg-black/20 rounded w-full" />
          <div className="h-5 bg-black/20 rounded w-3/4" />
        </div>
        <div className="flex items-center justify-between mt-auto">
          <div className="w-11 h-11 rounded-full bg-black/20" />
          <div className="h-6 w-16 bg-black/20 rounded" />
        </div>
      </div>
    </div>
  );
}

export function DeluluCardSkeleton({
  className = "",
  index = 0, // kept for API compatibility
}: {
  className?: string;
  index?: number;
}) {
  return (
    <div
      className={cn(
        "block h-auto mb-4",
        className
      )}
    >
      <div className="bg-secondary rounded-2xl border border-border/70 overflow-hidden animate-pulse">
        {/* Header */}
        <div className="flex items-start gap-3 p-4 pb-2">
          <div className="w-10 h-10 rounded-full bg-muted flex-shrink-0 ring-2 ring-muted-foreground/20 ring-offset-2 ring-offset-background" />
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-center gap-2">
              <div className="h-3 w-24 rounded bg-muted" />
              <div className="h-3 w-16 rounded bg-muted" />
              <div className="h-3 w-20 rounded bg-muted ml-auto" />
            </div>
            <div className="flex items-center gap-2 text-[11px]">
              <div className="h-4 w-16 rounded-full bg-muted" />
              <div className="h-3 w-24 rounded bg-muted" />
            </div>
          </div>
        </div>

        {/* Headline */}
        <div className="px-4 pb-3 space-y-2">
          <div className="h-4 w-5/6 rounded bg-muted" />
          <div className="h-4 w-2/3 rounded bg-muted" />
        </div>

        {/* Milestones */}
        <div className="px-4 pb-4 space-y-2.5">
          <div className="flex items-center justify-between text-[11px]">
            <div className="h-3 w-16 rounded bg-muted" />
            <div className="h-3 w-24 rounded bg-muted" />
          </div>
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-xl px-3.5 py-2.5 border-2 border-border/60 bg-muted/40"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="h-2 w-2 rounded-full bg-border" />
                  <span className="h-3 w-32 rounded bg-muted" />
                </div>
                <span className="h-3 w-10 rounded-full bg-muted" />
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-4 border-t border-border/40 bg-muted/40 px-4 py-2.5 text-xs">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              <div className="h-3 w-8 rounded bg-muted" />
              <div className="h-3 w-14 rounded bg-muted" />
            </div>
          </div>
          <div className="inline-flex items-center gap-1.5 rounded-full bg-delulu-yellow/70 px-3.5 py-1.5 shadow-sm">
            <div className="w-4 h-4 rounded-full bg-delulu-charcoal/40" />
          </div>
        </div>
      </div>
    </div>
  );
}
