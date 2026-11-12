"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock, Globe2, HeartHandshake } from "lucide-react";
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

  const items = (data?.items ?? []).slice(0, 3);
  if (!authenticated || items.length === 0) return null;

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
    <section className="animate-rise rounded-[24px] border-2 border-yellow-line bg-yellow-soft p-4 shadow-edge-yellow-line">
      <div className="flex items-center gap-2.5">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white">
          <HeartHandshake className="h-5 w-5 text-pink" strokeWidth={2.4} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="font-extrabold leading-tight">Let people back you</div>
          <div className="label-mono mt-0.5 text-[9px] text-muted-foreground">Support goes straight to your wallet</div>
        </div>
      </div>
      <div className="mt-3 flex flex-col gap-2">
        {items.map((it) => {
          const on = done.has(it.id);
          return (
            <div key={it.id} className="flex items-center gap-3 rounded-2xl bg-white px-3.5 py-2.5">
              {on ? (
                <Globe2 className="h-4 w-4 shrink-0 text-green-edge" strokeWidth={2.4} />
              ) : (
                <span className="h-4 w-4 shrink-0" />
              )}
              <span className="min-w-0 flex-1 truncate text-sm font-bold">{it.title}</span>
              {on ? (
                <Link href={`/support/${it.id}`} className="label-mono shrink-0 text-[10px] text-green-edge no-underline">
                  Public ✓
                </Link>
              ) : (
                <span className={cn(busy === it.id && "pointer-events-none opacity-60")}>
                  <GameSwitch checked={false} onChange={() => void flip(it.id)} label={`Make "${it.title}" public`} />
                </span>
              )}
            </div>
          );
        })}
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

function Rail({
  icon,
  title,
  items,
  onSupport,
}: {
  icon: React.ReactNode;
  title: string;
  items: PublicDeluluDto[];
  onSupport: (_d: PublicDeluluDto, _amount?: number) => void;
}) {
  if (items.length === 0) return null;
  return (
    <section>
      <h2 className="m-0 mb-2.5 flex items-center gap-2 text-[18px] font-extrabold tracking-[-0.015em]">
        {icon}
        {title}
      </h2>
      <div className="-mx-5 flex snap-x gap-3 overflow-x-auto px-5 pb-2 scrollbar-hide">
        {items.map((d) => (
          <SupportDeluluCard key={d.id} delulu={d} onSupport={onSupport} compact />
        ))}
      </div>
    </section>
  );
}

export function SupportRails({ onSupport }: { onSupport: (_d: PublicDeluluDto, _amount?: number) => void }) {
  const { data, isLoading } = useSupportRails(true);
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
  return (
    <>
      <Rail icon={<HeartHandshake className="h-5 w-5 text-pink" strokeWidth={2.6} />} title="Be the first" items={data.beFirst} onSupport={onSupport} />
      <Rail icon={<Flame size={22} />} title="On fire" items={data.onFire} onSupport={onSupport} />
      <Rail icon={<Clock className="h-5 w-5 text-orange" strokeWidth={2.6} />} title="Final stretch" items={data.finalStretch} onSupport={onSupport} />
    </>
  );
}
