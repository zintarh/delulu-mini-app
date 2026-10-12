"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Camera, Check, ChevronLeft, Clock, MoreHorizontal } from "lucide-react";
import { MainPage } from "@/components/main-app-header";
import { Chest, Coin, HabitTile, HudPill, Lulu, gameButtonClass } from "@/components/ds";
import { useAuth } from "@/hooks/use-auth";
import {
  forfeitFeedKeys,
  useCreatorForfeits,
  type ForfeitFeedItem,
  type ForfeitPeriodSnapshot,
} from "@/hooks/use-creator-forfeits";
import { destinationLabel, formatStakeAmount } from "@/components/forfeit/forfeit-day-card";
import { FORFEIT_PROOF_POINTS_LOW, forfeitProofPointsForStake } from "@/lib/dashboard/campaign-constants";
import { getTokenSymbol } from "@/lib/token-amounts";
import { APP_HOME } from "@/components/main-nav-config";
import { cn } from "@/lib/utils";
import { ICON_BUTTON_CLASS } from "@/components/page-back-header";
import { goalIconFor, goalTintFor } from "@/components/goal-icon";
import { SubmitProofModal } from "@/components/submit-proof-modal";
import {
  useResolveForfeitCommitmentSuccess,
  useSubmitForfeitProof,
} from "@/hooks/use-create-forfeit-commitment";
import { submitForfeitProofWithWallet } from "@/lib/forfeit/submit-forfeit-proof-client";
import { proofErrorMessage } from "@/lib/community/format-proof-error";
import { useUserStore } from "@/stores/useUserStore";

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

  const queryClient = useQueryClient();
  const { user } = useUserStore();
  const { submitProofAndWait } = useSubmitForfeitProof();
  const { resolveCommitmentSuccessAndWait } = useResolveForfeitCommitmentSuccess();

  const [proofOpen, setProofOpen] = useState(false);
  const [proofBusy, setProofBusy] = useState(false);
  const [proofError, setProofError] = useState<string | null>(null);
  const [proofSuccess, setProofSuccess] = useState(false);
  const [proofStep, setProofStep] = useState<
    "idle" | "uploading" | "ai-verifying" | "wallet-sign" | "confirming"
  >("idle");

  const openProof = () => {
    setProofSuccess(false);
    setProofError(null);
    setProofStep("idle");
    setProofOpen(true);
  };

  const handleProofSubmit = async (proofUrls: string[]) => {
    if (!address || item?.onChainCommitmentId == null) {
      const msg = "This forfeit is still setting up. Wait a moment, then try uploading again.";
      setProofError(msg);
      throw new Error(msg);
    }
    setProofBusy(true);
    setProofError(null);
    setProofStep("ai-verifying");
    try {
      await submitForfeitProofWithWallet({
        onChainCommitmentId: item.onChainCommitmentId,
        walletAddress: address,
        proofUrls,
        submitProofOnChain: submitProofAndWait,
        resolveSuccessOnChain: resolveCommitmentSuccessAndWait,
        onStepChange: setProofStep,
      });
      setProofSuccess(true);
      void queryClient.invalidateQueries({ queryKey: forfeitFeedKeys.creator(address) });
    } catch (err) {
      const msg = proofErrorMessage(err);
      setProofError(msg);
      setProofStep("idle");
      throw err instanceof Error ? err : new Error(msg);
    } finally {
      setProofBusy(false);
    }
  };

  const chain = item?.onChain ?? null;
  const total = Math.max(1, chain?.totalPeriods ?? 1);
  const current = chain?.currentPeriodIndex ?? 0;
  const deadline = chain?.currentPeriodDeadline ? Number(chain.currentPeriodDeadline) : null;
  const countdown = useCountdown(chain?.active ? deadline : null);
  const [menuOpen, setMenuOpen] = useState(false);
  const proofLabel =
    item?.evidenceType === "camera" ? "Live camera" : item?.evidenceType === "gps-checkin" ? "Check-in" : "Daily photo";
  const isLiveCamera = item?.evidenceType === "camera";
  const periods = useMemo(() => item?.periods ?? [], [item]);
  const amount = item ? formatStakeAmount(item) : null;
  const proofPoints = forfeitProofPointsForStake(chain?.stakeAmount);
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

  const ROW = 62;
  const pathHeight = (total + 1) * ROW + 40;

  return (
    <MainPage className="flex h-full min-h-0 flex-col">
      <div className="mx-auto flex w-full max-w-3xl items-center gap-3 px-5 pt-4">
        <Link href={APP_HOME} aria-label="Back" className={ICON_BUTTON_CLASS}>
          <ChevronLeft className="h-5 w-5" strokeWidth={2} />
        </Link>
        <HabitTile icon={goalIconFor(item?.title)} tint={goalTintFor(String(id))} size={44} />
        <div className="min-w-0 flex-1">
          <div className="label-mono truncate text-[10px] text-muted-foreground">
            Nº {String(id).padStart(4, "0")} · {proofLabel}
          </div>
          <div className="mt-0.5 truncate text-lg font-bold">{item?.title ?? "Loading…"}</div>
        </div>
        <div className="relative shrink-0">
          <button type="button" aria-label="More" aria-expanded={menuOpen} onClick={() => setMenuOpen((v) => !v)} className={ICON_BUTTON_CLASS}>
            <MoreHorizontal className="h-5 w-5" strokeWidth={2} />
          </button>
          {menuOpen ? (
            <div className="absolute right-0 top-12 z-20 w-48 overflow-hidden rounded-2xl border-2 border-line bg-white shadow-edge">
              {chain?.active ? (
                <Link
                  href={`${APP_HOME}?discontinue=${id}`}
                  className="block px-4 py-3 text-sm font-semibold text-orange no-underline hover:bg-paper"
                >
                  Discontinue contract
                </Link>
              ) : (
                <span className="block px-4 py-3 text-sm font-semibold text-muted-foreground">This contract has ended</span>
              )}
            </div>
          ) : null}
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-3xl flex-wrap gap-2 px-5 pt-4">
        {countdown ? (
          <HudPill className="text-orange">
            <Clock className="h-[18px] w-[18px]" strokeWidth={2.2} />
            <span className="tabular-nums">{countdown}</span>
          </HudPill>
        ) : null}
        {amount ? (
          <HudPill>
            <Coin size={20} />
            {amount}
            {destination ? ` → ${destination}` : ` ${symbol}`}
          </HudPill>
        ) : null}
      </div>

      <div className="mx-auto mt-2 w-full max-w-3xl flex-1 overflow-y-auto scrollbar-hide">
        <div className="relative" style={{ height: pathHeight }}>
          {nodes.map((state, i) => {
            const x = OFFSETS[i % OFFSETS.length];
            const top = 20 + i * ROW;
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
                  <button
                    type="button"
                    onClick={openProof}
                    aria-label={`Prove day ${i + 1}`}
                    className={cn(common, "h-[68px] w-[74px] -translate-x-1/2 animate-bounce-in bg-yellow text-ink shadow-[0_6px_0_#c99a0a]")}
                    style={style}
                  >
                    <Camera className="h-[30px] w-[30px]" strokeWidth={2.2} />
                  </button>
                  <span
                    className="absolute animate-bob whitespace-nowrap rounded-[14px] bg-ink px-3.5 py-2.5 text-[13px] font-extrabold uppercase tracking-[0.06em] text-white"
                    style={{ left: `calc(50% + ${x}px + ${x > 0 ? -196 : 50}px)`, top: top + 10 }}
                  >
                    Prove today
                    <span
                      aria-hidden
                      className={cn("absolute top-1/2 -mt-1.5 h-3 w-3 rotate-45 bg-ink", x > 0 ? "-right-1.5" : "-left-1.5")}
                    />
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
            style={{ left: `calc(50% + ${OFFSETS[total % OFFSETS.length]}px)`, top: 20 + total * ROW }}
          >
            <Chest size={44} grey={chain?.active === false && keptCount < total} />
          </span>
        </div>
      </div>

      <div className="border-t-2 border-line bg-paper px-5 pb-[max(env(safe-area-inset-bottom),28px)] pt-4">
        <div className="mx-auto max-w-md">
          {chain?.active && !todayDone ? (
            <button type="button" onClick={openProof} className={gameButtonClass({ full: true })}>
              <Camera className="h-5 w-5" strokeWidth={2} />
              Prove today
            </button>
          ) : (
            <div className="text-center text-sm font-semibold text-muted-foreground">
              {chain?.active ? "Today's proof is in. See you tomorrow." : "This contract has ended."}
            </div>
          )}
        </div>
      </div>

      <SubmitProofModal
        open={proofOpen}
        onOpenChange={setProofOpen}
        onSubmit={handleProofSubmit}
        proofType={isLiveCamera ? "live_camera" : undefined}
        isSubmitting={proofBusy}
        submitSuccess={proofSuccess}
        submitError={proofError ? new Error(proofError) : null}
        proofStep={proofStep}
        onDone={() => {
          setProofOpen(false);
          setProofSuccess(false);
        }}
        isOnChain
        pointsAwarded={proofPoints}
        showStakeUpsell={proofPoints === FORFEIT_PROOF_POINTS_LOW}
        campaignTitle={item?.title}
        myUsername={user?.username}
        myAvatar={user?.pfpUrl}
      />
    </MainPage>
  );
}
