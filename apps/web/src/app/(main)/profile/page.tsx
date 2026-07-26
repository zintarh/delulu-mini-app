"use client";
import React, { useState, useEffect, Suspense } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import { useUserStore } from "@/stores/useUserStore";
import { formatAddress, cn } from "@/lib/utils";
import { Copy, Check, Camera, Loader2, Star, Coins } from "lucide-react";
import { usePfpUpload } from "@/hooks/use-pfp-upload";
import { usePfp } from "@/hooks/use-profile-pfp";
import { useUsernameByAddress } from "@/hooks/use-username-by-address";
import { ActiveCampaignsSection } from "@/components/active-campaigns-section";
import { ProfileEndedCampaigns } from "@/components/profile/profile-ended-campaigns";
import { ProfileForfeitSection } from "@/components/profile/profile-forfeit-section";
import { MainPage } from "@/components/main-app-header";
import { useUserTotalPoints } from "@/hooks/graph/useUserPoints";
import {
  formatEarnedUsdt,
  useUserEarnedTotal,
} from "@/hooks/use-earned-totals";
import Link from "next/link";

type TabType = "milestones" | "active" | "ended";

const PROFILE_TABS: { id: TabType; label: string }[] = [
  { id: "milestones", label: "Milestones" },
  { id: "active", label: "Forfeit" },
  { id: "ended", label: "Ended" },
];

export default function ProfilePage() {
  const { isConnected, address, isReady } = useAuth();
  const { user, updateProfile } = useUserStore();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<TabType>("milestones");
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

      <div className="sticky top-0 z-40 border-b border-border bg-background/95 px-4 py-3 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center gap-1 rounded-full border border-border/50 bg-muted/30 p-1">
          {PROFILE_TABS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className={cn(
                "flex-1 rounded-full py-2 text-xs font-bold transition-all sm:text-sm",
                activeTab === id
                  ? "bg-foreground text-background shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
              style={{ fontFamily: "var(--font-manrope)" }}
            >
              {label}
            </button>
          ))}
        </div>
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
                ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-700"
                : "border-rose-500/30 bg-rose-500/15 text-rose-700",
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
  uploadToast,
  setUploadToast,
}: {
  address: string | null | undefined;
  uploadToast: { type: "success" | "error"; message: string } | null;
  setUploadToast: (toast: { type: "success" | "error"; message: string } | null) => void;
}) {
  const { user, updateProfile } = useUserStore();
  const [copied, setCopied] = useState(false);
  const { isUploading: isPfpUploading, upload: uploadPfp, inputRef: pfpInputRef, openPicker: openPfpPicker } = usePfpUpload();
  
  const { username: contractUsername } = useUsernameByAddress(address as `0x${string}` | undefined);
  const displayUsername = contractUsername || null;
  const pfpFromSupabase = usePfp(address);
  const avatarUrl = pfpFromSupabase || user?.pfpUrl || null;
  const { points, isLoading: pointsLoading } = useUserTotalPoints(address ?? undefined);
  const { totalEarned, isLoading: earnedLoading } = useUserEarnedTotal(address ?? undefined);
  const hasEarned = totalEarned > 0;

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
    } catch (err: any) {
      updateProfile({ pfpUrl: previousPfp });
      setUploadToast({
        type: "error",
        message: err?.message ?? "Failed to update profile photo",
      });
    } finally {
      URL.revokeObjectURL(previewUrl);
    }
  };

  const handleCopyAddress = async () => {
    if (!address) return;
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!address) return null;

  return (
    <section className="relative z-30 px-4 pt-6 pb-4">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(120%_60%_at_50%_0%,rgba(252,255,82,0.06),transparent_70%)]"
      />

      <div className="flex flex-col items-center gap-3">
        <div className="relative">
          <button
            type="button"
            onClick={openPfpPicker}
            disabled={isPfpUploading}
            className="relative w-24 h-24 rounded-full flex-shrink-0 bg-muted ring-1 ring-border/60 overflow-hidden group shadow-sm"
          >
            {pfpFromSupabase === undefined && !user?.pfpUrl ? (
              <div className="w-full h-full bg-muted animate-pulse rounded-full" />
            ) : avatarUrl ? (
              <img
                src={avatarUrl}
                alt={displayUsername || formatAddress(address)}
                className="w-full h-full object-cover"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-2xl font-bold bg-muted text-muted-foreground">
                {(displayUsername || address || "?").slice(0, 2).toUpperCase()}
              </div>
            )}
            <div className="absolute inset-0 flex items-center justify-center bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity">
              {isPfpUploading
                ? <Loader2 className="w-5 h-5 text-white animate-spin" />
                : <Camera className="w-5 h-5 text-white" />
              }
            </div>
          </button>
          <button
            type="button"
            onClick={openPfpPicker}
            disabled={isPfpUploading}
            className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-[#35d07f] border-2 border-background flex items-center justify-center shadow"
            aria-label="Change photo"
          >
            <Camera className="w-3.5 h-3.5 text-white" />
          </button>
        </div>
        <input
          ref={pfpInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handlePfpFileChange}
        />

        <div className="text-center">
          <h1
            className="text-2xl font-bold leading-tight capitalize"
          >
            {displayUsername || formatAddress(address)}
          </h1>
          <button
            onClick={handleCopyAddress}
            className="mt-1 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <span className="font-mono">{formatAddress(address)}</span>
            {copied ? (
              <Check className="w-3 h-3 text-[#35d07f]" />
            ) : (
              <Copy className="w-3 h-3" />
            )}
          </button>

          <div className="mt-3 flex items-center justify-center gap-2">
            <div className="flex items-center gap-1.5 rounded-full border border-border/50 bg-card px-3 py-1.5 shadow-sm">
              <Star className="h-3.5 w-3.5 fill-delulu-blue text-delulu-blue" />
              <span className="text-xs font-black tabular-nums text-foreground">
                {pointsLoading ? "—" : points.toLocaleString()}
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                pts
              </span>
            </div>

            <Link
              href="/rewards"
              className={cn(
                "flex items-center gap-1.5 rounded-full px-3 py-1.5 shadow-sm transition-opacity active:opacity-70",
                hasEarned
                  ? "bg-emerald-500/10 text-emerald-700"
                  : "border border-border/50 bg-card text-muted-foreground",
              )}
            >
              <Coins className="h-3.5 w-3.5" />
              <span className="text-xs font-black tabular-nums">
                {earnedLoading ? "—" : formatEarnedUsdt(totalEarned)}
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-wide opacity-70">
                earned
              </span>
            </Link>
          </div>
        </div>
      </div>
    </section>
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
              heading="Active campaigns"
              showMax={10}
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
