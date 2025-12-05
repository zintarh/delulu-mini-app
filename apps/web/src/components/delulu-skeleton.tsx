export function DeluluCardSkeleton() {
  return (
    <div className="block p-4 rounded-2xl bg-delulu-dark/5 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-delulu-dark/10 shrink-0" />
        <div className="flex-1 min-w-0 space-y-2">
          <div className="h-4 bg-delulu-dark/10 rounded w-3/4" />
          <div className="h-3 bg-delulu-dark/5 rounded w-1/4" />
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-8 h-8 rounded-full bg-delulu-dark/10" />
          <div className="h-4 w-12 bg-delulu-dark/10 rounded" />
        </div>
      </div>
    </div>
  );
}

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

