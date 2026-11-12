"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { MainPage } from "@/components/main-app-header";
import { Chip, Lulu, Segmented, gameButtonClass } from "@/components/ds";
import { SupportCardSkeleton, SupportDeluluCard } from "@/components/support/support-delulu-card";
import { SupportModal } from "@/components/support/support-modal";
import { MySupportPanel } from "@/components/support/my-support-panel";
import { MakePublicBanner, SupportHero, SupportRails } from "@/components/support/support-discover";
import { useSupportFeed, type SupportSort } from "@/hooks/use-support";
import { SUPPORT_CATEGORIES, SUPPORT_CATEGORY_LABELS, isSupportCategory } from "@/lib/support/rules";
import type { PublicDeluluDto } from "@/lib/support/server";

const SORT_OPTIONS: { value: SupportSort; label: string }[] = [
  { value: "trending", label: "Trending" },
  { value: "newest", label: "Newest" },
  { value: "most_supported", label: "Most supported" },
  { value: "ending_soon", label: "Ending soon" },
];

function SupportPageInner() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const tab = sp.get("tab") === "mine" ? "mine" : "discover";
  const categoryParam = sp.get("category");
  const category = isSupportCategory(categoryParam) ? categoryParam : null;
  const sortParam = sp.get("sort") as SupportSort | null;
  const sort: SupportSort = SORT_OPTIONS.some((o) => o.value === sortParam) ? sortParam! : "trending";

  const [qDraft, setQDraft] = useState(sp.get("q") ?? "");
  const [q, setQ] = useState(qDraft.trim());
  useEffect(() => {
    const id = window.setTimeout(() => setQ(qDraft.trim()), 300);
    return () => window.clearTimeout(id);
  }, [qDraft]);

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(sp.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.replace(`${pathname}?${next}`, { scroll: false });
  };

  const feed = useSupportFeed({ category, q, sort });
  const items = feed.data?.pages.flatMap((p) => p.items) ?? [];
  const [supporting, setSupporting] = useState<{ d: PublicDeluluDto; amount?: number } | null>(null);
  const onSupport = (d: PublicDeluluDto, amount?: number) => setSupporting({ d, amount });
  const browsing = !q && !category;

  return (
    <MainPage className="bg-wash min-h-full">
      <div className="mx-auto flex max-w-3xl flex-col gap-4 px-5 pb-12 pt-5">
        <div>
          <span className="label-mono block text-muted-foreground">Back someone&apos;s Delulu</span>
          <h1 className="m-0 mt-1 animate-rise text-2xl font-bold tracking-[-0.02em]">Support</h1>
        </div>

        <Segmented
          ariaLabel="Support sections"
          value={tab}
          onChange={(v) => setParam("tab", v === "mine" ? "mine" : null)}
          options={[
            { value: "discover", label: "Discover" },
            { value: "mine", label: "My support" },
          ]}
        />

        {tab === "mine" ? (
          <MySupportPanel />
        ) : (
          <>
            <SupportHero />
            <MakePublicBanner />
            {browsing ? <SupportRails onSupport={onSupport} /> : null}

            <h2 className="m-0 mt-2 text-[18px] font-extrabold tracking-[-0.015em]">
              {browsing ? "All Delulus" : "Results"}
            </h2>
            <div className="flex gap-2">
              <label className="flex h-12 min-w-0 flex-1 items-center gap-2 rounded-2xl border-2 border-line bg-white px-3.5 focus-within:border-ink">
                <Search className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={2.4} />
                <input
                  value={qDraft}
                  onChange={(e) => setQDraft(e.target.value)}
                  placeholder="Search goals or people"
                  aria-label="Search goals or people"
                  className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-faint"
                />
                {qDraft ? (
                  <button type="button" aria-label="Clear search" onClick={() => setQDraft("")}>
                    <X className="h-4 w-4 text-muted-foreground" />
                  </button>
                ) : null}
              </label>
              <select
                aria-label="Sort"
                value={sort}
                onChange={(e) => setParam("sort", e.target.value === "trending" ? null : e.target.value)}
                className="h-12 shrink-0 rounded-2xl border-2 border-line bg-white px-3 text-sm font-semibold outline-none focus:border-ink"
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 scrollbar-hide">
              <Chip selected={!category} onClick={() => setParam("category", null)} className="h-9 px-3.5 text-[13px]">
                All
              </Chip>
              {SUPPORT_CATEGORIES.map((c) => (
                <Chip
                  key={c}
                  selected={category === c}
                  onClick={() => setParam("category", category === c ? null : c)}
                  className="h-9 px-3.5 text-[13px]"
                >
                  {SUPPORT_CATEGORY_LABELS[c]}
                </Chip>
              ))}
            </div>

            {feed.isLoading ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {[0, 1, 2, 3].map((i) => (
                  <SupportCardSkeleton key={i} />
                ))}
              </div>
            ) : feed.isError ? (
              <div className="py-12 text-center">
                <p className="m-0 font-bold">Couldn&apos;t load Delulus</p>
                <button type="button" onClick={() => void feed.refetch()} className={gameButtonClass({ variant: "line", size: "sm", className: "mt-3" })}>
                  Try again
                </button>
              </div>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center py-12 text-center">
                <Lulu size={72} mood="worried" />
                <p className="m-0 mt-3 font-extrabold">{q || category ? "Nothing matches" : "No public Delulus yet"}</p>
                {q || category ? null : (
                  <Link href="/forfeit" className={gameButtonClass({ size: "sm", className: "mt-4 no-underline" })}>
                    Start yours
                  </Link>
                )}
              </div>
            ) : (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  {items.map((d) => (
                    <SupportDeluluCard key={d.id} delulu={d} onSupport={onSupport} />
                  ))}
                </div>
                {feed.hasNextPage ? (
                  <button
                    type="button"
                    onClick={() => void feed.fetchNextPage()}
                    disabled={feed.isFetchingNextPage}
                    className={gameButtonClass({ variant: "line", full: true })}
                  >
                    {feed.isFetchingNextPage ? "Loading…" : "Show more"}
                  </button>
                ) : null}
              </>
            )}
          </>
        )}
      </div>

      <SupportModal
        delulu={supporting?.d ?? null}
        initialAmount={supporting?.amount}
        open={!!supporting}
        onOpenChange={(o) => {
          if (!o) setSupporting(null);
        }}
      />
    </MainPage>
  );
}

export default function SupportPage() {
  return (
    <Suspense fallback={null}>
      <SupportPageInner />
    </Suspense>
  );
}
