"use client";
import React, { useState, useEffect, Suspense } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import { useUserStore } from "@/stores/useUserStore";
import { formatAddress, cn } from "@/lib/utils";
import { Camera, Loader2, Settings, Share } from "lucide-react";
import { usePfpUpload } from "@/hooks/use-pfp-upload";
import { usePfp } from "@/hooks/use-profile-pfp";
import { useUsernameByAddress } from "@/hooks/use-username-by-address";
import { ActiveCampaignsSection } from "@/components/active-campaigns-section";
import { ProfileEndedCampaigns } from "@/components/profile/profile-ended-campaigns";
import { ProfileForfeitSection } from "@/components/profile/profile-forfeit-section";
import { MainPage } from "@/components/main-app-header";
import { useUserTotalPoints } from "@/hooks/graph/useUserPoints";
import Link from "next/link";
import { UserAvatar } from "@/components/ui/user-avatar";
import { useUserStreak } from "@/hooks/useUserStreak";
import { useAllUsersLeaderboard } from "@/hooks/graph/useAllUsersLeaderboard";
import { formatCompact, getLevel, levelTitle } from "@/lib/levels";
import { useCreatorForfeits } from "@/hooks/use-creator-forfeits";
import { Bolt, CheckDot, Flame, GameCard, GameLink, Medal, ProgressBar, Segmented, Trophy } from "@/components/ds";

type TabType = "milestones" | "active" | "ended";

const PROFILE_TABS: { value: TabType; label: string }[] = [
  { value: "active", label: "Contracts" },
  { value: "milestones", label: "Campaigns" },
  { value: "ended", label: "Ended" },
];

export default function ProfilePage() {
  const { isConnected, address, isReady } = useAuth();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<TabType>("active");
  const [uploadToast, setUploadToast] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  useEffect(() => {
    if (isReady && !isConnected) router.replace("/sign-in");
  }, [isReady, isConnected, router]);

  useEffect(() => {
    if (!uploadToast) return;
    const timer = setTimeout(() => setUploadToast(null), 2500);
    return () => clearTimeout(timer);
  }, [uploadToast]);

  if (!isReady || !isConnected) return (
    <MainPage>
      <section className="relative px-4 pt-6 pb-4">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 animate-pulse rounded-full bg-muted/60" />
          <div className="space-y-2">
            <div className="h-4 w-28 animate-pulse rounded bg-muted/60" />
            <div className="h-3 w-20 animate-pulse rounded bg-muted/40" />
          </div>
        </div>
      </section>
      <div className="px-4 space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-24 w-full animate-pulse rounded-2xl bg-muted/40" />
        ))}
      </div>
    </MainPage>
  );

  return (
    <MainPage>
      <ProfileHeader
        address={address}
        uploadToast={uploadToast}
        setUploadToast={setUploadToast}
      />

      <div className="sticky top-0 z-40 mx-auto max-w-xl bg-paper/95 px-5 py-3 backdrop-blur-sm">
        <Segmented<TabType> ariaLabel="Profile sections" value={activeTab} onChange={setActiveTab} options={PROFILE_TABS} />
      </div>

      <Suspense fallback={<ProfileContentSkeleton />}>
        <ProfileContent activeTab={activeTab} address={address} />
      </Suspense>

      {uploadToast && (
        <div className="fixed bottom-24 left-1/2 z-[120] -translate-x-1/2">
          <div
            className={cn(
              "rounded-full border px-4 py-2 text-xs font-semibold shadow-lg",
              uploadToast.type === "success"
                ? "border-green-line bg-green-soft text-green-edge"
                : "border-orange/30 bg-orange-soft text-orange",
            )}
          >
            {uploadToast.message}
          </div>
        </div>
      )}
    </MainPage>
  );
}

