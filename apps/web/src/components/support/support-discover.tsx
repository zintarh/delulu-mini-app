"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock, HeartHandshake } from "lucide-react";
import { Coin, Flame, GameSwitch, Lulu } from "@/components/ds";
import { AvatarStack } from "@/components/ui/avatar-stack";
import { UserAvatar } from "@/components/ui/user-avatar";
import { SupportCardSkeleton, SupportDeluluCard, facesToStack } from "@/components/support/support-delulu-card";
import { useAuth } from "@/hooks/use-auth";
import { useGoodDollarPrice } from "@/hooks/use-gooddollar-price";
import { compactCount } from "@/lib/rewards/public-stats";
import { formatUsdFromG } from "@/lib/rewards/summary";
import { postVisibility } from "@/lib/support/pending-visibility";
import { timeAgo } from "@/lib/support/format";
import type { SupportPulseDto } from "@/app/api/support/pulse/route";
import type { SupportRailsDto } from "@/app/api/support/rails/route";
import type { PublicDeluluDto } from "@/lib/support/server";
import { cn } from "@/lib/utils";

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: "same-origin" });
  if (!res.ok) throw new Error("Failed to load");
  return res.json();
}

const name = (u: string | null) => (u ? `@${u}` : "Someone");

// ---------------------------------------------------------------------------
// Hero: community pot + live ticker
// ---------------------------------------------------------------------------
export function SupportHero() {
  const { data, isLoading } = useQuery<SupportPulseDto>({
    queryKey: ["support-pulse"],
    staleTime: 30_000,
    refetchInterval: 60_000,
    queryFn: () => getJson("/api/support/pulse"),
  });
  const { usd } = useGoodDollarPrice();

  if (isLoading) return <div className="h-[168px] animate-pulse rounded-[28px] bg-ink/10" />;
  const total = data?.totalG ?? 0;
  const usdLabel = formatUsdFromG(total, usd);

  return (
    <section className="relative animate-rise overflow-hidden rounded-[28px] bg-ink text-white shadow-edge-ink">
      {/* Glow + mascot */}
      <span
        aria-hidden
        className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(246,195,36,0.35),transparent_65%)]"
      />
      <span aria-hidden className="absolute -bottom-3 right-3">
        <Lulu size={88} mood="kept" wave />
      </span>

      <div className="relative px-5 pb-4 pt-5 pr-[110px]">
        {total > 0 ? (
          <>
            <div className="label-mono text-[9px] text-white/60">Sent by the community</div>
            <div className="mt-1.5 flex items-center gap-1 font-display text-[44px] font-extrabold uppercase leading-none tabular-nums">
              <Coin size={38} />
              {compactCount(total)}
            </div>
            {usdLabel ? <div className="mt-1 text-[12px] font-semibold text-white/55">≈ {usdLabel}</div> : null}
            {data && data.backedThisWeek > 0 ? (
              <div className="mt-3 flex items-center gap-2">
                <AvatarStack participants={facesToStack(data.faces)} total={data.backedThisWeek} max={5} size={24} />
                <span className="text-[12px] font-bold text-white/80">
                  {data.backedThisWeek} backed someone this week
                </span>
              </div>
            ) : null}
          </>
        ) : (
          <>
            <div className="label-mono text-[9px] text-white/60">Back someone&apos;s Delulu</div>
            <p className="m-0 mt-2 font-display text-[30px] font-extrabold uppercase leading-[0.95]">
              Be the first
              <br />
              <span className="text-yellow">to send support</span>
            </p>
          </>
        )}
      </div>

      {data && data.recent.length > 0 ? <Ticker items={data.recent} /> : null}
    </section>
  );
}

