"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { UserAvatar } from "@/components/ui/user-avatar";
import { gameButtonClass } from "@/components/ds";
import type { SupportersDto } from "@/app/api/support/delulus/[id]/supporters/route";

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });

/** Everyone who backed a public Delulu — one row per person, summed. */
export function SupportersList({ onChainId, count }: { onChainId: number; count: number }) {
  const q = useInfiniteQuery<SupportersDto>({
    queryKey: ["support-supporters", String(onChainId)],
    initialPageParam: 1,
    enabled: count > 0,
    queryFn: async ({ pageParam }) => {
      const res = await fetch(`/api/support/delulus/${onChainId}/supporters?page=${pageParam}`);
      if (!res.ok) throw new Error("Failed to load");
      return res.json();
    },
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
  });
  const rows = q.data?.pages.flatMap((p) => p.supporters) ?? [];
  const unique = q.data?.pages[0]?.uniqueSupporters ?? count;

  return (
    <section>
      <h2 className="m-0 mb-2.5 flex items-baseline gap-2 text-[18px] font-extrabold tracking-[-0.015em]">
        Supporters <span className="text-sm font-bold text-muted-foreground tabular-nums">{unique}</span>
      </h2>
      {count === 0 ? (
        <p className="m-0 rounded-2xl bg-white px-4 py-4 text-center text-sm font-semibold text-muted-foreground shadow-edge-sm">
          Be the first to support
        </p>
      ) : q.isLoading ? (
        <div className="h-24 animate-pulse rounded-2xl bg-line/70" />
      ) : (
        <div className="overflow-hidden rounded-[20px] border-2 border-line bg-white shadow-edge">
          {rows.map((s, i) => (
            <div key={s.key} className={i ? "flex items-center gap-3 border-t border-line/70 px-3.5 py-3" : "flex items-center gap-3 px-3.5 py-3"}>
              <UserAvatar address="0x0000" username={s.username} pfpUrl={s.pfpUrl} size={34} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-bold">{s.username ? `@${s.username}` : "Someone"}</div>
                <div className="label-mono mt-0.5 text-[9px] text-muted-foreground">
                  {fmtDate(s.lastAt)}
                  {s.count > 1 ? ` · ${s.count} times` : ""}
                </div>
              </div>
              <span className="shrink-0 text-sm font-extrabold tabular-nums">{s.totalG.toLocaleString("en-US")} G$</span>
            </div>
          ))}
          {q.hasNextPage ? (
            <button
              type="button"
              onClick={() => void q.fetchNextPage()}
              disabled={q.isFetchingNextPage}
              className={gameButtonClass({ variant: "line", full: true, size: "sm", className: "rounded-none border-0 border-t shadow-none" })}
            >
              {q.isFetchingNextPage ? "Loading…" : "Show more"}
            </button>
          ) : null}
        </div>
      )}
    </section>
  );
}
