"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Circle, Clock, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { useReferralEligibility } from "@/hooks/use-referral-eligibility";
import { MainPage } from "@/components/main-app-header";
import { PageBackHeader } from "@/components/page-back-header";
import { Lulu } from "@/components/ds";
import type { MyReferral, MyReferralSteps } from "@/app/api/referral/my-referrals/route";
import { isReferralCampaignOver, referralCampaignEndLabel } from "@/lib/referral/campaign";

const REFERRAL_GDOLLARS_REWARD = 6000;

const STEPS: { key: keyof MyReferralSteps; label: string; next: string }[] = [
  { key: "signedUp", label: "Signed up", next: "Sign up" },
  { key: "verified", label: "Face verified", next: "Needs face verification" },
  { key: "joined", label: "Joined a campaign", next: "Needs to join a campaign" },
  { key: "proofApproved", label: "Proof approved", next: "Needs an approved proof" },
];

function StatusLine({ r, ended }: { r: MyReferral; ended: boolean }) {
  if (r.counted) {
    return r.payout === "sent" ? (
      <span className="font-bold text-green-edge">
        +{REFERRAL_GDOLLARS_REWARD.toLocaleString()} G$
      </span>
    ) : (
      <span className="font-bold text-foreground">
        {ended ? "Counted · campaign ended" : "Counted · payout pending"}
      </span>
    );
  }
  if (ended) return <span className="font-semibold text-muted-foreground">Campaign ended</span>;
  const next = STEPS.find((s) => !r.steps[s.key]);
  return <span className="font-semibold text-orange">{next?.next}</span>;
}

function ReferralRow({ r, ended }: { r: MyReferral; ended: boolean }) {
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

      <ol className="mt-3 grid grid-cols-4 gap-1.5">
        {STEPS.map(({ key, label }) => {
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
  const { address } = useAuth();
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

  return (
    <MainPage>
      <PageBackHeader
        title="My referrals"
        subtitle={referrals ? `${referrals.length} signed up · ${counted} counted` : undefined}
      />

      <div className="mx-auto max-w-xl space-y-3 px-5 pb-10 pt-3 lg:max-w-4xl xl:max-w-6xl">
        <div
          className={cn(
            "flex items-center gap-2 rounded-[20px] border-2 px-4 py-3 text-sm font-bold",
            ended ? "border-line bg-white text-muted-foreground" : "border-yellow-line bg-yellow-soft text-ink",
          )}
        >
          <Clock className="h-4 w-4 shrink-0" />
          {ended ? "Referral campaign has ended" : `Referral campaign ends ${referralCampaignEndLabel()}`}
        </div>

        {!ended && !isLoadingEligibility && standing?.locked && standing.campaign ? (
          <Link
            href={`/communities/${standing.campaign.slug}/campaigns/${standing.campaign.id}`}
            className="press-edge flex items-center gap-2 rounded-[20px] bg-ink px-4 py-3 text-sm font-bold text-white shadow-edge-ink"
          >
            <Lock className="h-4 w-4 shrink-0" />
            Invites on hold. Post today&apos;s proof →
          </Link>
        ) : !ended && !isLoadingEligibility && !eligible ? (
          <div className="flex items-center gap-2 rounded-[20px] border-2 border-line bg-white px-4 py-3 text-sm font-semibold text-muted-foreground">
            <Lock className="h-4 w-4 shrink-0" />
            Finish your own onboarding for referrals to count on the leaderboard.
          </div>
        ) : null}

        {error ? (
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
              <ReferralRow key={`${r.username ?? "anon"}-${i}`} r={r} ended={ended} />
            ))}
          </ul>
        )}
      </div>
    </MainPage>
  );
}
