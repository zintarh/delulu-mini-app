"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Camera, Check, Image as ImageIcon, Lock } from "lucide-react";
import { MainPage } from "@/components/main-app-header";
import { Chest, Coin, HabitTile, HudPill, Lulu, gameButtonClass } from "@/components/ds";
import { useAuth } from "@/hooks/use-auth";
import { useCreatorForfeits, type ForfeitFeedItem, type ForfeitPeriodSnapshot } from "@/hooks/use-creator-forfeits";
import { destinationLabel, formatStakeAmount } from "@/components/forfeit/forfeit-day-card";
import { getTokenSymbol } from "@/lib/token-amounts";
import { APP_HOME } from "@/components/main-nav-config";
import { cn } from "@/lib/utils";

type NodeState = "kept" | "missed" | "now" | "now-done" | "locked";

/** Zig-zag x offsets (px) for the path, repeating. */
const OFFSETS = [0, 58, 86, 58, 0, -58, -86, -58];

function periodKept(p: ForfeitPeriodSnapshot | undefined): boolean {
  if (!p?.proofUrl) return false;
  return p.verifierAction !== "rejected" && p.verifierAction !== "timed_out";
}

function useCountdown(deadlineSec: number | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!deadlineSec) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [deadlineSec]);
  if (!deadlineSec) return null;
  const left = Math.max(0, Math.floor(deadlineSec - now / 1000));
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(Math.floor(left / 3600))}:${pad(Math.floor(left / 60) % 60)}:${pad(left % 60)}`;
}

/**
 * Contract detail as a quest path (design: docs/redesign/screens/ForfeitDetail.dc.html).
 * Days wind down the screen: kept (green), missed (orange), today (yellow,
 * pulsing), upcoming (locked), ending at a chest.
 */
export default function ContractDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { address } = useAuth();
  const { data, isLoading } = useCreatorForfeits(address);
  const item: ForfeitFeedItem | undefined = useMemo(
    () => (data ?? []).find((f) => String(f.onChainCommitmentId) === id),
    [data, id],
  );

  const chain = item?.onChain ?? null;
  const total = Math.max(1, chain?.totalPeriods ?? 1);
  const current = chain?.currentPeriodIndex ?? 0;
  const deadline = chain?.currentPeriodDeadline ? Number(chain.currentPeriodDeadline) : null;
  const countdown = useCountdown(chain?.active ? deadline : null);
  const periods = useMemo(() => item?.periods ?? [], [item]);
  const amount = item ? formatStakeAmount(item) : null;
  const symbol = chain?.token ? getTokenSymbol(chain.token) : "G$";
  const destination = item ? destinationLabel(item) : null;

  const nodes = useMemo(() => {
    return Array.from({ length: total }, (_, i): NodeState => {
      const p = periods.find((x) => x.periodIndex === i);
      if (i < current) return periodKept(p) ? "kept" : "missed";
      if (i === current && chain?.active) return periodKept(p) || p?.proofUrl ? "now-done" : "now";
      if (i === current && !chain?.active) return periodKept(p) ? "kept" : "missed";
      return "locked";
    });
  }, [total, current, periods, chain?.active]);

  const todayDone = nodes[current] === "now-done";
  const keptCount = nodes.filter((n) => n === "kept" || n === "now-done").length;

  if (!isLoading && !item) {
    return (
      <MainPage>
        <div className="mx-auto flex max-w-md flex-col items-center px-5 py-20 text-center">
          <Lulu size={72} mood="worried" />
          <p className="mt-4 text-lg font-extrabold">Contract not found</p>
          <p className="mt-1 text-sm text-muted-foreground">It may still be syncing. Check back in a moment.</p>
          <Link href={APP_HOME} className={gameButtonClass({ className: "mt-6" })}>
            Back home
          </Link>
        </div>
      </MainPage>
    );
  }

  const ROW = 64;
  const pathHeight = (total + 1) * ROW + 40;

  return (
    <MainPage className="flex h-full min-h-0 flex-col">
      <div className="mx-auto flex w-full max-w-md items-center gap-3 px-5 pb-2 pt-4">
        <Link
          href={APP_HOME}
          aria-label="Back"
          className="press-edge flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-line bg-white shadow-edge-sm"
        >
          <ArrowLeft className="h-5 w-5" strokeWidth={2.4} />
        </Link>
        <HabitTile icon={item?.evidenceType === "camera" ? Camera : ImageIcon} tint={item?.evidenceType === "camera" ? "pink" : "blue"} size={44} />
        <div className="min-w-0 flex-1">
          <div className="label-mono truncate text-[10px] text-muted-foreground">
            Nº {id} · {keptCount}/{total} kept
          </div>
          <div className="truncate text-lg font-bold">{item?.title ?? "Loading…"}</div>
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-md flex-wrap gap-2 px-5 pt-2">
        {countdown ? (
          <HudPill className="text-orange">
            <span className="font-mono text-sm tabular-nums">{countdown}</span>
          </HudPill>
        ) : null}
        {amount ? (
          <HudPill className="text-sm">
            <Coin size={18} />
            {amount} {symbol}
            {destination ? <span className="font-semibold text-muted-foreground">→ {destination}</span> : null}
          </HudPill>
        ) : null}
      </div>

      <div className="mx-auto w-full max-w-md flex-1 overflow-y-auto scrollbar-hide">
        <div className="relative" style={{ height: pathHeight }}>
          {nodes.map((state, i) => {
            const x = OFFSETS[i % OFFSETS.length];
            const top = 24 + i * ROW;
            const isNow = state === "now";
            const common = "absolute flex items-center justify-center rounded-full font-display text-[22px] font-extrabold";
            const style = { left: `calc(50% + ${x}px)`, top: isNow ? top - 6 : top };
            if (isNow) {
              return (
                <div key={i}>
                  <span
                    aria-hidden
                    className="absolute h-[86px] w-[92px] -translate-x-1/2 animate-ring-pulse rounded-full border-[3px] border-yellow"
                    style={{ left: style.left, top: top - 15 }}
                  />
                  <Link
                    href={`${APP_HOME}?prove=${id}`}
                    aria-label={`Prove day ${i + 1}`}
                    className={cn(common, "h-[68px] w-[74px] -translate-x-1/2 animate-bounce-in bg-yellow text-ink shadow-[0_6px_0_#c99a0a]")}
                    style={style}
                  >
                    <Camera className="h-[30px] w-[30px]" strokeWidth={2.2} />
                  </Link>
                  <span
                    className="absolute animate-bob whitespace-nowrap rounded-[14px] bg-ink px-3.5 py-2.5 text-[13px] font-extrabold uppercase tracking-[0.06em] text-white"
                    style={{ left: `calc(50% + ${x}px + ${x > 0 ? -196 : 50}px)`, top: top + 10 }}
                  >
                    Prove today
                  </span>
                </div>
              );
            }
            return (
              <span
                key={i}
                aria-label={`Day ${i + 1}: ${state === "locked" ? "upcoming" : state}`}
                className={cn(
                  common,
                  "h-14 w-[60px] -translate-x-1/2",
                  (state === "kept" || state === "now-done") && "animate-bounce-in bg-green-strong text-white shadow-[0_5px_0_#157041]",
                  state === "missed" && "bg-orange-soft text-orange shadow-[0_5px_0_#e8b89c]",
                  state === "locked" && "bg-line text-[#6b6b65] shadow-[0_5px_0_#cfcfc8]",
                )}
                style={style}
              >
                {state === "kept" || state === "now-done" ? (
                  <Check className="h-[26px] w-[26px]" strokeWidth={3} />
                ) : state === "missed" ? (
                  "✕"
                ) : (
                  i + 1
                )}
              </span>
            );
          })}
          <span
            aria-label="Finish reward"
            className="absolute flex h-16 w-[72px] -translate-x-1/2 items-center justify-center rounded-full bg-line shadow-[0_5px_0_#cfcfc8]"
            style={{ left: `calc(50% + ${OFFSETS[total % OFFSETS.length]}px)`, top: 24 + total * ROW }}
          >
            {chain?.active === false && keptCount === total ? <Chest size={44} /> : <Lock className="h-6 w-6 text-faint" strokeWidth={2.2} />}
          </span>
        </div>
      </div>

      <div className="border-t-2 border-line bg-paper px-5 pb-[max(env(safe-area-inset-bottom),20px)] pt-4">
        <div className="mx-auto max-w-md">
          {chain?.active && !todayDone ? (
            <Link href={`${APP_HOME}?prove=${id}`} className={gameButtonClass({ full: true, size: "lg" })}>
              <Camera className="h-5 w-5" strokeWidth={2.4} />
              Prove today
            </Link>
          ) : (
            <div className="text-center text-sm font-semibold text-muted-foreground">
              {chain?.active ? "Today's proof is in. See you tomorrow." : "This contract has ended."}
            </div>
          )}
        </div>
      </div>
    </MainPage>
  );
}
