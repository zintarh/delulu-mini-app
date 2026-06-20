"use client";
import React, { useState, useEffect, useRef, Suspense } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useNavigateToCreate } from "@/hooks/use-navigate-to-create";
import { useRouter } from "next/navigation";
import { useUserStore } from "@/stores/useUserStore";
import { useGraphUserDelulus } from "@/hooks/graph";
import { formatAddress } from "@/lib/utils";
import { Copy, Check, Plus, Camera, Loader2 } from "lucide-react";
import { usePfpUpload } from "@/hooks/use-pfp-upload";
import { usePfp } from "@/hooks/use-profile-pfp";
import { cn } from "@/lib/utils";
import { useUsernameByAddress } from "@/hooks/use-username-by-address";
import { OngoingMilestonesSection } from "@/components/ongoing-milestones-section";
import { ProfileDeluluGrid } from "@/components/profile/profile-delulu-grid";
import { ProfilePageActionsMenu } from "@/components/profile/profile-page-actions-menu";
import { TransferSheet } from "@/components/transfer-sheet";
import { AddEmailSheet } from "@/components/add-email-sheet";

type TabType = "milestones" | "active" | "ended";

const PROFILE_TABS: { id: TabType; label: string }[] = [
  { id: "milestones", label: "Milestones" },
  { id: "active", label: "Active" },
  { id: "ended", label: "Ended" },
];

export default function ProfilePage() {
  const { isConnected, address, isReady } = useAuth();
  const { user, updateProfile } = useUserStore();
  const router = useRouter();
  const { navigateToCreate } = useNavigateToCreate();

  const [activeTab, setActiveTab] = useState<TabType>("milestones");
  const [transferOpen, setTransferOpen] = useState(false);
  const [addEmailOpen, setAddEmailOpen] = useState(false);
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
    <main className="h-screen overflow-y-auto scrollbar-hide bg-background">
      <section className="relative px-4 pt-6 pb-4">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 animate-pulse rounded-full bg-muted/60" />
          <div className="space-y-2">
            <div className="h-4 w-28 animate-pulse rounded bg-muted/60" />
            <div className="h-3 w-20 animate-pulse rounded bg-muted/40" />
          </div>
        </div>
      </section>
      <div className="px-4 space-y-3 pb-24">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-24 w-full animate-pulse rounded-2xl bg-muted/40" />
        ))}
      </div>
    </main>
  );

  return (
    <main className="h-screen overflow-y-auto scrollbar-hide bg-background">
      <ProfileHeader 
        address={address} 
        uploadToast={uploadToast} 
        setUploadToast={setUploadToast}
        setTransferOpen={setTransferOpen}
        setAddEmailOpen={setAddEmailOpen}
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

      <TransferSheet open={transferOpen} onOpenChange={setTransferOpen} />
      <AddEmailSheet open={addEmailOpen} onOpenChange={setAddEmailOpen} />

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
    </main>
  );
}

function ProfileHeader({ 
  address, 
  uploadToast, 
  setUploadToast,
  setTransferOpen,
  setAddEmailOpen,
}: {
  address: string | null | undefined;
  uploadToast: { type: "success" | "error"; message: string } | null;
  setUploadToast: (toast: { type: "success" | "error"; message: string } | null) => void;
  setTransferOpen: (open: boolean) => void;
  setAddEmailOpen: (open: boolean) => void;
}) {
  const { user, updateProfile } = useUserStore();
  const [copied, setCopied] = useState(false);
  const { isUploading: isPfpUploading, upload: uploadPfp, inputRef: pfpInputRef, openPicker: openPfpPicker } = usePfpUpload();
  
  const { username: contractUsername } = useUsernameByAddress(address);
  const displayUsername = contractUsername || null;
  const pfpFromSupabase = usePfp(address);
  const avatarUrl = pfpFromSupabase || user?.pfpUrl || null;
  const email = user?.email ?? null;

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

      <ProfilePageActionsMenu
        className="absolute right-4 top-6"
        address={address}
        displayUsername={displayUsername}
        email={email}
        onTransfer={() => setTransferOpen(true)}
        onAddEmail={() => setAddEmailOpen(true)}
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
            style={{ fontFamily: '"Clash Display", sans-serif' }}
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
        </div>
      </div>
    </section>
  );
}

