"use client";

import { afterVote } from "@/lib/vote-gate";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Camera, ChevronLeft, Share2, Sparkles, Users } from "lucide-react";
import { GameButton, Lulu, ShieldBadge } from "@/components/ds";
import { useIdentity } from "@/hooks/identityHook";
import { useFaceCheckOptional } from "@/contexts/right-panel-context";
import { MainPage } from "@/components/main-app-header";
import { ICON_BUTTON_CLASS } from "@/components/page-back-header";
import { BingoBoard, type SquareAvailability } from "@/components/bingo/bingo-board";
import { BingoCollage } from "@/components/bingo/bingo-collage";
import { BingoPlayers } from "@/components/bingo/bingo-players";
import { PhotoPrivacySwitch } from "@/components/bingo/photo-privacy-switch";
import { BoostCard } from "@/components/bingo/boost-card";
import { BingoEarnings, BingoEarningsLine } from "@/components/bingo/bingo-earnings";
import { CheerContestBanner, CheerPrompt, useCheerContest } from "@/components/bingo/cheers";
import { BingoJoinSheet } from "@/components/bingo/bingo-join-sheet";
import { BingoProofSheet } from "@/components/bingo/bingo-proof-sheet";
import { useAuth } from "@/hooks/use-auth";
import { useBingo, useBingoBoard, useBingoList, type BoardCard } from "@/hooks/use-bingo";
import { NextStepCard } from "@/components/next-step-card";
import { suggestInstall } from "@/components/pwa/install-prompt-gate";
import { bingoNextStep, type NextStepAction } from "@/lib/next-step";
import { useRedirectToSignIn } from "@/hooks/use-redirect-to-sign-in";
import { showAppToast } from "@/lib/celebrate";
import { buildSquares, type BingoSquareView, type BingoView } from "@/lib/bingo/view";
import { finishRollingStart, pendingRollingStart } from "@/lib/bingo/rolling-client";
import { fmtDay, fmtG, fmtRange } from "@/lib/bingo/format";
import { cn } from "@/lib/utils";
import { FirstWeekOffer } from "@/components/first-week-offer";
import { BingoFinishSheet, finishSeen } from "@/components/bingo/bingo-finish-sheet";
import { LeaderboardPrizeCard } from "@/components/leaderboard/prize-card";
import { FIRST_WEEK_SLUG } from "@/lib/bingo/first-week";


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
  const cheers = useCheerContest(slug);
  const { bingos: allBingos, reload: reloadAll } = useBingoList();
  const { requireAuth } = useRedirectToSignIn();
  const identity = useIdentity();
  const faceCheck = useFaceCheckOptional();
  const [joinOpen, setJoinOpen] = useState(false);
  const [picked, setPicked] = useState<BingoSquareView | null>(null);
  // Opening a square to post a photo goes through the vote gate first (lib/vote-gate.ts).
  const pickSquare = (sq: BingoSquareView | null) => void afterVote(() => setPicked(sq));
  const [finishOpen, setFinishOpen] = useState(false);

  const me = bingo?.me ?? null;
  const myLive = me?.phase === "live" && me.status === "active" && !me.missedDay;
  const required = bingo ? bingo.missions.filter((m) => !m.bonus).length : 0;
  // An approved photo whose on-chain step never finished: open it straight away, ready to sign —
  // one tap from done, before the day closes. Once per visit.
  const stuckSquare = me && !me.todayUsed ? (me.squares.find((sq) => !sq.bonus && sq.state === "confirming") ?? null) : null;
  const resumedRef = useRef(false);
  useEffect(() => {
    if (stuckSquare && !resumedRef.current) {
      resumedRef.current = true;
      setPicked(stuckSquare);
    }
  }, [stuckSquare]);

  // A finished card gets its celebration once — even when the last square confirmed after they left.
  const finishedAttempt = me && required > 0 && me.requiredFilled >= required ? me.attemptId : null;
  useEffect(() => {
    if (finishedAttempt && !finishSeen(finishedAttempt)) setFinishOpen(true);
  }, [finishedAttempt]);

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
      if (before === 0) suggestInstall("proof");
      if (square && !square.bonus && before + 1 >= required) setFinishOpen(true);
    },
    [setBingo, reload, board, reloadAll, me?.requiredFilled, bingo?.missions, required],
  );

  const previewSquares = useMemo(() => (bingo ? buildSquares(bingo.missions, [], false) : []), [bingo]);

  /** Share the card itself (an image of their photos), with a link back; link only if not playing. */
  const share = async () => {
    if (!bingo) return;
    // Shared from your card, the link previews as your card (see bingo/[slug]/page.tsx).
    const url = `${window.location.origin}/bingo/${bingo.slug}${me ? `?card=${me.attemptId}` : ""}`;
    const text = me
      ? me.requiredFilled >= required
        ? `BINGO! 🎉 I finished ${bingo.title} on Delulu`
        : `${me.requiredFilled}/${required} on ${bingo.title} 📸 Play with me on Delulu`
      : `Play ${bingo.title} Bingo with me on Delulu 📸`;
    try {
      if (me) {
        const res = await fetch(`/api/og/bingo/${me.attemptId}`);
        if (res.ok) {
          const file = new File([await res.blob()], "my-delulu-bingo.png", { type: "image/png" });
          if (navigator.canShare?.({ files: [file] })) {
            await navigator.share({ files: [file], text: `${text} ${url}` });
            return;
          }
          // No file sharing (desktop): save the image and copy the link.
          const a = document.createElement("a");
          a.href = URL.createObjectURL(file);
          a.download = file.name;
          a.click();
          URL.revokeObjectURL(a.href);
          await navigator.clipboard.writeText(`${text} ${url}`).catch(() => {});
          showAppToast("Card saved · link copied");
          return;
        }
      }
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
      <MainPage className="bg-wash min-h-full">
        <div className="mx-auto max-w-3xl animate-pulse px-5 pt-4">
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
      <MainPage className="bg-wash min-h-full">
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
  // Today's photo, if it can go in now (the add button under the card).
  const addTarget = me && myLive ? me.squares.find((sq) => !sq.bonus && availability(sq) === "open") ?? null : null;
  // Bonus squares aren't on the pinboard (it shows the days); they get their own buttons.
  const openBonus = me && myLive ? me.squares.filter((sq) => sq.bonus && availability(sq) === "open") : [];

  const onStepAction = (action: NextStepAction) => {
    if (action === "join") return requireAuth(() => setJoinOpen(true));
    if (!me) return;
    const target = me.dayOrdered
      ? me.squares[me.today ?? 0]
      : me.squares.find((sq) => sq.state === "empty" && !sq.bonus) ?? me.squares.find((sq) => sq.state === "confirming");
    if (target) pickSquare(target);
  };

  return (
    <MainPage className="bg-wash min-h-full">
      <div className="mx-auto max-w-3xl px-5 pb-36 pt-4">
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

        {/* First Week: lead with what the week pays and what a miss costs. */}
        {slug === FIRST_WEEK_SLUG && !myLive ? <FirstWeekOffer variant="home" className="mt-4 animate-rise" /> : null}
        {/* What this Bingo pays: the full table before you join, one line for your stake after. */}
        {slug !== FIRST_WEEK_SLUG && !myLive ? <BingoEarnings bingo={bingo} className="mt-4 animate-rise" /> : null}
        {slug !== FIRST_WEEK_SLUG && myLive && me ? <BingoEarningsLine bingo={bingo} stake={me.stake} className="mt-4" /> : null}

        {me ? (
          <>
            {/* Their card as a pinboard: photos fill it as they go; today's empty square is tappable. */}
            <section className="mt-5 animate-rise [animation-delay:.08s]">
              <BingoCollage
                card={me}
                bingoTitle={bingo.title}
                required={required}
                mine
                canPick={(i) => {
                  const sq = me.squares.find((x) => x.index === i);
                  return !!sq && availability(sq) === "open";
                }}
                onPick={(i) => {
                  const sq = me.squares.find((x) => x.index === i);
                  if (sq) pickSquare(sq);
                }}
              />
              <PhotoPrivacySwitch className="mt-3" />
            </section>

            {/* Daily Boost: before today's photo (hidden until the contract upgrade is live). */}
            <BoostCard bingo={bingo} onBoosted={reload} className="mt-4" />

            {/* Right under it: the one thing to do now. */}
            {addTarget ? (
              <GameButton variant="yellow" full size="lg" className="mt-4" onClick={() => pickSquare(addTarget)}>
                <Camera className="h-5 w-5" /> Add Day {addTarget.index + 1} photo
                {bingo.rewards.perProof > 0 ? ` · +${fmtG(bingo.rewards.perProof)} G$` : ""}
              </GameButton>
            ) : complete ? (
              <GameButton variant="yellow" full size="lg" className="mt-4" onClick={() => void share()}>
                <Share2 className="h-5 w-5" /> Flex my BINGO
              </GameButton>
            ) : null}

            {openBonus.length > 0 ? (
              <div className="mt-3 flex flex-col gap-2">
                {openBonus.map((sq) => (
                  <GameButton key={sq.index} variant="line" size="sm" full onClick={() => pickSquare(sq)}>
                    <Sparkles className="h-4 w-4" /> Bonus photo · {sq.title}
                  </GameButton>
                ))}
              </div>
            ) : null}

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

            {/* Nothing to add right now (posted today, card ended, missed a day): what's next. */}
            {addTarget ? null : <NextStepCard step={step} onAction={onStepAction} className="mt-4" />}
            {/* Posted today: where that put you on the board. */}
            {me?.todayUsed ? <LeaderboardPrizeCard className="mt-3" /> : null}
          </>
        ) : (
          <>
            <section className="relative mt-5 animate-rise [animation-delay:.08s]">
              <BingoBoard
                squares={previewSquares}
                complete={false}
                reward={bingo.rewards.perProof > 0 ? { perSquare: bingo.rewards.perProof } : undefined}
              />
            </section>
            {!bingo.joinable ? (
              <NextStepCard step={step} onAction={onStepAction} className="mt-4" />
            ) : (
              <div className="mt-4 text-center text-[13px] font-semibold text-muted-foreground">{step.title}</div>
            )}
          </>
        )}

        {showBoard ? (
          <section id="players" className="mt-9 scroll-mt-20">
            {/* This week's Best card contest: the prize, the top 3, and a nudge to cheer. */}
            {cheers.data?.live && !cheers.data.setupPending ? (
              <div className="mb-4">
                <CheerContestBanner contest={cheers.data} onCheer={() => document.getElementById("players-list")?.scrollIntoView({ behavior: "smooth" })} />
              </div>
            ) : null}
            <div id="players-list" className="flex scroll-mt-20 items-baseline justify-between">
              <h2 className="font-display text-xl font-extrabold uppercase">Leaderboard</h2>
              <span className="label-mono text-[11px] text-muted-foreground">{board.total} {rolling ? "recent" : "playing"}</span>
            </div>
            <div className="mt-3">
              <BingoPlayers cards={board.cards} required={required} bingoTitle={bingo.title} myAttemptId={me?.attemptId ?? null} slug={slug} contest={cheers.data} />
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
        <div className="fixed inset-x-0 z-40 mx-auto max-w-3xl px-5 lg:left-[var(--desktop-sidebar-w)]" style={{ bottom: "max(env(safe-area-inset-bottom, 0px), 24px)" }}>
          <GameButton variant="yellow" full size="lg" onClick={() => requireAuth(() => setJoinOpen(true))}>
            {rolling ? (me ? `Start a fresh card · ${fmtG(minStake)} G$` : `Start · ${fmtG(minStake)} G$`) : `Join · from ${fmtG(minStake)} G$`}
          </GameButton>
        </div>
      ) : null}

      <BingoFinishSheet bingo={bingo} open={finishOpen} onOpenChange={setFinishOpen} />
      {bingo.joinable ? (
        <BingoJoinSheet
          bingo={bingo}
          open={joinOpen}
          onOpenChange={setJoinOpen}
          onJoined={async () => {
            await reload();
            void board.reload();
            // Reminders are what keep a card alive — ask to install right as they commit.
            suggestInstall("joined");
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
          reward={bingo.rewards.perProof}
          closesAt={step.untilLabel === "closes" ? (step.until ?? null) : null}
        />
      ) : null}
      <CheerPrompt contest={cheers.data} onPick={() => document.getElementById("players-list")?.scrollIntoView({ behavior: "smooth" })} />
    </MainPage>
  );
}


