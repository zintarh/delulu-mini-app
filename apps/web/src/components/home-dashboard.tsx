"use client";

import Link from "next/link";
import { Sparkles, Compass } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useUsernameByAddress } from "@/hooks/use-username-by-address";
import { getDailyEncouragement } from "@/lib/daily-encouragement";
import { OngoingMilestonesSection } from "@/components/ongoing-milestones-section";
import { cn } from "@/lib/utils";

function DailyEncouragement() {
  const message = getDailyEncouragement();

  return (
    <div className="relative overflow-hidden rounded-2xl border border-[#f6c324]/40 bg-gradient-to-br from-[#fffbeb] via-card to-card px-4 py-3.5 shadow-sm">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-[#f6c324]/20 blur-2xl"
      />
      <div className="relative flex gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#f6c324]/25 text-[#1a1a19]">
          <Sparkles className="h-4 w-4" strokeWidth={2.5} />
        </span>
        <div className="min-w-0">
          <p
            className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground"
            style={{ fontFamily: "var(--font-manrope)" }}
          >
            Today&apos;s nudge
          </p>
          <p
            className="mt-0.5 text-sm font-semibold leading-snug text-foreground"
            style={{ fontFamily: "var(--font-manrope)" }}
          >
            {message}
          </p>
        </div>
      </div>
    </div>
  );
}

function HomeGuestPrompt() {
  return (
    <div className="mx-auto max-w-md px-4 py-10 text-center">
      <DailyEncouragement />
      <h1
        className="mt-8 text-2xl font-black text-foreground"
        style={{ fontFamily: '"Clash Display", sans-serif' }}
      >
        Track your goals here
      </h1>
      <p
        className="mt-2 text-sm text-muted-foreground leading-relaxed"
        style={{ fontFamily: "var(--font-manrope)" }}
      >
        Sign in to see your active delulus, milestone progress, and submit proof
        from one place.
      </p>
      <div className="mt-6 flex flex-col gap-2.5 sm:flex-row sm:justify-center">
        <Link
          href="/sign-in"
          className="inline-flex items-center justify-center rounded-full bg-[#f6c324] px-6 py-3 text-sm font-black text-[#1a1a19] border-2 border-[#1a1a19] shadow-[3px_3px_0px_0px_#1a1a19] active:translate-x-px active:translate-y-px active:shadow-none"
        >
          Sign in
        </Link>
        <Link
          href="/explore"
          className="inline-flex items-center justify-center gap-1.5 rounded-full border border-border bg-card px-6 py-3 text-sm font-semibold text-foreground hover:bg-muted/50"
        >
          <Compass className="h-4 w-4" />
          Explore delulus
        </Link>
      </div>
    </div>
  );
}

interface HomeDashboardProps {
  className?: string;
  onCreateClick?: () => void;
}

export function HomeDashboard({ className, onCreateClick }: HomeDashboardProps) {
  const { authenticated, address } = useAuth();
  const { username } = useUsernameByAddress(address as `0x${string}` | undefined);

  if (!authenticated) {
    return <HomeGuestPrompt />;
  }

  const greetingName = username ? `@${username}` : "there";

  return (
    <div className={cn("mx-auto w-full max-w-lg", className)}>
      <header className="mb-4 px-4 pt-1">
        <p
          className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground"
          style={{ fontFamily: "var(--font-manrope)" }}
        >
          Your dashboard
        </p>
        <h1
          className="mt-1 text-2xl font-black tracking-tight text-foreground sm:text-[1.65rem]"
          style={{ fontFamily: '"Clash Display", sans-serif' }}
        >
          Hey {greetingName}
        </h1>
      </header>

      <div className="mb-5 px-4">
        <DailyEncouragement />
      </div>

      <OngoingMilestonesSection variant="home" onCreateClick={onCreateClick} />

      <div className="px-4 pb-6 pt-2">
        <Link
          href="/explore"
          className="flex items-center justify-center gap-2 rounded-2xl border border-border/60 bg-muted/30 py-3.5 text-sm font-semibold text-foreground transition-colors hover:bg-muted/50"
        >
          <Compass className="h-4 w-4 text-muted-foreground" />
          Discover other delulus
        </Link>
      </div>
    </div>
  );
}