function ProfileHeader({
  address,
  setUploadToast,
}: {
  address: string | null | undefined;
  uploadToast: { type: "success" | "error"; message: string } | null;
  setUploadToast: (_toast: { type: "success" | "error"; message: string } | null) => void;
}) {
  const { user, updateProfile } = useUserStore();
  const { isUploading: isPfpUploading, upload: uploadPfp, inputRef: pfpInputRef, openPicker: openPfpPicker } = usePfpUpload();

  // profiles.username (Supabase, set during /welcome) is the source of truth;
  // on-chain username is only a fallback for legacy accounts.
  const { username: contractUsername } = useUsernameByAddress(address as `0x${string}` | undefined);
  const displayUsername = user?.username || contractUsername || null;
  const pfpFromSupabase = usePfp(address);
  // undefined while loading (skeleton), null when no photo is set (initials).
  const avatarUrl = pfpFromSupabase ?? user?.pfpUrl ?? pfpFromSupabase;
  const { points, isLoading: pointsLoading } = useUserTotalPoints(address ?? undefined);
  const { currentStreak, totalVerified } = useUserStreak(address ?? undefined);
  const { data: forfeits } = useCreatorForfeits(address ?? undefined);
  // Days kept across every contract (proof in and not rejected), plus legacy milestone proofs.
  const keptDays =
    totalVerified +
    (forfeits ?? []).reduce(
      (n, f) =>
        n +
        (f.periods ?? []).filter((p) => p.proofUrl && p.verifierAction !== "rejected" && p.verifierAction !== "timed_out").length,
      0,
    );
  const { myRankEntry } = useAllUsersLeaderboard(0, address ?? undefined);
  const lvl = getLevel(points ?? 0);

  const handlePfpFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    const previousPfp = user?.pfpUrl;
    const previewUrl = URL.createObjectURL(file);
    updateProfile({ pfpUrl: previewUrl });

    try {
      await uploadPfp(file);
      setUploadToast({ type: "success", message: "Profile photo updated" });
    } catch (err: unknown) {
      updateProfile({ pfpUrl: previousPfp });
      setUploadToast({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to update profile photo",
      });
    } finally {
      URL.revokeObjectURL(previewUrl);
    }
  };

  if (!address) return null;

  // Ring around the avatar shows progress to the next level.
  const R = 42;
  const C = 2 * Math.PI * R;

  const badges = [
    { label: "1ST", name: "First", bg: "#FDF1C7", edge: "#E5B41C", earned: keptDays >= 1 || (points ?? 0) > 0 },
    { label: "7D", name: "Bronze", bg: "#FFD9BF", edge: "#E0915A", earned: currentStreak >= 7 },
    { label: "10", name: "10 proofs", bg: "#C9EBD7", edge: "#7CC49C", earned: keptDays >= 10 },
    { label: "1K", name: "1K pts", bg: "#D3E2FF", edge: "#8DB0EE", earned: (points ?? 0) >= 1000 },
    { label: "14D", name: "Gold 14d", bg: "#F6C324", edge: "#C99A0A", earned: currentStreak >= 14 },
    { label: "30D", name: "30 days", bg: "#F2B48A", edge: "#C98352", earned: currentStreak >= 30 },
    { label: "100", name: "100", bg: "#C9EBD7", edge: "#7CC49C", earned: keptDays >= 100 },
    { label: "10K", name: "10K pts", bg: "#EEE7FE", edge: "#B9A3F2", earned: (points ?? 0) >= 10000 },
  ];
  const earnedCount = badges.filter((b) => b.earned).length;

  return (
    <section className="mx-auto max-w-xl px-5 pb-2 pt-4">
      <div className="flex justify-end gap-2">
        <Link href="/profile/flex" aria-label="Share flex card" className="press-edge flex h-11 w-11 items-center justify-center rounded-full border-2 border-line bg-white shadow-edge-sm">
          <Share className="h-5 w-5" strokeWidth={2} />
        </Link>
        <Link href="/settings" aria-label="Settings" className="press-edge flex h-11 w-11 items-center justify-center rounded-full border-2 border-line bg-white shadow-edge-sm">
          <Settings className="h-5 w-5" strokeWidth={2} />
        </Link>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative h-[92px] w-[92px] shrink-0 animate-bounce-in">
          <svg width="92" height="92" viewBox="0 0 92 92" className="absolute inset-0 -rotate-90" aria-hidden>
            <circle cx="46" cy="46" r={R} fill="none" stroke="#E6E6E0" strokeWidth="6" />
            <circle
              cx="46"
              cy="46"
              r={R}
              fill="none"
              stroke="#F6C324"
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={C}
              strokeDashoffset={C * (1 - lvl.progress)}
            />
          </svg>
          <button
            type="button"
            onClick={openPfpPicker}
            disabled={isPfpUploading}
            aria-label="Change photo"
            className="group absolute inset-[10px] overflow-hidden rounded-full bg-yellow-soft"
          >
            <UserAvatar address={address} username={displayUsername} pfpUrl={avatarUrl} size={72} />
            <span className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
              {isPfpUploading ? <Loader2 className="h-5 w-5 animate-spin text-white" /> : <Camera className="h-5 w-5 text-white" />}
            </span>
          </button>
          <span className="absolute -bottom-2 left-1/2 flex h-[22px] -translate-x-1/2 items-center justify-center whitespace-nowrap rounded-lg border-2 border-white bg-blue px-2 text-[11px] font-extrabold text-white">
            Lv {lvl.level}
          </span>
        </div>
        <input ref={pfpInputRef} type="file" accept="image/*" className="hidden" onChange={handlePfpFileChange} />

        <div className="min-w-0 flex-1">
          <h1 className="m-0 truncate text-2xl font-bold leading-[1.2] tracking-[-0.02em]">
            {user?.displayName || displayUsername || formatAddress(address)}
          </h1>
          <div className="label-mono mt-1 truncate text-[10px] text-muted-foreground">
            {displayUsername ? `@${displayUsername}` : formatAddress(address)} · {levelTitle(lvl.level)}
          </div>
          <ProgressBar value={lvl.progress} tone="blue" className="mt-2.5 h-3" label="Progress to next level" />
          <div className="label-mono mt-[5px] text-[9px] text-ink">
            {pointsLoading ? "—" : `${formatCompact(points ?? 0)} / ${formatCompact(lvl.next)} pts`}
          </div>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-2.5">
        <StatTile icon={<Flame size={30} />} value={String(currentStreak)} label="Day streak" />
        <StatTile icon={<CheckDot size={30} className="shadow-none" />} value={String(keptDays)} label="Kept" />
        <StatTile icon={<Bolt size={30} />} value={pointsLoading ? "—" : formatCompact(points ?? 0)} label="Total points" />
        <Link href="/leaderboard" className="no-underline">
          <StatTile icon={<Trophy size={30} />} value={myRankEntry ? `#${myRankEntry.rank}` : "—"} label="Global rank" />
        </Link>
      </div>

      <GameLink href="/profile/flex" full className="mt-4">
        <Share className="h-[18px] w-[18px]" strokeWidth={2.4} />
        Flex your streak
      </GameLink>

      <div className="mt-6">
        <div className="mb-3.5 flex justify-between">
          <span className="label-mono text-muted-foreground">Badges</span>
          <span className="label-mono text-ink">
            {earnedCount} / {badges.length}
          </span>
        </div>
        <div className="grid grid-cols-4 gap-y-3.5">
          {badges.map((b) => (
            <div key={b.name} className="flex flex-col items-center gap-2">
              {b.earned ? <Medal label={b.label} bg={b.bg} edge={b.edge} /> : <Medal locked />}
              <span className={cn("label-mono text-[9px]", b.earned ? "text-ink" : "text-muted-foreground")}>{b.name}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function StatTile({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <GameCard className="flex items-center gap-2.5 px-3.5 py-3">
      {icon}
      <div className="min-w-0">
        <div className="truncate font-display text-[26px] font-extrabold uppercase leading-none text-ink">{value}</div>
        <div className="label-mono mt-[3px] text-[9px] text-muted-foreground">{label}</div>
      </div>
    </GameCard>
  );
}

function ProfileContent({ activeTab, address }: { activeTab: TabType; address: string | null | undefined }) {
  return (
    <div>
      {activeTab === "milestones" && (
        <div className="mx-auto max-w-xl px-4 pb-6 pt-6 lg:pb-8">
          {address ? (
            <ActiveCampaignsSection
              address={address}
              showMax={10}
              showSeeAll={false}
              showEmpty
            />
          ) : (
            <div className="flex flex-col items-center py-20 text-center">
              <p className="text-sm text-muted-foreground">
                Connect your wallet to see campaign milestones.
              </p>
            </div>
          )}
        </div>
      )}

      {activeTab === "active" && (
        <div className="mx-auto max-w-xl px-4 pb-6 pt-6 lg:pb-8">
          {address ? (
            <ProfileForfeitSection address={address} />
          ) : (
            <div className="flex flex-col items-center py-20 text-center">
              <p className="text-sm text-muted-foreground">
                Connect your wallet to create a forfeit.
              </p>
            </div>
          )}
        </div>
      )}

      {activeTab === "ended" && (
        <div className="mx-auto max-w-6xl px-4 pb-6 pt-6 lg:pb-8">
          {address ? (
            <ProfileEndedCampaigns address={address} />
          ) : (
            <div className="flex flex-col items-center py-20 text-center">
              <p className="text-sm text-muted-foreground">Connect your wallet to see ended campaigns.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ProfileContentSkeleton() {
  return (
    <div className="px-4 space-y-3 pb-6">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="h-32 w-full animate-pulse rounded-2xl bg-muted/40" />
      ))}
    </div>
  );
}
