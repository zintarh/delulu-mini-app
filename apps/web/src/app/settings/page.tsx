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
  Sparkles,
  Trophy,
  User as UserIcon,
  Wallet,
} from "lucide-react";

import { useAuth } from "@/hooks/use-auth";
import { useUserStore } from "@/stores/useUserStore";
import { useTokenBalance } from "@/hooks/use-token-balance";
import { useGraphUserStats } from "@/hooks/graph/useGraphUserStats";
import { useUsernameByAddress } from "@/hooks/use-username-by-address";

import { LeftSidebar } from "@/components/left-sidebar";
import { RightSidebar } from "@/components/right-sidebar";
import { BottomNav } from "@/components/bottom-nav";
import { LogoutSheet } from "@/components/logout-sheet";
import { TokenBadge } from "@/components/token-badge";

import { CELO_MAINNET_ID, GOODDOLLAR_ADDRESSES } from "@/lib/constant";
import { TG_GROUP_URL } from "@/components/get-gas-modal";
import { cn, formatAddress } from "@/lib/utils";

export default function SettingsPage() {
  const router = useRouter();
  const { isConnected, address, logout } = useAuth();
  const { user } = useUserStore();

  const [logoutSheetOpen, setLogoutSheetOpen] = useState(false);
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
    if (!isConnected) router.replace("/sign-in");
  }, [isConnected, router]);

  const handleCopyAddress = async () => {
    if (!address) return;
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleProfileClick = () => router.push("/profile");
  const handleCreateClick = () => router.push(isConnected ? "/board" : "/sign-in");

  return (
    <div className="h-screen overflow-hidden">
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-[250px_1fr_320px] h-screen">
        <div className="hidden lg:block">
          <LeftSidebar
            onProfileClick={handleProfileClick}
            onCreateClick={handleCreateClick}
          />
        </div>

        <main className="h-screen lg:border-x border-border overflow-y-auto scrollbar-hide bg-background">
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
                <div className="mt-2 rounded-2xl bg-muted/20 divide-y divide-border/40 overflow-hidden">
                  <Row
                    icon={<UserIcon className="w-4 h-4" />}
                    label="Username"
                    value={displayUsername ?? "—"}
                  />
                  <Row
                    icon={<Mail className="w-4 h-4" />}
                    label="Email"
                    value={email ?? "—"}
                    valueClassName={email ? undefined : "text-muted-foreground"}
                  />
                  <button
                    type="button"
                    onClick={handleCopyAddress}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/40 transition-colors"
                    aria-label="Copy wallet address"
                  >
                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-muted/60 text-muted-foreground">
                      <Wallet className="w-4 h-4" />
                    </span>
                    <div className="flex-1 min-w-0">
                      <p
                        className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground"
                        style={{ fontFamily: "var(--font-manrope)" }}
                      >
                        Wallet
                      </p>
                      <p className="text-sm font-mono text-foreground truncate">
                        {formatAddress(address)}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                      {copied ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-[#35d07f]" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          Copy
                        </>
                      )}
                    </span>
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
                    icon={<Sparkles className="w-4 h-4" />}
                    title="Wrapped"
                    description="Your delulu year in review"
                    href="/wrap"
                    accent
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
                  onClick={() => setLogoutSheetOpen(true)}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl border border-border bg-card text-rose-500 hover:bg-muted text-sm font-bold transition-colors"
                  style={{ fontFamily: "var(--font-manrope)" }}
                >
                  <LogOut className="w-4 h-4" />
                  Sign out
                </button>
              </section>
            </div>
          )}
        </main>

        <div className="hidden lg:block">
          <RightSidebar />
        </div>
      </div>

      <BottomNav
        onProfileClick={handleProfileClick}
        onCreateClick={handleCreateClick}
      />

      <LogoutSheet
        open={logoutSheetOpen}
        onOpenChange={setLogoutSheetOpen}
        onLogout={async () => {
          await logout();
          setLogoutSheetOpen(false);
          useUserStore.getState().logout();
          router.push("/sign-in");
        }}
      />
    </div>
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
            ? "bg-[#fcff52]/15 text-[#fcff52]"
            : "bg-muted/60 text-muted-foreground",
        )}
      >
        {icon}
      </span>
      <div className="flex-1 min-w-0">
        <p
          className={cn(
            "text-sm font-semibold truncate",
            accent ? "text-[#fcff52]" : "text-foreground",
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