function ProfileContent({ activeTab, address }: { activeTab: TabType; address: string | null | undefined }) {
  const { navigateToCreate } = useNavigateToCreate();

  const {
    delulus: ongoingDelulus,
    isLoading: isLoadingOngoing,
  } = useGraphUserDelulus("ongoing");

  const {
    delulus,
    isLoading: isLoadingDelulus,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useGraphUserDelulus("past");

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      const el = scrollContainerRef.current;
      if (!el) return;
      const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      if (distanceFromBottom < 200 && hasNextPage && !isFetchingNextPage && !isLoadingDelulus) {
        fetchNextPage();
      }
    };
    const el = scrollContainerRef.current;
    el?.addEventListener("scroll", handleScroll);
    return () => el?.removeEventListener("scroll", handleScroll);
  }, [hasNextPage, isFetchingNextPage, isLoadingDelulus, fetchNextPage]);

  return (
    <div ref={scrollContainerRef}>
      {activeTab === "milestones" && (
        <div className="pb-24 lg:pb-8">
          <OngoingMilestonesSection
            onCreateClick={() => void navigateToCreate()}
          />
        </div>
      )}

      {activeTab === "active" && (
        <div className="mx-auto max-w-6xl px-4 pb-24 pt-6 lg:pb-8">
          <ProfileDeluluGrid
            delulus={ongoingDelulus}
            isLoading={isLoadingOngoing}
            emptyState={
              <div className="flex flex-col items-center py-20 text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
                  <Plus className="h-7 w-7 text-muted-foreground" />
                </div>
                <p
                  className="mb-1 text-lg font-black text-foreground"
                  style={{ fontFamily: '"Clash Display", sans-serif' }}
                >
                  No active delulu
                </p>
                <p
                  className="mb-5 text-sm text-muted-foreground"
                  style={{ fontFamily: "var(--font-manrope)" }}
                >
                  Start manifesting something new.
                </p>
                <button
                  type="button"
                  onClick={() => void navigateToCreate()}
                  className="rounded-full bg-[#FCFF52] px-6 py-2.5 text-sm font-bold text-[#1a1a19] shadow-[3px_3px_0px_0px_#1a1a19] transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_0px_#1a1a19] active:shadow-none"
                  style={{ fontFamily: "var(--font-manrope)" }}
                >
                  Create a delulu
                </button>
              </div>
            }
          />
        </div>
      )}

      {activeTab === "ended" && (
        <div className="mx-auto max-w-6xl px-4 pb-24 pt-6 lg:pb-8">
          <ProfileDeluluGrid
            delulus={delulus}
            isLoading={isLoadingDelulus}
            isFetchingMore={isFetchingNextPage}
            emptyState={
              <div className="flex flex-col items-center py-20 text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
                  <Plus className="h-7 w-7 text-muted-foreground" />
                </div>
                <p
                  className="mb-1 text-lg font-black text-foreground"
                  style={{ fontFamily: '"Clash Display", sans-serif' }}
                >
                  No ended delulu yet
                </p>
                <p
                  className="text-sm text-muted-foreground"
                  style={{ fontFamily: "var(--font-manrope)" }}
                >
                  Ended and resolved delulu will appear here.
                </p>
              </div>
            }
          />
        </div>
      )}
    </div>
  );
}

function ProfileContentSkeleton() {
  return (
    <div className="px-4 space-y-3 pb-24">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="h-32 w-full animate-pulse rounded-2xl bg-muted/40" />
      ))}
    </div>
  );
}
