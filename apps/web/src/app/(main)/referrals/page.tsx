"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Circle, Lock, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { useReferralEligibility } from "@/hooks/use-referral-eligibility";
import { MainPage } from "@/components/main-app-header";
import type { MyReferral, MyReferralSteps } from "@/app/api/referral/my-referrals/route";

const REFERRAL_GDOLLARS_REWARD = 6000;

const STEPS: { key: keyof MyReferralSteps; label: string; next: string }[] = [
  { key: "signedUp", label: "Signed up", next: "Sign up" },
  { key: "verified", label: "Face verified", next: "Needs face verification" },
  { key: "joined", label: "Joined a campaign", next: "Needs to join a campaign" },
  { key: "proofApproved", label: "Proof approved", next: "Needs an approved proof" },
];

function StatusLine({ r }: { r: MyReferral }) {
  if (r.counted) {
    return r.payout === "sent" ? (
      <span className="font-bold text-delulu-green">
        +{REFERRAL_GDOLLARS_REWARD.toLocaleString()} G$
      </span>
    ) : (
      <span className="font-bold text-foreground">Counted · payout pending</span>
    );
  }
  const next = STEPS.find((s) => !r.steps[s.key]);
  return <span className="font-semibold text-orange-600 dark:text-orange-400">{next?.next}</span>;
}

function ReferralRow({ r }: { r: MyReferral }) {
  return (
    <li className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
      <div className="flex items-center gap-3">
        {r.pfpUrl ? (
          <img src={r.pfpUrl} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" />
        ) : (
          <div className="h-10 w-10 shrink-0 rounded-full bg-muted" />
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-black text-foreground">
            {r.username ? `@${r.username}` : "No username yet"}
          </p>
          <p className="text-xs">
            <StatusLine r={r} />
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
                done ? "bg-delulu-green/10 text-delulu-green" : "bg-muted text-muted-foreground",
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

  return (
    <MainPage>
      <header className="sticky top-0 z-30 border-b border-border/40 bg-background/95 backdrop-blur-md">
        <div className="mx-auto max-w-2xl px-4 py-4 lg:px-8 lg:py-5">
          <Link
            href="/profile"
            className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground lg:hidden"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-foreground" strokeWidth={2} />
            <h1 className="text-2xl font-black tracking-tight text-foreground lg:text-3xl">
              My referrals
            </h1>
          </div>
          {referrals ? (
            <p className="mt-1 text-sm text-muted-foreground">
              {referrals.length} signed up · {counted} counted
            </p>
          ) : null}
        </div>
      </header>

      <div className="mx-auto max-w-2xl space-y-3 px-4 py-5 lg:px-8">
        {!isLoadingEligibility && standing?.locked && standing.campaign ? (
          <Link
            href={`/communities/${standing.campaign.slug}/campaigns/${standing.campaign.id}`}
            className="flex items-center gap-2 rounded-2xl bg-foreground px-4 py-3 text-sm font-bold text-background"
          >
            <Lock className="h-4 w-4 shrink-0" />
            Invites on hold. Post today&apos;s proof →
          </Link>
        ) : !isLoadingEligibility && !eligible ? (
          <div className="flex items-center gap-2 rounded-2xl bg-muted px-4 py-3 text-sm font-semibold text-muted-foreground">
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
              <li key={i} className="h-[124px] animate-pulse rounded-2xl bg-muted" />
            ))}
          </ul>
        ) : referrals.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted-foreground">
            No one has signed up with your link yet.
          </p>
        ) : (
          <ul className="space-y-3">
            {referrals.map((r, i) => (
              <ReferralRow key={`${r.username ?? "anon"}-${i}`} r={r} />
            ))}
          </ul>
        )}
      </div>
    </MainPage>
  );
}
