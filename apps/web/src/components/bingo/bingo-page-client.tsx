"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, Share2, Users } from "lucide-react";
import { GameButton, Lulu, ShieldBadge } from "@/components/ds";
import { useIdentity } from "@/hooks/identityHook";
import { useFaceCheckOptional } from "@/contexts/right-panel-context";
import { MainPage } from "@/components/main-app-header";
import { ICON_BUTTON_CLASS } from "@/components/page-back-header";
import { BingoBoard, type SquareAvailability } from "@/components/bingo/bingo-board";
import { BingoJoinSheet } from "@/components/bingo/bingo-join-sheet";
import { BingoProofSheet } from "@/components/bingo/bingo-proof-sheet";
import { useAuth } from "@/hooks/use-auth";
import { useBingo, useBingoBoard, useBingoList, type BoardCard } from "@/hooks/use-bingo";
import { NextStepCard } from "@/components/next-step-card";
import { bingoNextStep } from "@/lib/next-step";
import { useRedirectToSignIn } from "@/hooks/use-redirect-to-sign-in";
import { fireConfetti, showAppToast } from "@/lib/celebrate";
import { buildSquares, type BingoSquareView, type BingoView } from "@/lib/bingo/view";
import { finishRollingStart, pendingRollingStart } from "@/lib/bingo/rolling-client";
import { fmtDay, fmtG, fmtRange } from "@/lib/bingo/format";
import { cn } from "@/lib/utils";

const DAY_MS = 86_400_000;

function statusLine(b: BingoView) {
  if (b.enrollment === "rolling") {
    const me = b.me;
    if (me && me.phase !== "ended") return `Day ${(me.today ?? 0) + 1} of ${b.durationDays}`;
    return `${b.durationDays} days · starts when you join`;
  }
  const c = b.cycle;
  if (!c) return "Coming soon";
  if (c.phase === "upcoming") return `Starts ${fmtDay(c.startsAt)}`;
  if (c.phase === "ended") return "Ended";
  return `Day ${(c.today ?? 0) + 1} of ${b.durationDays}`;
}

