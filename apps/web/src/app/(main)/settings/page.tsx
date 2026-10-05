"use client";

import React, { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { useBalance } from "wagmi";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Bell,
  BellOff,
  Check,
  ChevronRight,
  Copy,
  Loader2,
  LogOut,
  Mail,
  Send,
  Trophy,
  Wallet,
} from "lucide-react";

import { useAuth } from "@/hooks/use-auth";
import {
  getPushSupportState,
  subscribeToWebPush,
  unsubscribeWebPush,
  type PushSupportState,
} from "@/lib/web-push-client";
import { useUserStore } from "@/stores/useUserStore";
import { useTokenBalance } from "@/hooks/use-token-balance";
import { useUsernameByAddress } from "@/hooks/use-username-by-address";
import { usePfp } from "@/hooks/use-profile-pfp";

import { AddEmailSheet } from "@/components/add-email-sheet";
import { useLogoutSheet } from "@/contexts/logout-sheet-context";
import { TokenBadge } from "@/components/token-badge";
import { UserAvatar } from "@/components/ui/user-avatar";
import { MainPage } from "@/components/main-app-header";

import { CELO_MAINNET_ID, GOODDOLLAR_ADDRESSES } from "@/lib/constant";
import { TG_GROUP_URL } from "@/components/get-gas-modal";
import { cn, formatAddress } from "@/lib/utils";

const CLASH_DISPLAY = { fontFamily: 'var(--font-display), sans-serif' } as const;
const MANROPE = { fontFamily: "var(--font-body)" } as const;

