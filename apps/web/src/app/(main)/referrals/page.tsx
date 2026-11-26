"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Circle, Clock, Hourglass, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { useReferralSlots } from "@/hooks/use-referral-slots";
import { slotsLine } from "@/lib/referral/slots-copy";
import { useAuth } from "@/hooks/use-auth";
import { useReferralEligibility } from "@/hooks/use-referral-eligibility";
import { MainPage } from "@/components/main-app-header";
import { PageBackHeader } from "@/components/page-back-header";
import { Lulu, gameButtonClass } from "@/components/ds";
import { buildSignInUrl, persistSignInRedirect } from "@/lib/auth-redirect";
import type { MyReferral, MyReferralSteps } from "@/app/api/referral/my-referrals/route";
import { REFERRAL_PAUSE_COPY, referralRewardNow, isInCurrentReferralCampaign, isReferralCampaignOver, isReferralPaused, referralCampaignEndLabel, currentReferralRound, roundFirstPayment, roundHasStreakBonus, REFERRAL_ROUNDS } from "@/lib/referral/campaign";


const STEPS: { key: keyof MyReferralSteps; label: string; next: string }[] = [
  { key: "signedUp", label: "Signed up", next: "Sign up" },
  { key: "verified", label: "Face verified", next: "Needs face verification" },
  { key: "joined", label: "Staked G$", next: "Needs to stake G$ on a Bingo" },
  { key: "proofApproved", label: "Earned 1,000 points", next: "Needs 1,000 points from proofs" },
  { key: "streak3", label: "3 days in a row", next: "Needs 3 days in a row" },
];

function StatusLine({ r, ended }: { r: MyReferral; ended: boolean }) {
  if (r.counted) {
    return r.payout === "sent" ? (
      <span className="font-bold text-green-edge">
        +{(r.amount ?? referralRewardNow()).toLocaleString()} G$
        {r.bonus ? (
          r.bonus.paid ? (
            <> · +{r.bonus.amount.toLocaleString()} G$</>
          ) : (
            <span className="font-semibold text-muted-foreground"> · +{r.bonus.amount.toLocaleString()} at 3 days in a row</span>
          )
        ) : null}
      </span>
    ) : (
      <span className="font-bold text-foreground">
        {ended ? "Counted · referrals ended" : "Counted · payout pending"}
      </span>
    );
  }
  if (ended) return <span className="font-semibold text-muted-foreground">Referrals ended</span>;
  if (r.closed) return <span className="font-semibold text-muted-foreground">Doesn&apos;t count · joined before this round</span>;
  const next = STEPS.find((s) => !r.steps[s.key]);
  return <span className="font-semibold text-orange">{next?.next}</span>;
}

