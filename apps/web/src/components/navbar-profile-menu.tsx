"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { useUserStore } from "@/stores/useUserStore";
import { useClaimAvailability } from "@/hooks/use-claim-availability";
import { useLogoutSheetOptional } from "@/contexts/logout-sheet-context";
import { UserAvatar } from "@/components/ui/user-avatar";
import { usePfp } from "@/hooks/use-profile-pfp";

const DEFAULT_AVATAR = "/user-avatar.jpg";

function formatAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

interface NavbarProfileMenuProps {
  onLogoutClick?: () => void;
  className?: string;
  /** Compact trigger for mobile page headers */
  size?: "default" | "compact";
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[13px] font-semibold text-muted-foreground">{children}</p>
  );
}

function MenuAction({
  children,
  onClick,
  className,
  href,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  href?: string;
}) {
  const itemCls = cn(
    "block w-full rounded-lg py-2.5 text-left text-[15px] font-bold text-foreground transition-colors hover:bg-secondary/60",
    className,
  );

  if (href) {
    return (
      <Link href={href} role="menuitem" className={itemCls} onClick={onClick}>
        {children}
      </Link>
    );
  }

  return (
    <button type="button" role="menuitem" className={itemCls} onClick={onClick}>
      {children}
    </button>
  );
}

function TriggerAvatar({ src, size }: { src: string; size: number }) {
  return (
    <span
      className="relative shrink-0 overflow-hidden rounded-full bg-secondary"
      style={{ width: size, height: size }}
    >
      {src.startsWith("http") ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="h-full w-full object-cover" />
      ) : (
        <Image src={src} alt="" fill className="object-cover" sizes={`${size}px`} />
      )}
    </span>
  );
}