export function BingoPageClient({ slug }: { slug: string }) {
  const { address } = useAuth();
  const { bingo, setBingo, loading, error, reload } = useBingo(slug);
  const rolling = bingo?.enrollment === "rolling";
  const board = useBingoBoard(rolling ? { slug } : bingo?.cycle?.id);
  const { bingos: allBingos, reload: reloadAll } = useBingoList();
  const { requireAuth } = useRedirectToSignIn();
  const identity = useIdentity();
  const faceCheck = useFaceCheckOptional();
  const [joinOpen, setJoinOpen] = useState(false);
  const [picked, setPicked] = useState<BingoSquareView | null>(null);

  const me = bingo?.me ?? null;
  const myLive = me?.phase === "live" && me.status === "active" && !me.missedDay;
  const required = bingo ? bingo.missions.filter((m) => !m.bonus).length : 0;

  // A 3-day stake that landed on-chain but didn't finish setting up (closed tab, bad signal): finish it.
  const resumed = useRef(false);
  useEffect(() => {
    if (!rolling || !address || resumed.current) return;
    const pending = pendingRollingStart(slug, address);
    if (!pending) return;
    resumed.current = true;
    void finishRollingStart(slug, address, pending)
      .then(() => reload())
      .catch(() => showAppToast("Your stake is safe — we'll finish setting up your card shortly."));
  }, [rolling, address, slug, reload]);

  const availability = useCallback(
    (s: BingoSquareView): SquareAvailability => {
      if (!me || !myLive || s.state !== "empty") return "none";
      if (s.bonus) return "open";
      if (me.dayOrdered) return s.index === me.today && !me.todayUsed ? "open" : "locked";
      return me.todayUsed ? "locked" : "open";
    },
    [me, myLive],
  );

  const onFilled = useCallback(
    async (index: number) => {
      // Fill locally right away (the stamp animation), then sync.
      setBingo((prev) => {
        if (!prev?.me) return prev;
        const bonus = prev.missions[index]?.bonus ?? false;
        return {
          ...prev,
          me: {
            ...prev.me,
            squares: prev.me.squares.map((s) => (s.index === index ? { ...s, state: "filled" } : s)),
            squaresFilled: prev.me.squaresFilled + 1,
            requiredFilled: prev.me.requiredFilled + (bonus ? 0 : 1),
            todayUsed: prev.me.todayUsed || !bonus,
          },
        };
      });
      const before = me?.requiredFilled ?? 0;
      await reload();
      void board.reload();
      void reloadAll();
      const square = bingo?.missions[index];
      if (square && !square.bonus && before + 1 >= required) {
        void fireConfetti();
        showAppToast("BINGO! Your card is complete");
      }
    },
    [setBingo, reload, board, reloadAll, me?.requiredFilled, bingo?.missions, required],
  );

  const previewSquares = useMemo(() => (bingo ? buildSquares(bingo.missions, [], false) : []), [bingo]);

  const share = async () => {
    if (!bingo) return;
    const url = `${window.location.origin}/bingo/${bingo.slug}`;
    const text = me ? `${me.requiredFilled}/${required} on ${bingo.title} Bingo 📸` : `Play ${bingo.title} Bingo with me on Delulu 📸`;
    try {
      if (navigator.share) await navigator.share({ text, url });
      else {
        await navigator.clipboard.writeText(`${text} ${url}`);
        showAppToast("Link copied");
      }
    } catch {
      /* cancelled */
    }
  };

  if (loading) {
    return (
      <MainPage>
        <div className="mx-auto max-w-md animate-pulse px-5 pt-4">
          <div className="h-11 w-11 rounded-full bg-muted" />
          <div className="mt-6 h-3 w-32 rounded bg-muted" />
          <div className="mt-3 h-9 w-3/4 rounded-lg bg-muted" />
          <div className="mt-6 aspect-square w-full rounded-[24px] bg-muted" />
        </div>
      </MainPage>
    );
  }
  if (!bingo || error) {
    return (
      <MainPage>
        <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-5 pt-20 text-center">
          <Lulu size={72} mood="sleep" />
          <p className="font-bold">{error ?? "This Bingo isn't available."}</p>
          <Link href="/bingo" className="text-sm font-bold underline">
            See all Bingos
          </Link>
        </div>
      </MainPage>
    );
  }

  const c = bingo.cycle;
  const complete = me != null && me.requiredFilled >= required;
  const minStake = Math.min(...bingo.tiers.map((t) => t.stake));
  const showBoard = board.cards.length > 0;

  // G$ per photo needs a one-time face check — say so while it can still pay off.
  const showVerifyNudge =
    !!faceCheck && !!me && myLive && !complete && bingo.rewards.perProof > 0 && !identity.isLoading && !identity.isVerified;

  // One clear next step, always: today's square, come back tomorrow, or what to play next.
  const step = bingoNextStep(bingo, allBingos ?? []);
  const onStepAction = (action: "join" | "today") => {
    if (action === "join") return requireAuth(() => setJoinOpen(true));
    if (!me) return;
    const target = me.dayOrdered
      ? me.squares[me.today ?? 0]
      : me.squares.find((sq) => sq.state === "empty" && !sq.bonus) ?? me.squares.find((sq) => sq.state === "confirming");
    if (target) setPicked(target);
  };

  return (
    <MainPage>
      <div className="mx-auto max-w-md px-5 pb-36 pt-4">
        <div className="flex items-center justify-between">
          <Link href="/explore" aria-label="Back" className={ICON_BUTTON_CLASS}>
            <ChevronLeft className="h-5 w-5" strokeWidth={2} />
          </Link>
          <button type="button" aria-label="Share" onClick={() => void share()} className={ICON_BUTTON_CLASS}>
            <Share2 className="h-[18px] w-[18px]" />
          </button>
        </div>

        <header className="mt-5 animate-rise">
          <p className="label-mono text-[11px] text-muted-foreground">
            {bingo.durationDays}-day Bingo{c ? ` · ${fmtRange(c.startsAt, c.endsAt)}` : ""}
          </p>
          <h1 className="mt-1.5 font-display text-[34px] font-extrabold uppercase leading-[0.92]">{bingo.title}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-[12px] font-bold">
            <span className={cn("rounded-full px-2.5 py-1", myLive || c?.phase === "live" ? "bg-green-soft text-green-edge" : "bg-yellow-soft text-[#8a6a00]")}>
              {statusLine(bingo)}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 ring-2 ring-line">
              <Users className="h-3.5 w-3.5" /> {bingo.players}
            </span>
            {me ? (
              <span className="rounded-full bg-ink px-2.5 py-1 text-white">
                {bingo.tiers.length > 1 ? `${me.tierLabel} · ` : ""}
                {fmtG(me.stake)} G$
              </span>
            ) : null}
          </div>
        </header>

        <section className="relative mt-5 animate-rise [animation-delay:.08s]">
          <BingoBoard
            squares={me ? me.squares : previewSquares}
            availability={me ? availability : undefined}
            onPick={me ? (s) => setPicked(s) : undefined}
            complete={complete}
            reward={bingo.rewards.perProof > 0 ? { perSquare: bingo.rewards.perProof } : undefined}
          />
        </section>

        {showVerifyNudge ? (
          <div className="mt-4 flex animate-rise items-center gap-3 rounded-[20px] border-2 border-green-line bg-[#f2fbf5] px-3.5 py-3">
            <ShieldBadge size={34} />
            <p className="m-0 min-w-0 flex-1 text-[13px] font-bold leading-snug">
              Verify once to earn {fmtG(bingo.rewards.perProof)} G$ for every photo
            </p>
            <GameButton variant="ink" size="sm" onClick={faceCheck!.start}>
              Verify
            </GameButton>
          </div>
        ) : null}
        {me || !bingo.joinable ? (
          <NextStepCard step={step} onAction={onStepAction} className="mt-4" />
        ) : (
          <div className="mt-4 text-center text-[13px] font-semibold text-muted-foreground">{step.title}</div>
        )}

        {showBoard ? (
          <section className="mt-9">
            <div className="flex items-baseline justify-between">
              <h2 className="font-display text-xl font-extrabold uppercase">Players</h2>
              <span className="label-mono text-[11px] text-muted-foreground">{board.total} {rolling ? "recent" : "playing"}</span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              {board.cards.map((card) => (
                <PlayerCard key={card.attemptId} card={card} required={required} mine={card.attemptId === me?.attemptId} rolling={rolling} />
              ))}
            </div>
            {board.hasMore ? (
              <GameButton variant="line" size="sm" full className="mt-3" onClick={() => void board.loadMore()} disabled={board.loading}>
                More players
              </GameButton>
            ) : null}
          </section>
        ) : null}
      </div>

      {bingo.joinable && !me ? (
        <div className="fixed inset-x-0 z-40 mx-auto max-w-md px-5 lg:left-[var(--desktop-sidebar-w)]" style={{ bottom: "max(env(safe-area-inset-bottom, 0px), 24px)" }}>
          <GameButton variant="yellow" full size="lg" onClick={() => requireAuth(() => setJoinOpen(true))}>
            {rolling ? (me ? `Start a fresh card · ${fmtG(minStake)} G$` : `Start · ${fmtG(minStake)} G$`) : `Join · from ${fmtG(minStake)} G$`}
          </GameButton>
        </div>
      ) : null}

      {bingo.joinable ? (
        <BingoJoinSheet
          bingo={bingo}
          open={joinOpen}
          onOpenChange={setJoinOpen}
          onJoined={async () => {
            await reload();
            void board.reload();
          }}
        />
      ) : null}
      {me ? (
        <BingoProofSheet
          attemptId={me.attemptId}
          square={picked}
          open={picked != null}
          onOpenChange={(o) => !o && setPicked(null)}
          onFilled={onFilled}
          nextStep={step}
          onNextAction={onStepAction}
        />
      ) : null}
    </MainPage>
  );
}

