"use client";
import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useUserStore } from "@/stores/useUserStore";
import { useGraphUserDelulus } from "@/hooks/graph";
import { formatAddress } from "@/lib/utils";
import {
  Settings as SettingsIcon,
  Copy,
  Check,
  Plus,
  Camera,
  Loader2,
  ChevronRight,
  ArrowRightLeft,
  User as UserIcon,
} from "lucide-react";
import { usePfpUpload } from "@/hooks/use-pfp-upload";
import { usePfp } from "@/hooks/use-profile-pfp";
import { DeluluCard } from "@/components/delulu-card";
import { BottomNav } from "@/components/bottom-nav";
import { LeftSidebar } from "@/components/left-sidebar";
import { RightSidebar } from "@/components/right-sidebar";
import { cn } from "@/lib/utils";
import { useUsernameByAddress } from "@/hooks/use-username-by-address";
import { OngoingMilestonesSection } from "@/components/ongoing-milestones-section";
import { TransferSheet } from "@/components/transfer-sheet";
import { AddEmailSheet } from "@/components/add-email-sheet";

type TabType = "milestones" | "active" | "ended";

export default function ProfilePage() {
  const { isConnected, address } = useAuth();
  const { user, updateProfile } = useUserStore();
  const router = useRouter();

  const handleProfileClick = () => {};
  const handleCreateClick = () => {
    if (!isConnected) router.push("/sign-in");
    else router.push("/board");
  };

  const [activeTab, setActiveTab] = useState<TabType>("milestones");
  const [copied, setCopied] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [addEmailOpen, setAddEmailOpen] = useState(false);
  const [profileExpanded, setProfileExpanded] = useState(false);

  const { isUploading: isPfpUploading, upload: uploadPfp, inputRef: pfpInputRef, openPicker: openPfpPicker } = usePfpUpload();
  const [uploadToast, setUploadToast] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const { username: contractUsername } = useUsernameByAddress(address);
  const displayUsername = contractUsername || null;
  const pfpFromSupabase = usePfp(address);
  const avatarUrl = (pfpFromSupabase !== undefined ? pfpFromSupabase : user?.pfpUrl) || null;

  const email = user?.email ?? null;

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

  useEffect(() => {
    if (!isConnected) router.replace("/sign-in");
  }, [isConnected, router]);

  useEffect(() => {
    if (!uploadToast) return;
    const timer = setTimeout(() => setUploadToast(null), 2500);
    return () => clearTimeout(timer);
  }, [uploadToast]);

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

  return (
    <div className="h-screen overflow-hidden">
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-[250px_1fr_320px] h-screen">

        {/* ── Left sidebar ───────────────────────────────────────── */}
        <div className="hidden lg:block">
          <LeftSidebar
            onProfileClick={handleProfileClick}
            onCreateClick={handleCreateClick}
          />
        </div>

        {/* ── Main content ───────────────────────────────────────── */}
        <main className="h-screen lg:border-x border-border overflow-y-auto scrollbar-hide bg-background" ref={scrollContainerRef}>
          {address && (
            <>
              {/* ── Hero ─────────────────────────────────────── */}
              <section className="relative px-4 pt-8 pb-6">
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(120%_60%_at_50%_0%,rgba(252,255,82,0.06),transparent_70%)]"
                />

                {/* Avatar centred with camera button */}
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
                    {/* Camera badge */}
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

                  {/* Name */}
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

              {/* ── Menu rows ────────────────────────────────────── */}
              <section className="px-4 pb-2">
                <div className="rounded-2xl bg-muted/20 border border-border/40 divide-y divide-border/40 overflow-hidden">

                  {/* Profile row */}
                  <button
                    type="button"
                    onClick={() => setProfileExpanded((v) => !v)}
                    className="w-full flex items-center gap-3 px-4 py-4 hover:bg-muted/40 transition-colors text-left"
                  >
                    <span className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-muted/60 text-muted-foreground shrink-0">
                      <UserIcon className="w-4 h-4" />
                    </span>
                    <span
                      className="flex-1 text-sm font-semibold text-foreground"
                      style={{ fontFamily: "var(--font-manrope)" }}
                    >
                      Profile
                    </span>
                    <ChevronRight
                      className={cn(
                        "w-4 h-4 text-muted-foreground/60 transition-transform",
                        profileExpanded && "rotate-90"
                      )}
                    />
                  </button>

                  {/* Profile expanded details */}
                  {profileExpanded && (
                    <div className="bg-muted/10 divide-y divide-border/30">
                      <ProfileDetailRow label="Username" value={displayUsername ?? "—"} />
                      <button
                        type="button"
                        onClick={handleCopyAddress}
                        className="w-full flex items-start gap-3 px-4 py-3 hover:bg-muted/30 transition-colors text-left"
                      >
                        <div className="flex-1 min-w-0 pl-12">
                          <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground font-medium">
                            Wallet address
                          </p>
                          <p className="text-sm font-mono text-foreground truncate">{formatAddress(address)}</p>
                        </div>
                        <span className="text-xs text-muted-foreground inline-flex items-center gap-1 pt-3 shrink-0">
                          {copied ? (
                            <><Check className="w-3.5 h-3.5 text-[#35d07f]" />Copied</>
                          ) : (
                            <><Copy className="w-3.5 h-3.5" />Copy</>
                          )}
                        </span>
                      </button>
                      {email ? (
                        <ProfileDetailRow label="Email" value={email} />
                      ) : (
                        <button
                          type="button"
                          onClick={() => setAddEmailOpen(true)}
                          className="w-full flex items-start gap-3 px-4 py-3 hover:bg-muted/30 transition-colors text-left"
                        >
                          <div className="flex-1 min-w-0 pl-12">
                            <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground font-medium">
                              Email
                            </p>
                            <p className="text-sm font-medium text-[#35d07f]">+ Add email</p>
                          </div>
                        </button>
                      )}
                    </div>
                  )}

                  {/* Transfer row */}
                  <button
                    type="button"
                    onClick={() => setTransferOpen(true)}
                    className="w-full flex items-center gap-3 px-4 py-4 hover:bg-muted/40 transition-colors text-left"
                  >
                    <span className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-[#35d07f]/15 text-[#35d07f] shrink-0">
                      <ArrowRightLeft className="w-4 h-4" />
                    </span>
                    <div className="flex-1 min-w-0">
                      <p
                        className="text-sm font-semibold text-foreground"
                        style={{ fontFamily: "var(--font-manrope)" }}
                      >
                        Transfer
                      </p>
                      <p
                        className="text-xs text-muted-foreground"
                        style={{ fontFamily: "var(--font-manrope)" }}
                      >
                        Send G$ or CELO to another wallet
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground/60 shrink-0" />
                  </button>

                  {/* Settings row */}
                  <Link
                    href="/settings"
                    className="flex items-center gap-3 px-4 py-4 hover:bg-muted/40 transition-colors"
                  >
                    <span className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-muted/60 text-muted-foreground shrink-0">
                      <SettingsIcon className="w-4 h-4" />
                    </span>
                    <span
                      className="flex-1 text-sm font-semibold text-foreground"
                      style={{ fontFamily: "var(--font-manrope)" }}
                    >
                      Settings
                    </span>
                    <ChevronRight className="w-4 h-4 text-muted-foreground/60 shrink-0" />
                  </Link>
                </div>
              </section>

{/* ── Tabs ─────────────────────────────────────────── */}
              <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border px-4 py-3">
                <div className="flex items-center gap-1 p-1 rounded-full bg-muted/20 border border-border/40">
                  {(["milestones", "active", "ended"] as TabType[]).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={cn(
                        "flex-1 py-1.5 rounded-full text-xs font-semibold capitalize transition-all",
                        activeTab === tab
                          ? "bg-card text-foreground shadow-sm border border-border/60"
                          : "text-muted-foreground/60 hover:text-muted-foreground"
                      )}
                      style={{ fontFamily: "var(--font-manrope)" }}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
              </div>

              {/* ── Tab content ──────────────────────────────────── */}

              {activeTab === "milestones" && (
                <div className="pb-24 lg:pb-8">
                  <OngoingMilestonesSection onCreateClick={() => router.push("/board")} />
                </div>
              )}

              {activeTab === "active" && (
                <div className="px-4 pt-4 pb-24 lg:pb-8">
                  {isLoadingOngoing ? (
                    <div className="space-y-3">
                      {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="w-full h-52 bg-muted rounded-2xl animate-pulse" />
                      ))}
                    </div>
                  ) : ongoingDelulus.length === 0 ? (
                    <div className="flex flex-col items-center py-20 text-center">
                      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                        <Plus className="w-7 h-7 text-muted-foreground" />
                      </div>
                      <p
                        className="text-sm font-semibold text-foreground mb-1"
                        style={{ fontFamily: '"Clash Display", sans-serif' }}
                      >
                        No active delulu
                      </p>
                      <p
                        className="text-xs text-muted-foreground mb-5"
                        style={{ fontFamily: "var(--font-manrope)" }}
                      >
                        Start manifesting something new.
                      </p>
                      <button
                        onClick={() => router.push("/board")}
                        className="px-5 py-2.5 rounded-full border border-border bg-card text-foreground text-sm font-semibold hover:bg-muted transition-colors"
                        style={{ fontFamily: "var(--font-manrope)" }}
                      >
                        Create a delulu
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {ongoingDelulus.map((d) => (
                        <DeluluCard key={d.id} delusion={d} href={`/delulu/${d.id}`} className="mb-0" />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === "ended" && (
                <div className="px-4 py-4 pb-24 lg:pb-8">
                  {isLoadingDelulus ? (
                    <div className="space-y-3">
                      {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="w-full h-52 bg-muted rounded-2xl animate-pulse" />
                      ))}
                    </div>
                  ) : delulus.length === 0 ? (
                    <div className="flex flex-col items-center py-20 text-center">
                      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                        <Plus className="w-7 h-7 text-muted-foreground" />
                      </div>
                      <p
                        className="text-sm font-semibold text-foreground mb-1"
                        style={{ fontFamily: '"Clash Display", sans-serif' }}
                      >
                        No ended delulu yet
                      </p>
                      <p className="text-xs text-muted-foreground" style={{ fontFamily: "var(--font-manrope)" }}>
                        Ended and resolved delulu will appear here.
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-3">
                        {delulus.map((delulu) => (
                          <DeluluCard
                            key={delulu.id}
                            delusion={delulu}
                            href={`/delulu/${delulu.id}`}
                            className="mb-0"
                          />
                        ))}
                      </div>
                      {isFetchingNextPage && (
                        <div className="space-y-3 mt-3">
                          {[1, 2].map((i) => (
                            <div key={`loading-${i}`} className="w-full h-52 bg-muted rounded-2xl animate-pulse" />
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </main>

        {/* ── Right sidebar ──────────────────────────────────────── */}
        <div className="hidden lg:block">
          <RightSidebar />
        </div>
      </div>

      <BottomNav
        onProfileClick={handleProfileClick}
        onCreateClick={handleCreateClick}
      />

      <TransferSheet open={transferOpen} onOpenChange={setTransferOpen} />
      <AddEmailSheet open={addEmailOpen} onOpenChange={setAddEmailOpen} />

      {uploadToast && (
        <div className="fixed bottom-24 left-1/2 z-[120] -translate-x-1/2">
          <div
            className={cn(
              "rounded-full border px-4 py-2 text-xs font-semibold shadow-lg",
              uploadToast.type === "success"
                ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                : "border-rose-500/30 bg-rose-500/15 text-rose-700 dark:text-rose-300",
            )}
          >
            {uploadToast.message}
          </div>
        </div>
      )}
    </div>
  );
}

function ProfileDetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <div className="flex-1 min-w-0 pl-12">
        <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground font-medium">
          {label}
        </p>
        <p className="text-sm font-medium text-foreground truncate">{value}</p>
      </div>
    </div>
  );
}