function Ticker({ items }: { items: SupportPulseDto["recent"] }) {
  // Rendered twice so the -50% loop is seamless.
  const loop = [...items, ...items];
  return (
    <div className="relative overflow-hidden border-t border-white/10 bg-white/[0.04] py-2.5">
      <div className="flex w-max animate-support-ticker gap-6 pl-5">
        {loop.map((r, i) => (
          <Link
            key={`${r.id}-${i}`}
            href={`/support/${r.deluluId}`}
            className="flex shrink-0 items-center gap-2 text-[12px] text-white/80 no-underline"
            aria-hidden={i >= items.length}
            tabIndex={i >= items.length ? -1 : undefined}
          >
            <UserAvatar address="0x0000" username={r.from.username} pfpUrl={r.from.pfpUrl} size={20} />
            <span>
              <b className="text-white">{name(r.from.username)}</b> sent{" "}
              <b className="text-green">{compactCount(r.amountG)}</b> to <b className="text-white">{name(r.to.username)}</b>
            </span>
            <span className="text-white/40">{timeAgo(r.at)}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Make-your-own-public nudge (fills the page)
// ---------------------------------------------------------------------------
export function MakePublicBanner() {
  const { authenticated } = useAuth();
  const queryClient = useQueryClient();
  const { data } = useQuery<{ items: { id: number; title: string }[] }>({
    queryKey: ["support-my-private"],
    enabled: authenticated,
    staleTime: 60_000,
    queryFn: () => getJson("/api/support/my-private"),
  });
  const [busy, setBusy] = useState<number | null>(null);
  const [done, setDone] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const next = (data?.items ?? []).find((it) => !done.has(it.id));
  if (!authenticated || !next) return null;
  const more = (data?.items ?? []).filter((it) => !done.has(it.id)).length - 1;

  const flip = async (id: number) => {
    setBusy(id);
    setError(null);
    const r = await postVisibility({ id, isPublic: true });
    setBusy(null);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setDone((s) => new Set(s).add(id));
    void queryClient.invalidateQueries({ queryKey: ["support-feed"] });
    void queryClient.invalidateQueries({ queryKey: ["support-rails"] });
    void queryClient.invalidateQueries({ queryKey: ["delulu-visibility", String(id)] });
  };

  return (
    <section className="animate-rise rounded-[20px] border-2 border-yellow-line bg-yellow-soft px-3.5 py-3">
      <div className="flex items-center gap-3">
        <HeartHandshake className="h-5 w-5 shrink-0 text-pink" strokeWidth={2.4} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-extrabold">Let people back &ldquo;{next.title}&rdquo;</div>
          <div className="label-mono mt-0.5 text-[9px] text-muted-foreground">
            {more > 0 ? `+${more} more private` : "Support goes to your wallet"}
          </div>
        </div>
        <span className={cn(busy === next.id && "pointer-events-none opacity-60")}>
          <GameSwitch checked={false} onChange={() => void flip(next.id)} label={`Make "${next.title}" public`} />
        </span>
      </div>
      {error ? <p className="m-0 mt-2 text-center text-[13px] font-semibold text-orange">{error}</p> : null}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Curated rails
// ---------------------------------------------------------------------------
export function useSupportRails(enabled: boolean) {
  return useQuery<SupportRailsDto>({
    queryKey: ["support-rails"],
    enabled,
    staleTime: 30_000,
    queryFn: () => getJson("/api/support/rails"),
  });
}

const RAILS = [
  { key: "beFirst", label: "Be the first", icon: <HeartHandshake className="h-4 w-4 text-pink" strokeWidth={2.6} /> },
  { key: "onFire", label: "On fire", icon: <Flame size={18} /> },
  { key: "finalStretch", label: "Final stretch", icon: <Clock className="h-4 w-4 text-orange" strokeWidth={2.6} /> },
] as const;
type RailKey = (typeof RAILS)[number]["key"];

/** One spotlight row with a tiny switcher instead of three stacked rails. */
export function SupportRails({ onSupport }: { onSupport: (_d: PublicDeluluDto, _amount?: number) => void }) {
  const { data, isLoading } = useSupportRails(true);
  const [picked, setPicked] = useState<RailKey | null>(null);

  if (isLoading) {
    return (
      <div className="-mx-5 flex gap-3 overflow-hidden px-5">
        {[0, 1, 2].map((i) => (
          <SupportCardSkeleton key={i} compact />
        ))}
      </div>
    );
  }
  if (!data) return null;
  const available = RAILS.filter((r) => data[r.key].length > 0);
  if (available.length === 0) return null;
  const active = available.find((r) => r.key === picked) ?? available[0];

  return (
    <section>
      <div className="-mx-5 mb-2.5 flex gap-1.5 overflow-x-auto px-5 scrollbar-hide">
        {available.map((r) => {
          const on = r.key === active.key;
          return (
            <button
              key={r.key}
              type="button"
              onClick={() => setPicked(r.key)}
              aria-pressed={on}
              className={cn(
                "flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-extrabold transition",
                on ? "bg-ink text-white" : "bg-white/70 text-muted-foreground",
              )}
            >
              {r.icon}
              {r.label}
            </button>
          );
        })}
      </div>
      <div key={active.key} className="-mx-5 flex snap-x gap-3 overflow-x-auto px-5 pb-2 scrollbar-hide">
        {data[active.key].map((d) => (
          <SupportDeluluCard key={d.id} delulu={d} onSupport={onSupport} compact />
        ))}
      </div>
    </section>
  );
}
