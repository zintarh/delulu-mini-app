"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Camera, Check, ChevronLeft, Clock, MoreHorizontal } from "lucide-react";
import { MainPage } from "@/components/main-app-header";
import { Coin, HabitTile, HudPill, Lulu, gameButtonClass } from "@/components/ds";
import { usePublicRewards } from "@/hooks/use-public-rewards";
import { useDaypart } from "@/hooks/use-daypart";
import { completionAmountFor } from "@/lib/rewards/rules";
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
import { capitalizeFirst, cn } from "@/lib/utils";
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
import { VisibilityPill } from "@/components/support/visibility-sheet";

type NodeState = "kept" | "missed" | "now" | "now-done" | "locked";

const fmtWhole = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 0 });

/**
 * Lulu hanging beside a node with a speech bubble — what this step pays.
 * `side` is where it sits relative to the anchor x.
 */
function LuluSays({
  x,
  top,
  side,
  children,
  mood = "dream",
  withLulu = true,
}: {
  x: number;
  top: number;
  side: "left" | "right";
  children: React.ReactNode;
  mood?: "dream" | "kept" | "sad" | "worried" | "sleep";
  withLulu?: boolean;
}) {
  const left = side === "right";
  return (
    <span
      className={cn(
        "pointer-events-none absolute flex animate-bob items-center gap-1",
        left ? "flex-row" : "-translate-x-full flex-row-reverse",
      )}
      style={{ left: `calc(50% + ${x + (left ? 46 : -46)}px)`, top }}
    >
      {withLulu ? <Lulu size={40} mood={mood} /> : null}
      {children ? (
        <span className="relative flex items-center gap-0.5 whitespace-nowrap rounded-[14px] border-2 border-ink bg-white px-2.5 py-1.5 font-display text-[16px] font-extrabold tabular-nums text-ink shadow-[0_3px_0_#14140f]">
          {children}
          <span
            aria-hidden
            className={cn(
              "absolute top-1/2 -mt-[5px] h-2.5 w-2.5 rotate-45 border-ink bg-white",
              left ? "-left-[6px] border-b-2 border-l-2" : "-right-[6px] border-r-2 border-t-2",
            )}
          />
        </span>
      ) : null}
    </span>
  );
}

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

  // What each step pays. G$ only when money is staked and someone else reviews
  // the proof (word pledges and self-verified goals earn points only).
  const rewardsConfig = usePublicRewards().data?.config;
  let hasStake = false;
  try {
    hasStake = BigInt(chain?.stakeAmount ?? 0) > BigInt(0);
  } catch {
    hasStake = false;
  }
  const earnsMoney = hasStake && item?.verificationMethod !== "self";
  const dailyMoney = earnsMoney && rewardsConfig?.categoryEnabled.daily_proof ? rewardsConfig.dailyAmount : 0;
  const durationDays = Math.round((total * Number(chain?.periodSeconds ?? 86_400)) / 86_400);
  const finishMoney =
    earnsMoney && rewardsConfig?.categoryEnabled.goal_completion
      ? completionAmountFor(durationDays, rewardsConfig.goalTiers)
      : 0;
  const todayReward: React.ReactNode =
    dailyMoney > 0 ? (
      <>
        <Coin size={18} />
        {fmtWhole(dailyMoney)}
      </>
    ) : earnsMoney && !rewardsConfig ? null : (
      <span className="text-[14px]">+{fmtWhole(proofPoints)} pts</span>
    );

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
  const night = useDaypart() === "night";
  const keptCount = nodes.filter((n) => n === "kept" || n === "now-done").length;

  if (!isLoading && !item) {
    return (
      <MainPage className="bg-wash min-h-full">
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
  // The zig-zag isn't symmetric for short goals (e.g. 3 days only swings right),
  // so centre the nodes actually drawn (days + finish chest), not the raw offsets —
  // that keeps the path lined up with the Prove today button below.
  const usedOffsets = Array.from({ length: total + 1 }, (_, i) => OFFSETS[i % OFFSETS.length]);
  const pathShift = (Math.min(...usedOffsets) + Math.max(...usedOffsets)) / 2;
  const nodeX = (i: number) => OFFSETS[i % OFFSETS.length] - pathShift;

  return (
    <MainPage className="bg-wash flex h-full min-h-0 flex-col">
      <div className="mx-auto flex w-full max-w-3xl items-center gap-3 px-5 pt-4">
        <Link href={APP_HOME} aria-label="Back" className={ICON_BUTTON_CLASS}>
          <ChevronLeft className="h-5 w-5" strokeWidth={2} />
        </Link>
        <HabitTile icon={goalIconFor(item?.title)} tint={goalTintFor(String(id))} size={44} />
        <div className="min-w-0 flex-1">
          <div className="label-mono truncate text-[10px] text-muted-foreground">
            Nº {String(id).padStart(4, "0")} · {proofLabel}
          </div>
          <div className="mt-0.5 truncate text-lg font-bold">{item?.title ? capitalizeFirst(item.title) : "Loading…"}</div>
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
        {item?.onChainCommitmentId != null ? <VisibilityPill onChainId={item.onChainCommitmentId} /> : null}
      </div>

      <div className="mx-auto mt-2 w-full max-w-3xl flex-1 overflow-y-auto scrollbar-hide">
        <div className="relative" style={{ height: pathHeight }}>
          {nodes.map((state, i) => {
            const x = nodeX(i);
            // Which side the "Prove today" bubble goes on follows the zig-zag, not the shift.
            const swingsRight = OFFSETS[i % OFFSETS.length] > 0;
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
                  <LuluSays x={x} top={top + 2} side={swingsRight ? "left" : "right"} mood={night ? "worried" : "dream"}>
                    {todayReward}
                  </LuluSays>
                </div>
              );
            }
            return (
              <Fragment key={i}>
              {state === "now-done" && night ? (
                <LuluSays x={x} top={top + 6} side={swingsRight ? "left" : "right"} mood="sleep">
                  {null}
                </LuluSays>
              ) : null}
              <span
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
              </Fragment>
            );
          })}
          {(() => {
            const finished = chain?.active === false;
            const won = finished && keptCount >= total;
            const lost = finished && !won;
            const fx = nodeX(total);
            const ftop = 20 + total * ROW;
            return (
              <>
                <span
                  aria-label={finishMoney > 0 ? `Finish reward: ${fmtWhole(finishMoney)}` : "Finish"}
                  className={cn(
                    "absolute flex h-16 w-[72px] -translate-x-1/2 items-center justify-center rounded-full",
                    won
                      ? "bg-green-strong shadow-[0_5px_0_#157041]"
                      : lost
                        ? "bg-line opacity-70 shadow-[0_5px_0_#cfcfc8]"
                        : "bg-yellow-soft shadow-[0_5px_0_#e8cf7a]",
                  )}
                  style={{ left: `calc(50% + ${fx}px)`, top: ftop }}
                >
                  <Lulu size={50} mood={won ? "kept" : lost ? "sad" : "dream"} />
                </span>
                {finishMoney > 0 && !lost ? (
                  <LuluSays withLulu={false} x={fx} top={ftop + 14} side={OFFSETS[total % OFFSETS.length] > 0 ? "left" : "right"}>
                    <span className="label-mono mr-1 text-[9px] text-muted-foreground">{won ? "Won" : "Finish"}</span>
                    <Coin size={18} />
                    {fmtWhole(finishMoney)}
                  </LuluSays>
                ) : null}
              </>
            );
          })()}
        </div>
      </div>

      <div className="border-t-2 border-line/70 bg-white/55 px-5 backdrop-blur-md night:border-white/10 night:bg-[#0f1233]/60 pb-[max(env(safe-area-inset-bottom),28px)] pt-4">
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
