"use client";

import { useEffect, Suspense } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Flame,
  Sparkles,
  Target,
  Zap,
  Heart,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { useUserStreak } from "@/hooks/useUserStreak";
import { useAllUsersLeaderboard } from "@/hooks/graph/useAllUsersLeaderboard";

// Contract constants (mirrors Delulu-v3.sol)
const POINTS = {
  milestone: 1_000,
  streak: 250,
  tipSent: 50,
  tipReceived: 10,
} as const;

const POINT_ACTIONS = [
  {
    icon: Target,
    label: "Completing a milestone",
    value: POINTS.milestone,
    description: "Verify proof for each step you complete",
    accent: "text-delulu-yellow-reserved",
    bg: "bg-delulu-yellow-reserved/10",
  },
  {
    icon: Flame,
    label: "Keeping a streak",
    value: POINTS.streak,
    description: "Back-to-back milestone completions",
    accent: "text-orange-500",
    bg: "bg-orange-500/10",
  },
  {
    icon: Zap,
    label: "Sending a tip",
    value: POINTS.tipSent,
    description: "Support someone else's goal",
    accent: "text-blue-400",
    bg: "bg-blue-400/10",
  },
  {
    icon: Heart,
    label: "Receiving a tip",
    value: POINTS.tipReceived,
    description: "Others believe in your dream",
    accent: "text-pink-400",
    bg: "bg-pink-400/10",
  },
] as const;

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function getStreakEmoji(streak: number): string {
  if (streak === 0) return "💤";
  if (streak < 3) return "🌱";
  if (streak < 7) return "🔥";
  if (streak < 14) return "⚡";
  return "🏆";
}

function getStreakMessage(streak: number): string {
  if (streak === 0) return "Complete a milestone today to start your streak.";
  if (streak === 1) return "Great start — come back tomorrow to build momentum.";
  if (streak < 3) return "You're getting into the groove. Keep going!";
  if (streak < 7) return "Consistency is your superpower. Don't stop now.";
  if (streak < 14) return "One week strong. You're proving the doubters wrong.";
  return "Legendary. The version of you who set this goal is proud.";
}

function DayDot({ active, label }: { active: boolean; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div
        className={cn(
          "w-8 h-8 rounded-full flex items-center justify-center transition-all",
          active
            ? "bg-delulu-yellow-reserved shadow-[0_0_8px_rgba(246,195,36,0.4)]"
            : "bg-secondary border border-border/50",
        )}
      >
        {active && (
          <Flame className="w-3.5 h-3.5 text-delulu-charcoal" strokeWidth={2.5} />
        )}
      </div>
      <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
        {label}
      </span>
    </div>
  );
}

function StreakSkeleton() {
  return (
    <div className="rounded-2xl border border-border/60 bg-secondary/50 p-6 animate-pulse space-y-4">
      <div className="flex items-center justify-center gap-3">
        <div className="w-20 h-20 rounded-2xl bg-muted" />
      </div>
      <div className="h-4 w-48 mx-auto bg-muted rounded" />
      <div className="flex justify-center gap-3">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="w-8 h-8 rounded-full bg-muted" />
        ))}
      </div>
    </div>
  );
}

export default function StreaksPage() {
  const router = useRouter();
  const { address, authenticated, isReady } = useAuth();

  useEffect(() => {
    if (isReady && !authenticated) router.replace("/sign-in");
  }, [isReady, authenticated, router]);

  if (!isReady || !authenticated) return <StreakSkeleton />;

  return (
    <main className="h-full min-h-0 overflow-y-auto scrollbar-hide bg-background">
      <header className="sticky top-0 z-30 border-b border-border/40 bg-background/95 backdrop-blur-md">
        <div className="mx-auto max-w-2xl px-4 py-4 lg:px-8 lg:py-5">
          <Link
            href="/"
            className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground lg:hidden"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
          <div className="flex items-center gap-2">
            <Flame className="h-5 w-5 text-delulu-yellow-reserved" strokeWidth={2} />
            <h1 className="text-2xl font-black tracking-tight text-foreground lg:text-3xl">
              Streak & Rewards
            </h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Keep completing milestones daily to earn points and climb the board.
          </p>
        </div>
      </header>

      <Suspense fallback={<StreakContentSkeleton />}>
        <StreakContent address={address} />
      </Suspense>
    </main>
  );
}