export function NavbarProfileMenu({
  onLogoutClick,
  className,
  size = "default",
}: NavbarProfileMenuProps) {
  const compact = size === "compact";
  const triggerSize = compact ? 36 : 40;
  const router = useRouter();
  const { authenticated, address, email: authEmail } = useAuth();
  const user = useUserStore((s) => s.user);
  const { availability, showProfileClaim, openClaim } = useClaimAvailability();
  const logoutSheet = useLogoutSheetOptional();
  const [open, setOpen] = useState(false);
  const [addressCopied, setAddressCopied] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    };
  }, []);

  const pfpFromCache = usePfp(address ?? undefined);
  // Use live Supabase pfp (via batch cache) → fall back to store → default
  const resolvedPfp = pfpFromCache || user?.pfpUrl || null;
  const avatarSrc = resolvedPfp ?? DEFAULT_AVATAR;
  const displayName =
    user?.displayName?.trim() ||
    (user?.username ? user.username : null) ||
    (address ? formatAddress(address) : "Your account");
  const accountEmail = user?.email || authEmail;
  const walletAddress = user?.address || address;

  const handleCopyAddress = async () => {
    if (!walletAddress) return;
    try {
      await navigator.clipboard.writeText(walletAddress);
      setAddressCopied(true);
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
      copyTimeoutRef.current = setTimeout(() => setAddressCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  };

  const close = () => setOpen(false);

  return (
    <div ref={rootRef} className={cn("relative shrink-0", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex items-center rounded-full transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring hover:bg-secondary/50",
          compact ? "gap-0.5 p-0.5" : "gap-1 p-0.5 pr-1",
        )}
        aria-label="Account menu"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <TriggerAvatar src={avatarSrc} size={triggerSize} />
        <ChevronDown
          className={cn(
            "shrink-0 text-muted-foreground transition-transform duration-200",
            compact ? "h-4 w-4" : "h-5 w-5",
            open && "rotate-180",
          )}
          strokeWidth={2.25}
        />
      </button>

      {open && (
        <div
          role="menu"
          className={cn(
            "absolute right-0 top-[calc(100%+10px)] z-[60] w-[min(100vw-2rem,320px)]",
            "overflow-hidden rounded-[20px] border border-border/40 bg-card py-5 shadow-[0_8px_30px_rgba(0,0,0,0.12)]",
          )}
        >
          {authenticated ? (
            <div className="flex flex-col gap-6 px-5">
              <div>
                <SectionLabel>Currently in</SectionLabel>
                <div className="mt-3 flex items-start gap-3">
                  {walletAddress ? (
                    <UserAvatar
                      address={walletAddress}
                      username={user?.username}
                      pfpUrl={resolvedPfp}
                      size={48}
                      className="shrink-0"
                    />
                  ) : (
                    <TriggerAvatar src={avatarSrc} size={48} />
                  )}
                  <div className="min-w-0 flex-1 pt-0.5">
                    <p className="truncate text-[15px] font-bold leading-tight text-foreground">
                      {displayName}
                    </p>
                    {walletAddress ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleCopyAddress();
                        }}
                        className="mt-1 flex max-w-full items-center gap-1.5 rounded-md py-0.5 text-left transition-colors hover:text-foreground"
                        aria-label="Copy wallet address"
                      >
                        <span className="truncate font-mono text-[13px] text-muted-foreground">
                          {formatAddress(walletAddress)}
                        </span>
                        {addressCopied ? (
                          <span className="shrink-0 text-[11px] font-semibold text-delulu-blue">
                            Copied
                          </span>
                        ) : (
                          <Copy className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        )}
                      </button>
                    ) : null}
                    {accountEmail && (
                      <p className="mt-0.5 truncate text-[13px] text-muted-foreground">
                        {accountEmail}
                      </p>
                    )}
                  </div>
                  <Check
                    className="mt-1 h-5 w-5 shrink-0 text-foreground"
                    strokeWidth={2.5}
                    aria-hidden
                  />
                </div>
                <MenuAction href="/profile" className="mt-2 px-1" onClick={close}>
                  View profile
                </MenuAction>
              </div>

              <div>
                <SectionLabel>Your account</SectionLabel>
                <div className="mt-2 flex flex-col">
                  {showProfileClaim ? (
                    <MenuAction
                      className="px-1"
                      onClick={() => {
                        close();
                        openClaim();
                      }}
                    >
                      <span className="flex items-center gap-2">
                        Claim G$
                        {availability === "claimable" ? (
                          <span
                            className="h-2 w-2 shrink-0 rounded-full bg-[#f6c324]"
                            aria-hidden
                          />
                        ) : null}
                      </span>
                    </MenuAction>
                  ) : null}
                  <MenuAction href="/leaderboard" className="px-1" onClick={close}>
                    Leaderboard
                  </MenuAction>
                  <MenuAction href="/settings" className="px-1" onClick={close}>
                    Settings
                  </MenuAction>
                </div>
              </div>

              <MenuAction
                className="px-1"
                onClick={() => {
                  close();
                  if (logoutSheet) {
                    logoutSheet.openLogoutSheet();
                    return;
                  }
                  onLogoutClick?.();
                }}
              >
                Log out
              </MenuAction>
            </div>
          ) : (
            <div className="flex flex-col gap-6 px-5">
              <div>
                <SectionLabel>Currently in</SectionLabel>
                <div className="mt-3 flex items-start gap-3">
                  <TriggerAvatar src={DEFAULT_AVATAR} size={48} />
                  <div className="min-w-0 flex-1 pt-0.5">
                    <p className="text-[15px] font-bold leading-tight text-foreground">
                      Guest
                    </p>
                    <p className="mt-0.5 text-[13px] text-muted-foreground">
                      Sign in to create and stake
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <SectionLabel>Your account</SectionLabel>
                <div className="mt-2 flex flex-col">
                  <MenuAction href="/leaderboard" className="px-1" onClick={close}>
                    Leaderboard
                  </MenuAction>
                  <MenuAction
                    className="px-1"
                    onClick={() => {
                      close();
                      router.push("/sign-in");
                    }}
                  >
                    Sign in
                  </MenuAction>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
