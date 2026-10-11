"use client";

import { useEffect, Suspense } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Flame as FlameIcon, Heart, Target, Zap, type LucideIcon } from "lucide-react";
import { MainPage } from "@/components/main-app-header";
import { PageBackHeader } from "@/components/page-back-header";
import { Bolt, Flame, GameCard, HabitTile, HudPill, Lulu, MonoLabel, type HabitTint } from "@/components/ds";
import { WeekFlamesView } from "@/components/home/home-progress";
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

const POINT_ACTIONS: { icon: LucideIcon; label: string; value: number; description: string; tint: HabitTint }[] = [
  { icon: Target, label: "Verified proof", value: POINTS.milestone, description: "Each proof that passes the check", tint: "yellow" },
  { icon: FlameIcon, label: "Keeping a streak", value: POINTS.streak, description: "Back-to-back kept days", tint: "orange" },
  { icon: Zap, label: "Sending a tip", value: POINTS.tipSent, description: "Back someone else's goal", tint: "blue" },
  { icon: Heart, label: "Receiving a tip", value: POINTS.tipReceived, description: "Someone backed yours", tint: "pink" },
];

function getStreakMessage(streak: number): string {
  if (streak === 0) return "Prove one day to light your first flame.";
  if (streak === 1) return "Day one done. Come back tomorrow.";
  if (streak < 7) return "Keep the fire going.";
  if (streak < 14) return "A full week. Nice work.";
  return "Legendary. Keep your word.";
}

export default function StreaksPage() {
  const router = useRouter();
  const { address, authenticated, isReady } = useAuth();

  useEffect(() => {
    if (isReady && !authenticated) router.replace("/sign-in");
  }, [isReady, authenticated, router]);

  return (
    <MainPage>
      <PageBackHeader title="Streak" />
      {isReady && authenticated ? (
        <Suspense fallback={<StreakContentSkeleton />}>
          <StreakContent address={address ?? null} />
        </Suspense>
      ) : (
        <StreakContentSkeleton />
      )}
    </MainPage>
  );
}

function StreakContent({ address }: { address: string | null }) {
  const addr = address ?? undefined;
  const { currentStreak, last7Days, isLoading } = useUserStreak(addr);
  const { myRankEntry } = useAllUsersLeaderboard(0, addr);
  const totalPoints = myRankEntry?.points ?? null;

  return (
    <div className="mx-auto max-w-xl space-y-6 px-5 pb-10 pt-3">
      {isLoading ? (
        <div className="h-[260px] animate-pulse rounded-[20px] bg-line" />
      ) : (
        <GameCard tone={currentStreak > 0 ? "yellow" : "default"} className="flex animate-rise flex-col items-center px-4 pb-5 pt-6 text-center">
          {currentStreak > 0 ? (
            <Flame size={56} className="animate-bob" />
          ) : (
            <Lulu size={56} mood="worried" />
          )}
          <span className="mt-2 font-display text-[64px] font-black leading-none tabular-nums">{currentStreak}</span>
          <MonoLabel className="mt-1">day streak</MonoLabel>
          {totalPoints !== null ? (
            <HudPill className="mt-3 text-sm">
              <Bolt size={16} />
              {totalPoints.toLocaleString()} pts
            </HudPill>
          ) : null}
          <p className="mt-3 text-sm font-semibold text-muted-foreground">{getStreakMessage(currentStreak)}</p>
        </GameCard>
      )}

      <section className="space-y-2.5">
        <MonoLabel>This week</MonoLabel>
        <WeekFlamesView last7Days={last7Days} />
      </section>

      <section className="space-y-2.5">
        <MonoLabel>How points work</MonoLabel>
        {POINT_ACTIONS.map(({ icon, label, value, description, tint }) => (
          <GameCard key={label} className="flex items-center gap-3 p-3">
            <HabitTile icon={icon} tint={tint} size={42} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-extrabold">{label}</p>
              <p className="truncate text-xs text-muted-foreground">{description}</p>
            </div>
            <span className="shrink-0 font-display text-lg font-extrabold tabular-nums">
              +{value.toLocaleString()}
            </span>
          </GameCard>
        ))}
        <p className="pt-1 text-xs leading-relaxed text-muted-foreground">
          Points move you up the{" "}
          <Link href="/leaderboard" className="font-semibold text-ink underline-offset-2 hover:underline">
            leaderboard
          </Link>
          .
        </p>
      </section>
    </div>
  );
}

function StreakContentSkeleton() {
  return (
    <div className="mx-auto max-w-xl space-y-6 px-5 pb-10 pt-3">
      <div className="h-[260px] animate-pulse rounded-[20px] bg-line" />
      <div className="space-y-2.5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-[66px] w-full animate-pulse rounded-[20px] bg-line" />
        ))}
      </div>
    </div>
  );
}
