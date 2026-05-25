export function CreateFlowSkeleton() {
  return (
    <div className="flex flex-1 flex-col gap-4 px-5 py-6 animate-pulse">
      <div className="h-8 w-2/3 rounded-lg bg-secondary" />
      <div className="h-12 w-full rounded-2xl bg-secondary" />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-10 rounded-2xl bg-secondary" />
        ))}
      </div>
      <div className="mt-4 h-11 w-40 rounded-full bg-secondary" />
    </div>
  );
}
