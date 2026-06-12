"use client";

import React, { useState, useEffect } from "react";
import { useBalance } from "wagmi";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  Copy,
  LogOut,
  Mail,
  Send,
  Trophy,
  User as UserIcon,
  Wallet,
} from "lucide-react";

import { useAuth } from "@/hooks/use-auth";
import { useUserStore } from "@/stores/useUserStore";
import { useTokenBalance } from "@/hooks/use-token-balance";
import { useGraphUserStats } from "@/hooks/graph/useGraphUserStats";
import { useUsernameByAddress } from "@/hooks/use-username-by-address";

import { AddEmailSheet } from "@/components/add-email-sheet";
import { useLogoutSheet } from "@/contexts/logout-sheet-context";
import { TokenBadge } from "@/components/token-badge";

import { CELO_MAINNET_ID, GOODDOLLAR_ADDRESSES } from "@/lib/constant";
import { TG_GROUP_URL } from "@/components/get-gas-modal";
import { cn, formatAddress } from "@/lib/utils";

export default function SettingsPage() {
  const router = useRouter();
  const { isConnected, address, isReady } = useAuth();
  const { user } = useUserStore();
  const { openLogoutSheet } = useLogoutSheet();
  const [addEmailSheetOpen, setAddEmailSheetOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const { username: contractUsername } = useUsernameByAddress(address);
  const displayUsername = contractUsername || user?.username || null;
  const email = user?.email ?? null;

  const {
    totalDelulus,
    activeStakes,
    totalStaked,
    totalClaimed,
    isLoading: isLoadingStats,
  } = useGraphUserStats();

  const { formatted: gDollarBalance, isLoading: isBalanceLoading } =
    useTokenBalance(GOODDOLLAR_ADDRESSES.mainnet);
  const { data: celoBalance, isLoading: isCeloLoading } = useBalance({
    address,
    chainId: CELO_MAINNET_ID,
    query: { enabled: !!address },
  });

  useEffect(() => {
    if (isReady && !isConnected) router.replace("/sign-in");
  }, [isReady, isConnected, router]);

  if (!isReady || !isConnected) return (
    <main className="h-screen overflow-y-auto scrollbar-hide bg-background">
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border px-4 py-3 flex items-center gap-3">
        <div className="h-9 w-9 animate-pulse rounded-full bg-muted/60" />
        <div className="h-5 w-24 animate-pulse rounded-md bg-muted/60" />
      </div>
      <div className="px-4 pt-5 pb-24 space-y-7">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <div className="h-3 w-16 animate-pulse rounded bg-muted/40" />
            <div className="h-14 w-full animate-pulse rounded-2xl bg-muted/40" />
          </div>
        ))}
      </div>
    </main>
  );

  const handleCopyAddress = async () => {
    if (!address) return;
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <main className="h-screen overflow-y-auto scrollbar-hide bg-background">
          {/* Header */}
          <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border px-4 py-3 flex items-center gap-3">
            <button
              type="button"
              onClick={() => router.back()}
              aria-label="Back"
              className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <h1
              className="text-lg font-bold"
              style={{ fontFamily: '"Clash Display", sans-serif' }}
            >
              Settings
            </h1>
          </div>

          {address && (
            <div className="px-4 pt-5 pb-24 lg:pb-10 space-y-7">
              {/* Account */}
              <section>
                <SectionLabel>Account</SectionLabel>
                <div className="mt-2 rounded-2xl bg-muted/20 overflow-hidden flex divide-x divide-border/40">
                  {/* Username */}
                  <div className="flex-1 flex items-center gap-2 px-3 py-3 min-w-0">
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-muted/60 text-muted-foreground shrink-0">
                      <UserIcon className="w-3.5 h-3.5" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[9px] uppercase tracking-[0.16em] text-muted-foreground" style={{ fontFamily: "var(--font-manrope)" }}>
                        Username
                      </p>
                      <p className="text-xs font-medium text-foreground truncate">{displayUsername ?? "—"}</p>
                    </div>
                  </div>
                  {/* Email */}
                  {email ? (
                    <div className="flex-1 flex items-center gap-2 px-3 py-3 min-w-0">
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-muted/60 text-muted-foreground shrink-0">
                        <Mail className="w-3.5 h-3.5" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-[9px] uppercase tracking-[0.16em] text-muted-foreground" style={{ fontFamily: "var(--font-manrope)" }}>
                          Email
                        </p>
                        <p className="text-xs font-medium text-foreground truncate">{email}</p>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setAddEmailSheetOpen(true)}
                      className="flex-1 flex items-center gap-2 px-3 py-3 hover:bg-muted/40 transition-colors text-left min-w-0"
                    >
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-muted/60 text-muted-foreground shrink-0">
                        <Mail className="w-3.5 h-3.5" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-[9px] uppercase tracking-[0.16em] text-muted-foreground" style={{ fontFamily: "var(--font-manrope)" }}>
                          Email
                        </p>
                        <p className="text-xs font-medium text-[#35d07f] truncate">+ Add email</p>
                      </div>
                    </button>
                  )}
                  {/* Wallet */}
                  <button
                    type="button"
                    onClick={handleCopyAddress}
                    className="flex-1 flex items-center gap-2 px-3 py-3 hover:bg-muted/40 transition-colors text-left min-w-0"
                    aria-label="Copy wallet address"
                  >
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-muted/60 text-muted-foreground shrink-0">
                      <Wallet className="w-3.5 h-3.5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[9px] uppercase tracking-[0.16em] text-muted-foreground" style={{ fontFamily: "var(--font-manrope)" }}>
                        Wallet
                      </p>
                      <p className="text-xs font-mono text-foreground truncate">{formatAddress(address)}</p>
                    </div>
                    {copied
                      ? <Check className="w-3 h-3 text-[#35d07f] shrink-0" />
                      : <Copy className="w-3 h-3 text-muted-foreground shrink-0" />
                    }
                  </button>
                </div>
              </section>

              {/* Stats */}
              <section>
                <SectionLabel>Stats</SectionLabel>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <StatCard
                    label="Delulus created"
                    value={isLoadingStats ? "—" : String(totalDelulus)}
                  />
                  <StatCard
                    label="Active stakes"
                    value={isLoadingStats ? "—" : String(activeStakes)}
                  />
                  <StatCard
                    label="Total staked"
                    value={
                      isLoadingStats ? "—" : totalStaked.toFixed(2)
                    }
                    suffix="G$"
                  />
                  <StatCard
                    label="Total claimed"
                    value={
                      isLoadingStats ? "—" : totalClaimed.toFixed(2)
                    }
                    suffix="G$"
                  />
                </div>
              </section>

              {/* Wallet balances */}
              <section>
                <SectionLabel>Balances</SectionLabel>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <div className="rounded-2xl bg-muted/25 px-3 py-3 flex items-center gap-2.5">
                    <img
                      src="/celo.png"
                      alt=""
                      className="w-7 h-7 rounded-full shrink-0"
                    />
                    <div className="min-w-0">
                      <p
                        className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground"
                        style={{ fontFamily: "var(--font-manrope)" }}
                      >
                        Celo
                      </p>
                      <p className="text-sm font-bold tabular-nums truncate text-foreground">
                        {!isCeloLoading && celoBalance
                          ? parseFloat(celoBalance.formatted).toFixed(3)
                          : "—"}
                      </p>
                    </div>
                  </div>
                  <div className="rounded-2xl bg-muted/25 px-3 py-3 flex items-center gap-2.5">
                    <TokenBadge
                      tokenAddress={GOODDOLLAR_ADDRESSES.mainnet}
                      size="sm"
                      showText={false}
                    />
                    <div className="min-w-0">
                      <p
                        className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground"
                        style={{ fontFamily: "var(--font-manrope)" }}
                      >
                        G$
                      </p>
                      <p className="text-sm font-bold tabular-nums truncate text-foreground">
                        {!isBalanceLoading
                          ? parseFloat(gDollarBalance).toFixed(2)
                          : "—"}
                      </p>
                    </div>
                  </div>
                </div>
              </section>

              {/* More */}
              <section>
                <SectionLabel>More</SectionLabel>
                <div className="mt-2 rounded-2xl bg-muted/20 divide-y divide-border/40 overflow-hidden">
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
                    icon={<Send className="w-4 h-4 text-[#35d07f]" />}
                    title="Join Telegram"
                    description="Talk to the community"
                    href={TG_GROUP_URL}
                    external
                  />
                </div>
              </section>

              {/* Sign out */}
              <section>
                <button
                  type="button"
                  onClick={openLogoutSheet}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl border border-border bg-secondary text-rose-500 hover:bg-secondary/80 text-sm font-bold transition-colors"
                  style={{ fontFamily: "var(--font-manrope)" }}
                >
                  <LogOut className="w-4 h-4" />
                  Sign out
                </button>
              </section>
            </div>
          )}
      </main>

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
      className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground"
      style={{ fontFamily: "var(--font-manrope)" }}
    >
      {children}
    </p>
  );
}