function ReferralRow({ r, ended }: { r: MyReferral; ended: boolean }) {
  // The 3-day step only matters when this friend's reward has a streak part
  // (round 1 credits); from round 2 the whole reward lands on qualify.
  const showStreak = r.counted ? !!r.bonus : roundHasStreakBonus(currentReferralRound());
  const steps = showStreak ? STEPS : STEPS.filter((s) => s.key !== "streak3");
  return (
    <li className="rounded-[20px] border-2 border-line bg-white p-4 shadow-edge">
      <div className="flex items-center gap-3">
        {r.pfpUrl ? (
          <img src={r.pfpUrl} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" />
        ) : (
          <div className="h-10 w-10 shrink-0 rounded-full bg-line" />
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-extrabold text-foreground">
            {r.username ? `@${r.username}` : "No username yet"}
          </p>
          <p className="text-xs">
            <StatusLine r={r} ended={ended} />
          </p>
        </div>
      </div>

      <ol className={cn("mt-3 grid gap-1.5", showStreak ? "grid-cols-5" : "grid-cols-4")}>
        {steps.map(({ key, label }) => {
          const done = r.steps[key];
          return (
            <li
              key={key}
              className={cn(
                "flex flex-col items-center gap-1 rounded-xl px-1 py-2 text-center text-[10px] font-semibold leading-tight",
                done ? "bg-green-soft text-green-edge" : "bg-paper text-muted-foreground",
              )}
            >
              {done ? (
                <CheckCircle2 className="h-4 w-4" strokeWidth={2} />
              ) : (
                <Circle className="h-4 w-4" strokeWidth={2} />
              )}
              {label}
            </li>
          );
        })}
      </ol>
    </li>
  );
}

export default function MyReferralsPage() {
  const { address, isReady } = useAuth();
  // Signed out: no list to load — show how to get a link instead of placeholders that never fill.
  const guest = isReady && !address;
  const { eligible, standing, isLoading: isLoadingEligibility } = useReferralEligibility(address);
  const [referrals, setReferrals] = useState<MyReferral[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!address) return;
    let cancelled = false;
    setReferrals(null);
    setError(false);
    void (async () => {
      try {
        const res = await fetch(`/api/referral/my-referrals?address=${address}`);
        if (!res.ok) throw new Error(String(res.status));
        const json = (await res.json()) as { referrals: MyReferral[] };
        if (!cancelled) setReferrals(json.referrals);
      } catch {
        if (!cancelled) setError(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [address]);

  const counted = (referrals ?? []).filter((r) => r.counted).length;
  const ended = isReferralCampaignOver();
  const paused = isReferralPaused();
  const round = currentReferralRound();
  const slots = useReferralSlots(!ended);
  const roundNumber = round ? REFERRAL_ROUNDS.findIndex((r) => r.start === round.start) + 1 : 0;

  return (
    <MainPage>
      <PageBackHeader
        title="My referrals"
        subtitle={referrals ? `${referrals.length} signed up · ${counted} counted` : undefined}
      />

      <div className="mx-auto max-w-3xl space-y-3 px-5 pb-10 pt-3 xl:max-w-3xl">
        <div
          className={cn(
            "flex items-center gap-2 rounded-[20px] border-2 px-4 py-3 text-sm font-bold",
            ended ? "border-line bg-white text-muted-foreground" : "border-yellow-line bg-yellow-soft text-ink",
          )}
        >
          <Clock className="h-4 w-4 shrink-0" />
          {paused ? (
            REFERRAL_PAUSE_COPY
          ) : ended ? (
            "Referrals have ended"
          ) : (
            // Urgency from scarcity, not an end date: spots left this round, and they refresh weekly.
            <span className="min-w-0">
              <span className="block">
                Round {roundNumber}
                {slots?.live && slots.slots > 0 ? ` · ${slots.left.toLocaleString("en-US")} of ${slots.slots.toLocaleString("en-US")} spots left` : ""}
              </span>
              <span className="block text-[12px] font-semibold text-muted-foreground">
                This round closes {referralCampaignEndLabel()} · fresh spots every Tuesday, first come first served
              </span>
            </span>
          )}
        </div>

        {/* How a referral pays — the same split each friend's row tracks below. */}
        {!ended && !paused && round && roundHasStreakBonus(round) ? (
          <div className="rounded-[20px] border-2 border-ink bg-white p-4 shadow-[0_3px_0_#000]">
            <p className="label-mono m-0 text-[10px] text-muted-foreground">How you get paid · {round.reward.toLocaleString()} G$ per friend</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <div className="rounded-2xl bg-green-soft px-3 py-2.5">
                <p className="m-0 font-display text-[22px] font-extrabold leading-none text-green-edge">+{roundFirstPayment(round).toLocaleString()}</p>
                <p className="m-0 mt-1 text-[11px] font-semibold leading-snug">When they verify, stake and earn 1,000 points</p>
              </div>
              <div className="rounded-2xl bg-yellow-soft px-3 py-2.5">
                <p className="m-0 font-display text-[22px] font-extrabold leading-none">+{(round.reward - roundFirstPayment(round)).toLocaleString()}</p>
                <p className="m-0 mt-1 text-[11px] font-semibold leading-snug">When they show up 3 days in a row</p>
              </div>
            </div>
            {slotsLine(slots) ? (
              <p className={cn("m-0 mt-2 text-[12px] font-extrabold", slots && slots.left === 0 ? "text-orange" : "text-ink")}>{slotsLine(slots)} this round</p>
            ) : null}
            <p className="m-0 mt-1 text-[11px] font-semibold text-muted-foreground">Nudge your friends to keep going — the bigger part comes at day 3.</p>
          </div>
        ) : !ended && !paused && round ? (
          <div className="rounded-[20px] border-2 border-ink bg-white p-4 shadow-[0_3px_0_#000]">
            <div className="rounded-2xl bg-green-soft px-3 py-2.5">
              <p className="m-0 font-display text-[22px] font-extrabold leading-none text-green-edge">+{round.reward.toLocaleString()} G$</p>
              <p className="m-0 mt-1 text-[11px] font-semibold leading-snug">Per friend · once they verify, stake G$ and earn 1,000 points</p>
            </div>
            {slotsLine(slots) ? (
              <p className={cn("m-0 mt-2 text-[12px] font-extrabold", slots && slots.left === 0 ? "text-orange" : "text-ink")}>{slotsLine(slots)} this round</p>
            ) : null}
          </div>
        ) : null}

        {!ended && !paused && !isLoadingEligibility && standing?.locked && standing.campaign ? (
          <Link
            href={`/communities/${standing.campaign.slug}/campaigns/${standing.campaign.id}`}
            className="press-edge flex items-center gap-2 rounded-[20px] bg-ink px-4 py-3 text-sm font-bold text-white shadow-edge-ink"
          >
            <Hourglass className="h-4 w-4 shrink-0" />
            Payouts waiting. Post today&apos;s proof to get paid →
          </Link>
        ) : address && !ended && !paused && !isLoadingEligibility && !eligible ? (
          <div className="flex items-center gap-2 rounded-[20px] border-2 border-line bg-white px-4 py-3 text-sm font-semibold text-muted-foreground">
            <Lock className="h-4 w-4 shrink-0" />
            Finish your own onboarding for referrals to count on the leaderboard.
          </div>
        ) : null}

        {guest ? (
          <div className="flex flex-col items-center rounded-[20px] border-2 border-line bg-white px-5 py-8 text-center">
            <Lulu size={64} mood="kept" />
            <p className="m-0 mt-3 text-[15px] font-extrabold">Sign in to get your invite link</p>
            <p className="m-0 mt-1 text-[13px] font-semibold text-muted-foreground">Friends you invite show up here.</p>
            <Link
              href={buildSignInUrl("/referrals")}
              onClick={() => persistSignInRedirect("/referrals")}
              className={cn(gameButtonClass({ full: true }), "mt-4 no-underline")}
            >
              Sign in
            </Link>
          </div>
        ) : error ? (
          <p className="py-16 text-center text-sm text-muted-foreground">
            Couldn&apos;t load your referrals. Try again.
          </p>
        ) : !referrals ? (
          <ul className="space-y-3">
            {[1, 2, 3].map((i) => (
              <li key={i} className="h-[124px] animate-pulse rounded-[20px] bg-line" />
            ))}
          </ul>
        ) : referrals.length === 0 ? (
          <div className="flex flex-col items-center py-14 text-center">
            <Lulu size={64} mood="dream" />
            <p className="mt-3 text-sm font-semibold text-muted-foreground">No one has signed up with your link yet.</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {referrals.map((r, i) => (
              <ReferralRow
                key={`${r.username ?? "anon"}-${i}`}
                r={r}
                // A friend from a previous campaign is closed even while a new one runs.
                ended={ended || !isInCurrentReferralCampaign(r.joinedAt)}
              />
            ))}
          </ul>
        )}
      </div>
    </MainPage>
  );
}
