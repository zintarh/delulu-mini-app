"use client";

export function LeaderboardPagination({
  page,
  rangeStart,
  rangeEnd,
  total,
  hasNextPage,
  onPrev,
  onNext,
}: {
  page: number;
  rangeStart: number;
  rangeEnd: number;
  total?: number | string | null;
  hasNextPage: boolean;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <div className="flex items-center justify-between pt-6">
      <button
        type="button"
        disabled={page === 0}
        onClick={onPrev}
        className="rounded-full bg-secondary px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-secondary/80 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Previous
      </button>
      <span className="text-sm tabular-nums text-muted-foreground">
        {rangeStart}–{rangeEnd}
        {total != null ? ` of ${total}` : hasNextPage ? "+" : ""}
      </span>
      <button
        type="button"
        disabled={!hasNextPage}
        onClick={onNext}
        className="rounded-full bg-secondary px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-secondary/80 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Next
      </button>
    </div>
  );
}