function Row({
  icon,
  label,
  value,
  valueClassName,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-muted/60 text-muted-foreground">
        {icon}
      </span>
      <div className="flex-1 min-w-0">
        <p
          className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground"
          style={{ fontFamily: "var(--font-manrope)" }}
        >
          {label}
        </p>
        <p
          className={cn(
            "text-sm font-medium text-foreground truncate",
            valueClassName,
          )}
        >
          {value}
        </p>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  suffix,
}: {
  label: string;
  value: string;
  suffix?: string;
}) {
  return (
    <div className="rounded-2xl bg-muted/25 px-3 py-3">
      <p
        className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground"
        style={{ fontFamily: "var(--font-manrope)" }}
      >
        {label}
      </p>
      <p className="mt-0.5 text-lg font-bold tabular-nums text-foreground leading-none">
        {value}
        {suffix && (
          <span className="ml-1 text-xs text-muted-foreground font-semibold">
            {suffix}
          </span>
        )}
      </p>
    </div>
  );
}

function LinkRow({
  icon,
  title,
  description,
  href,
  external = false,
  accent = false,
}: {
  icon: React.ReactNode;
  title: string;
  description?: string;
  href: string;
  external?: boolean;
  accent?: boolean;
}) {
  const inner = (
    <>
      <span
        className={cn(
          "inline-flex items-center justify-center w-7 h-7 rounded-full",
          accent
            ? "bg-[#f6c324]/15 text-[#f6c324]"
            : "bg-muted/60 text-muted-foreground",
        )}
      >
        {icon}
      </span>
      <div className="flex-1 min-w-0">
        <p
          className={cn(
            "text-sm font-semibold truncate",
            accent ? "text-[#f6c324]" : "text-foreground",
          )}
          style={{ fontFamily: "var(--font-manrope)" }}
        >
          {title}
        </p>
        {description && (
          <p
            className="text-xs text-muted-foreground truncate"
            style={{ fontFamily: "var(--font-manrope)" }}
          >
            {description}
          </p>
        )}
      </div>
      <span className="text-muted-foreground/60">›</span>
    </>
  );

  const className =
    "w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors";

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
