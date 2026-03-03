export function ChallengeSkeleton() {
  return (
    <div className="bg-white rounded-xl border-2 border-gray-200 p-4 sm:p-6 animate-pulse">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
        <div className="flex-1 min-w-0 space-y-3">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-4 h-4 bg-gray-200 rounded flex-shrink-0" />
            <div className="h-4 bg-gray-200 rounded w-32 sm:w-48" />
          </div>
          <div className="space-y-2">
            <div className="h-3 bg-gray-200 rounded w-full" />
            <div className="h-3 bg-gray-200 rounded w-5/6" />
          </div>
          <div className="flex flex-wrap items-center gap-3 sm:gap-6">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <div className="w-3.5 h-3.5 bg-gray-200 rounded" />
              <div className="h-3 bg-gray-200 rounded w-16" />
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <div className="w-3.5 h-3.5 bg-gray-200 rounded" />
              <div className="h-3 bg-gray-200 rounded w-24" />
            </div>
            <div className="h-3 bg-gray-200 rounded w-20" />
          </div>
        </div>
        <div className="flex-shrink-0">
          <div className="h-6 w-16 bg-gray-200 rounded-md" />
        </div>
      </div>
    </div>
  );
}