function PlayerCard({ card, required, mine, rolling }: { card: BoardCard; required: number; mine: boolean; rolling: boolean }) {
  const name = card.username ? `@${card.username}` : `${card.wallet.slice(0, 6)}…${card.wallet.slice(-4)}`;
  const done = card.requiredFilled >= required;
  // Rolling cards each run on their own clock — show their own day, never a shared rank.
  const day = Math.min(required, Math.floor((Date.now() - Date.parse(card.startedAt)) / DAY_MS) + 1);
  const running = Date.now() < Date.parse(card.endsAt) && card.status === "active";
  return (
    <div className={cn("rounded-2xl border-2 bg-white p-2 shadow-edge-sm", mine ? "border-ink" : "border-line")}>
      <BingoBoard squares={card.squares} size="mini" className="ring-0" />
      <div className="mt-2 flex items-center justify-between gap-1 px-0.5">
        <span className="min-w-0 truncate text-[12px] font-bold">
          {rolling ? null : <span className="text-muted-foreground">#{card.rank} </span>}
          {mine ? "You" : name}
        </span>
        <span className={cn("shrink-0 text-[11px] font-extrabold", done ? "text-green-edge" : "text-muted-foreground")}>
          {done ? "BINGO" : rolling && running ? `Day ${day} · ${card.requiredFilled}/${required}` : `${card.requiredFilled}/${required}`}
        </span>
      </div>
    </div>
  );
}