export default function SettingsPage() {
  const router = useRouter();
  const { isConnected, address, isReady } = useAuth();
  const { user } = useUserStore();
  const { openLogoutSheet } = useLogoutSheet();
  const { theme, setTheme, forcedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const [addEmailSheetOpen, setAddEmailSheetOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pushState, setPushState] = useState<PushSupportState | null>(null);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushError, setPushError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getPushSupportState()
      .then((s) => { if (!cancelled) setPushState(s); })
      .catch(() => { if (!cancelled) setPushState({ state: "unsupported" }); });
    return () => { cancelled = true; };
  }, []);

  const handleTogglePush = async () => {
    if (!address || !pushState || pushState.state === "unsupported" || pushBusy) return;
    if (pushState.state === "needs_permission" && pushState.permission === "denied") {
      setPushError(
        "Notifications are blocked for this site in your browser settings. Enable them there, then try again.",
      );
      return;
    }
    setPushBusy(true);
    setPushError(null);
    try {
      const isSubscribed = pushState.state === "ready" && pushState.subscribed;
      if (isSubscribed) {
        await unsubscribeWebPush(address);
      } else {
        await subscribeToWebPush(address);
      }
      setPushState(await getPushSupportState());
    } catch (err) {
      setPushError(err instanceof Error ? err.message : "Couldn't update push notifications.");
    } finally {
      setPushBusy(false);
    }
  };

  const { username: contractUsername } = useUsernameByAddress(address);
  const displayUsername = contractUsername || user?.username || null;
  const email = user?.email ?? null;
  const pfpUrl = usePfp(address) ?? user?.pfpUrl ?? null;

  const {
    formatted: gDollarBalance,
    isLoading: isBalanceLoading,
    error: gdBalanceError,
  } = useTokenBalance(GOODDOLLAR_ADDRESSES.mainnet);
  const { data: celoBalance, isLoading: isCeloLoading } = useBalance({
    address,
    chainId: CELO_MAINNET_ID,
    query: { enabled: !!address },
  });

  useEffect(() => {
    if (isReady && !isConnected) router.replace("/sign-in");
  }, [isReady, isConnected, router]);

  if (!isReady || !isConnected) return (
    <MainPage>
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border px-4 py-3 flex items-center gap-3">
        <div className="h-9 w-9 animate-pulse rounded-full bg-muted/60" />
        <div className="h-5 w-24 animate-pulse rounded-md bg-muted/60" />
      </div>
      <div className="px-4 pt-5 space-y-7">
        <div className="h-24 w-full animate-pulse rounded-3xl bg-muted/40" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <div className="h-3 w-16 animate-pulse rounded bg-muted/40" />
            <div className="h-14 w-full animate-pulse rounded-2xl bg-muted/40" />
          </div>
        ))}
      </div>
    </MainPage>
  );

  const handleCopyAddress = async () => {
    if (!address) return;
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <MainPage>
          {/* Header */}
          <div className="sticky top-0 z-40 mx-auto flex max-w-xl items-center gap-3 bg-paper/95 px-5 py-3 backdrop-blur-sm">
            <button
              type="button"
              onClick={() => router.back()}
              aria-label="Back"
              className="press-edge inline-flex h-11 w-11 items-center justify-center rounded-full border-2 border-line bg-white shadow-edge-sm"
            >
              <ArrowLeft className="h-5 w-5" strokeWidth={2.4} />
            </button>
            <h1 className="m-0 text-2xl font-bold tracking-[-0.02em]">Settings</h1>
          </div>

          {address && (
            <div className="mx-auto max-w-xl space-y-6 px-5 pb-10 pt-3">
              {/* Profile card */}
              <section className="rounded-3xl border-2 border-line bg-white p-4 shadow-edge">
                <div className="flex items-center gap-3.5">
                  <UserAvatar
                    address={address}
                    username={displayUsername}
                    pfpUrl={pfpUrl}
                    size={60}
                  />
                  <div className="min-w-0 flex-1">
                    <p
                      className="truncate text-lg font-extrabold leading-tight text-foreground"
                      style={CLASH_DISPLAY}
                    >
                      {displayUsername ?? formatAddress(address)}
                    </p>
                    <button
                      type="button"
                      onClick={handleCopyAddress}
                      className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-paper px-2.5 py-1 font-mono text-xs text-muted-foreground transition-colors hover:text-ink"
                      aria-label="Copy wallet address"
                    >
                      <Wallet className="h-3 w-3 shrink-0" />
                      {formatAddress(address)}
                      {copied ? (
                        <Check className="h-3 w-3 shrink-0 text-green-edge" />
                      ) : (
                        <Copy className="h-3 w-3 shrink-0" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="mt-3.5 border-t-2 border-dashed border-line pt-3.5">
                  {email ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Mail className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{email}</span>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setAddEmailSheetOpen(true)}
                      className="flex w-full items-center gap-2 rounded-xl border-2 border-dashed border-line px-3 py-2 text-sm font-bold text-ink transition-colors hover:bg-paper"
                    >
                      <Mail className="h-3.5 w-3.5 shrink-0" />
                      Add email
                    </button>
                  )}
                </div>
              </section>

              {/* Wallet balances */}
              <section>
                <SectionLabel>Balances</SectionLabel>
                <div className="mt-2.5 grid grid-cols-2 gap-2.5">
                  <div className="rounded-[20px] border-2 border-line bg-white shadow-edge px-3.5 py-3.5 flex items-center gap-2.5">
                    <img
                      src="/celo.png"
                      alt=""
                      className="w-8 h-8 rounded-full shrink-0"
                    />
                    <div className="min-w-0">
                      <p
                        className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground"
                        style={MANROPE}
                      >
                        Celo
                      </p>
                      <p className="text-base font-bold tabular-nums truncate text-foreground">
                        {!isCeloLoading && celoBalance
                          ? parseFloat(celoBalance.formatted).toFixed(3)
                          : "—"}
                      </p>
                    </div>
                  </div>
                  <div className="rounded-[20px] border-2 border-line bg-white shadow-edge px-3.5 py-3.5 flex items-center gap-2.5">
                    <TokenBadge
                      tokenAddress={GOODDOLLAR_ADDRESSES.mainnet}
                      size="sm"
                      showText={false}
                    />
                    <div className="min-w-0">
                      <p
                        className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground"
                        style={MANROPE}
                      >
                        G$
                      </p>
                      <p className="text-base font-bold tabular-nums truncate text-foreground">
                        {!isBalanceLoading && !gdBalanceError
                          ? parseFloat(gDollarBalance).toFixed(2)
                          : "—"}
                      </p>
                    </div>
                  </div>
                </div>
              </section>

              {/* Appearance — hidden while dark mode is toggled off in production */}
              {!forcedTheme ? (
                <section>
                  <SectionLabel>Appearance</SectionLabel>
                  <div className="mt-2.5 flex gap-1 rounded-2xl bg-[#ecece7] p-1">
                    {(["system", "light", "dark"] as const).map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setTheme(opt)}
                        className={cn(
                          "flex-1 rounded-xl py-2 text-xs font-bold capitalize transition-colors",
                          mounted && theme === opt
                            ? "bg-ink text-white shadow-[0_3px_0_#000]"
                            : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </section>
              ) : null}

              {/* More */}
              <section>
                <SectionLabel>More</SectionLabel>
                <div className="mt-2.5 rounded-[20px] border-2 border-line bg-white shadow-edge divide-y-2 divide-dashed divide-line overflow-hidden">
                  <LinkRow
                    icon={<Wallet className="w-4 h-4" />}
                    title="Rewards"
                    description="Balance, claims, and earnings"
                    href="/rewards"
                  />
                  <LinkRow
                    icon={
                      <img
                        src="/gooddollar-logo.png"
                        alt=""
                        className="w-4 h-4 object-contain"
                      />
                    }
                    title="Claim G$ UBI"
                    description="Get your free daily G$"
                    href="/daily-claim"
                  />
                  <LinkRow
                    icon={<Trophy className="w-4 h-4" />}
                    title="Leaderboard"
                    description="Top creators and supporters"
                    href="/leaderboard"
                  />
                  <LinkRow
                    icon={<Send className="w-4 h-4 text-green-edge" />}
                    title="Join Telegram"
                    description="Talk to the community"
                    href={TG_GROUP_URL}
                    external
                  />
                </div>
              </section>

              {/* Notifications */}
              {pushState && pushState.state !== "unsupported" ? (
                <section>
                  <SectionLabel>Notifications</SectionLabel>
                  <div className="mt-2.5 rounded-[20px] border-2 border-line bg-white shadow-edge p-4">
                    <div className="flex items-center gap-3">
                      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-paper text-ink">
                        {pushState.state === "ready" && pushState.subscribed ? (
                          <Bell className="w-4 h-4" />
                        ) : (
                          <BellOff className="w-4 h-4" />
                        )}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground" style={MANROPE}>
                          Push notifications
                        </p>
                        <p className="text-xs text-muted-foreground" style={MANROPE}>
                          {pushState.state === "ready" && pushState.subscribed
                            ? "You'll get notified about campaign activity."
                            : "Get notified when campaign members submit proof."}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleTogglePush()}
                        disabled={pushBusy}
                        className={cn(
                          "shrink-0 rounded-full px-3.5 py-2 text-xs font-bold transition-colors disabled:opacity-60",
                          pushState.state === "ready" && pushState.subscribed
                            ? "border border-border bg-secondary text-foreground hover:bg-secondary/80"
                            : "bg-green text-white hover:bg-green/90",
                        )}
                      >
                        {pushBusy ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : pushState.state === "ready" && pushState.subscribed ? (
                          "Turn off"
                        ) : (
                          "Enable"
                        )}
                      </button>
                    </div>
                    {pushError ? (
                      <p className="mt-2.5 text-xs text-destructive">{pushError}</p>
                    ) : null}
                  </div>
                </section>
              ) : null}

              {/* Sign out */}
              <section>
                <button
                  type="button"
                  onClick={openLogoutSheet}
                  className="press-edge inline-flex h-[52px] w-full items-center justify-center gap-2 rounded-2xl border-2 border-line bg-white text-sm font-bold text-orange shadow-edge"
                  style={MANROPE}
                >
                  <LogOut className="w-4 h-4" />
                  Sign out
                </button>
              </section>
            </div>
          )}
      </MainPage>

      <AddEmailSheet
        open={addEmailSheetOpen}
        onOpenChange={setAddEmailSheetOpen}
      />

    </>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="label-mono text-muted-foreground"
      style={MANROPE}
    >
      {children}
    </p>
  );
}

function LinkRow({
  icon,
  title,
  description,
  href,
  external = false,
}: {
  icon: React.ReactNode;
  title: string;
  description?: string;
  href: string;
  external?: boolean;
}) {
  const inner = (
    <>
      <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-paper text-ink">
        {icon}
      </span>
      <div className="flex-1 min-w-0">
        <p
          className="text-sm font-semibold truncate text-foreground"
          style={MANROPE}
        >
          {title}
        </p>
        {description && (
          <p
            className="text-xs text-muted-foreground truncate"
            style={MANROPE}
          >
            {description}
          </p>
        )}
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/60" />
    </>
  );

  const className = cn(
    "w-full flex items-center gap-3 px-4 py-3.5 hover:bg-muted/40 transition-colors",
  );

  if (external) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
      >
        {inner}
      </a>
    );
  }

  return (
    <Link href={href} className={className}>
      {inner}
    </Link>
  );
}