function StreakContent({ address }: { address: string | null }) {
  const { currentStreak, last7Days, isLoading } = useUserStreak(address);
  const { myRankEntry } = useAllUsersLeaderboard(0, address);
  const totalPoints = myRankEntry?.points ?? null;

  // Last 7 day labels aligned to today = Sunday/Monday/etc.
  const todayIdx = new Date().getDay(); // 0=Sun ... 6=Sat
  const last7Labels = Array.from({ length: 7 }, (_, i) => {
    const dayIdx = ((todayIdx - 6 + i) % 7 + 7) % 7;
    return DAY_LABELS[dayIdx === 0 ? 6 : dayIdx - 1] ?? DAY_LABELS[i];
  });

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 pb-24 lg:px-8 lg:py-8 lg:pb-10 space-y-6">

      {/* ── Streak Display ─────────────────────────────────── */}
      {isLoading ? (
        <StreakSkeleton />
      ) : (
        <div className="rounded-2xl border border-border/60 bg-secondary/50 p-6">
          {/* Big streak number + badge */}
          <div className="flex flex-col items-center gap-1 mb-6">
            <div className="relative flex items-end gap-3">
              <span className="text-[72px] font-black leading-none tabular-nums text-foreground">
                {currentStreak}
              </span>
              <div className="mb-3 flex flex-col items-start">
                <span className="text-4xl leading-none">
                  {getStreakEmoji(currentStreak)}
                </span>
                <span className="text-base font-bold text-muted-foreground">
                  day streak
                </span>
              </div>
            </div>

            {totalPoints !== null && (
              <div className="flex items-center gap-1.5 rounded-full border border-delulu-yellow-reserved/30 bg-delulu-yellow-reserved/10 px-3 py-1">
                <Sparkles className="w-3.5 h-3.5 text-delulu-yellow-reserved" strokeWidth={2} />
                <span className="text-xs font-bold text-delulu-yellow-reserved tabular-nums">
                  {totalPoints.toLocaleString()} total points
                </span>
              </div>
            )}
          </div>

          {/* Last 7 days */}
          <div className="flex items-end justify-between gap-1 px-1 mb-5">
            {last7Days.map((active, i) => (
              <DayDot key={i} active={active} label={last7Labels[i] ?? ""} />
            ))}
          </div>

          {/* Motivational line */}
          <p className="text-center text-sm font-medium text-muted-foreground leading-relaxed">
            {getStreakMessage(currentStreak)}
          </p>
        </div>
      )}

      {/* ── How Points Work ────────────────────────────────── */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="h-4 w-4 text-muted-foreground" strokeWidth={2} />
          <h2 className="text-sm font-bold text-foreground uppercase tracking-wider">
            How points work
          </h2>
        </div>

        <div className="space-y-2">
          {POINT_ACTIONS.map(({ icon: Icon, label, value, description, accent, bg }) => (
            <div
              key={label}
              className="flex items-center gap-4 rounded-xl border border-border/60 bg-background p-4"
            >
              <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", bg)}>
                <Icon className={cn("h-5 w-5", accent)} strokeWidth={2} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground">{label}</p>
                <p className="text-xs text-muted-foreground">{description}</p>
              </div>
              <span className="shrink-0 text-sm font-black tabular-nums text-foreground">
                +{value.toLocaleString()}
                <span className="ml-1 text-xs font-semibold text-muted-foreground">pts</span>
              </span>
            </div>
          ))}
        </div>

        <p className="mt-4 rounded-xl border border-border/40 bg-secondary/40 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
          Points reflect your progress on the{" "}
          <Link href="/leaderboard" className="font-semibold text-foreground hover:underline">
            Dreamers leaderboard
          </Link>{" "}
          and convert into G$ rewards through campaigns. The more you complete, the more you earn.
        </p>
      </div>

    </div>
  );
}

function StreakContentSkeleton() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-6 pb-24 lg:px-8 lg:py-8 lg:pb-10 space-y-6">
      <StreakSkeleton />
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-14 w-full animate-pulse rounded-xl bg-secondary" />
        ))}
      </div>
    </div>
  );
}
