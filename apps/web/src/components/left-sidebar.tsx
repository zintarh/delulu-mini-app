"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  Home,
  Plus,
  User,
  Coins,
  User2,
  CableCar,
  Trophy,
  Moon,
  Sun,
  LogIn,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { useTheme } from "@/contexts/theme-context";
import { useAccount, useBalance } from "wagmi";
import { formatAddress } from "@/lib/utils";
import { useUsernameByAddress } from "@/hooks/use-username-by-address";
import { CELO_MAINNET_ID, GOODDOLLAR_ADDRESSES } from "@/lib/constant";
import { TokenBadge } from "@/components/token-badge";

interface LeftSidebarProps {
  onProfileClick?: () => void;
  onCreateClick?: () => void;
}

export function LeftSidebar({
  onProfileClick,
  onCreateClick,
}: LeftSidebarProps) {
  const pathname = usePathname();
  const { isAdmin } = useIsAdmin();
  const { theme, toggleTheme } = useTheme();
  const { isConnected, address } = useAccount();
  const { username } = useUsernameByAddress(address);
  const [selectedAsset, setSelectedAsset] = useState<"CELO" | "G$">("CELO");
  const [isBalanceOpen, setIsBalanceOpen] = useState(false);

  const {
    data: celoBalance,
    isLoading: isCeloLoading,
  } = useBalance({
    address,
    chainId: CELO_MAINNET_ID,
    query: {
      enabled: !!address,
    },
  });

  const {
    data: gDollarBalance,
    isLoading: isGdLoading,
  } = useBalance({
    address,
    token: GOODDOLLAR_ADDRESSES.mainnet as `0x${string}`,
    chainId: CELO_MAINNET_ID,
    query: {
      enabled: !!address,
    },
  });

  const displayName = username
    ? `@${username}`
    : address
    ? formatAddress(address as `0x${string}`)
    : "";

  const navItems = [
    {
      icon: Home,
      label: "Home",
      href: "/",
      active: pathname === "/",
      onClick: undefined as (() => void) | undefined,
    },
    {
      icon: Plus,
      label: "Create",
      href: undefined,
      active: false,
      onClick: onCreateClick,
    },
    {
      icon: Coins,
      label: "Claim",
      href: "/daily-claim",
      active: pathname === "/daily-claim",
      onClick: undefined,
    },
    {
      icon: CableCar,
      label: "Campaigns",
      href: "/campaigns",
      active: pathname === "/campaigns",
      onClick: undefined,
    },
    {
      icon: Trophy,
      label: "Leaderboard",
      href: "/leaderboard",
      active: pathname === "/leaderboard",
      onClick: undefined,
    },
    {
      icon: User,
      label: "Profile",
      href: undefined,
      active: false,
      onClick: onProfileClick,
    },
    ...(isAdmin
      ? [
          {
            icon: User2,
            label: "Markets",
            href: "/market",
            active: pathname === "/market",
            onClick: undefined,
          },
        ]
      : []),
  ];

  return (
    <aside className="h-screen sticky top-0 flex flex-col px-4 py-4 border-r border border-border bg-background text-foreground">
      <div className="mb-8 px-2">
        <h1 
          className="text-4xl font-black text-delulu-yellow-reserved"
          style={{
            fontFamily: "var(--font-gloria), cursive",
            textShadow: "3px 3px 0px #1A1A1A, -2px -2px 0px #1A1A1A, 2px -2px 0px #1A1A1A, -2px 2px 0px #1A1A1A"
          }}
        >
          Delulu
        </h1>
      </div>

      <nav className="flex-1 flex flex-col gap-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isClaimG = item.href === "/daily-claim";
          const className = cn(
            "flex items-center gap-3 transition-colors text-sm",
             "px-3 py-2.5 rounded-lg w-full",
            item.active
              ? isClaimG
                ? "bg-[#01B1FF]/20"
                : "bg-secondary text-foreground"
              : isClaimG
              ? ""
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          );
          const style = isClaimG ? { color: "#01B1FF" } : undefined;
          const content = (
            <>
              {isClaimG ? (
                <img
                  src="/gooddollar-logo.png"
                  alt="G$"
                  className="w-6 h-6 flex-shrink-0 object-contain"
                />
              ) : (
                <Icon className="w-6 h-6 flex-shrink-0" />
              )}
              <span className="text-base font-">{item.label}</span>
            </>
          );

          if (item.href) {
            return (
              <Link
                key={item.label}
                href={item.href}
                className={className}
                style={style}
                aria-label={item.label}
              >
                {content}
              </Link>
            );
          }

          return (
            <button
              key={item.label}
              onClick={item.onClick}
              className={className}
              style={style}
              aria-label={item.label}
            >
              {content}
            </button>
          );
        })}
      </nav>
      <div className="mt-4 pt-3 border-t border-border space-y-3">
        {/* Connection status / Login */}
        {!isConnected ? (
          <button
            type="button"
            onClick={onProfileClick}
            className="flex w-fit items-center justify-center gap-2 px-3 py-2 rounded-full border-2 border-delulu-charcoal bg-delulu-yellow-reserved text-xs font-bold text-delulu-charcoal shadow-[3px_3px_0px_0px_#1A1A1A] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_0px_#1A1A1A] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all"
          >
            <LogIn className="w-4 h-4" />
            <span>Sign In</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={onProfileClick}
            className="flex items-center justify-between px-3 py-2 rounded-lg bg-muted w-full text-left"
            aria-label="Open profile"
          >
            <div className="flex flex-col">
              <span className="text-[11px] text-muted-foreground uppercase tracking-wide">
                Account
              </span>
              {displayName && (
                <span className="text-xs font-medium text-foreground">
                  {displayName}
                </span>
              )}
            </div>
            {/* Balance dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsBalanceOpen((open) => !open);
                }}
                className="inline-flex items-center gap-1 rounded-full border border-border bg-background/80 px-2 py-1 text-[11px] text-foreground hover:bg-background"
                title="View balances"
              >
                {selectedAsset === "CELO" ? (
                  <img
                    src="/celo.png"
                    alt="CELO"
                    className="h-3.5 w-3.5 rounded-full"
                  />
                ) : (
                  <TokenBadge
                    tokenAddress={GOODDOLLAR_ADDRESSES.mainnet}
                    size="sm"
                    showText={false}
                  />
                )}
                <span className="font-medium">
                  {selectedAsset === "CELO" && !isCeloLoading && celoBalance
                    ? `${parseFloat(celoBalance.formatted).toFixed(3)}`
                    : null}
                  {selectedAsset === "G$" && !isGdLoading && gDollarBalance
                    ? `${parseFloat(gDollarBalance.formatted).toFixed(2)}`
                    : null}
                </span>
              </button>

              {isBalanceOpen && (
                <div className="absolute right-0 mt-1 w-32 rounded-md border border-border bg-background shadow-lg z-10">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedAsset("CELO");
                      setIsBalanceOpen(false);
                    }}
                    className="w-full flex items-center justify-between px-2 py-1.5 text-[11px] hover:bg-muted"
                  >
                    <div className="flex items-center gap-1">
                      <img
                        src="/celo.png"
                        alt="CELO"
                        className="h-3.5 w-3.5 rounded-full"
                      />
                    </div>
                    {!isCeloLoading && celoBalance && (
                      <span className="font-medium">
                        {parseFloat(celoBalance.formatted).toFixed(3)}
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedAsset("G$");
                      setIsBalanceOpen(false);
                    }}
                    className="w-full flex items-center justify-between px-2 py-1.5 text-[11px] hover:bg-muted"
                  >
                    <div className="flex items-center gap-1">
                      <TokenBadge
                        tokenAddress={GOODDOLLAR_ADDRESSES.mainnet}
                        size="sm"
                        showText={false}
                      />
                      <span>G$</span>
                    </div>
                    {!isGdLoading && gDollarBalance && (
                      <span className="font-medium">
                        {parseFloat(gDollarBalance.formatted).toFixed(2)}
                      </span>
                    )}
                  </button>
                </div>
              )}
            </div>
          </button>
        )}

        {/* Theme toggle */}
        <button
          type="button"
          onClick={toggleTheme}
          className="flex items-center gap-2 px-3 py-2 rounded-full border border-border text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground transition-colors w-fit"
        >
          <span className="flex items-center gap-2">
            {theme === "dark" ? (
              <Moon className="w-6 h-6" />
            ) : (
              <Sun className="w-6 h-6" />
            )}
          </span>
        </button>
      </div>
    </aside>
  );
}
