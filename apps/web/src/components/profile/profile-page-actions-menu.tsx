"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import {
  ArrowRightLeft,
  Check,
  Copy,
  Mail,
  MoreHorizontal,
  Settings,
} from "lucide-react";
import { cn, formatAddress } from "@/lib/utils";

interface ProfilePageActionsMenuProps {
  address: string;
  displayUsername: string | null;
  email: string | null;
  onTransfer: () => void;
  onAddEmail: () => void;
  className?: string;
}

function MenuItem({
  children,
  onClick,
  href,
  icon,
  description,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  href?: string;
  icon: React.ReactNode;
  description?: string;
}) {
  const inner = (
    <>
      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted/60 text-muted-foreground">
        {icon}
      </span>
      <span className="min-w-0 flex-1 text-left">
        <span
          className="block text-sm font-semibold text-foreground"
          style={{ fontFamily: "var(--font-manrope)" }}
        >
          {children}
        </span>
        {description ? (
          <span
            className="mt-0.5 block text-xs text-muted-foreground"
            style={{ fontFamily: "var(--font-manrope)" }}
          >
            {description}
          </span>
        ) : null}
      </span>
    </>
  );

  const cls =
    "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-muted/50";

  if (href) {
    return (
      <Link href={href} role="menuitem" className={cls} onClick={onClick}>
        {inner}
      </Link>
    );
  }

  return (
    <button type="button" role="menuitem" className={cls} onClick={onClick}>
      {inner}
    </button>
  );
}

function MenuPanel({
  address,
  displayUsername,
  email,
  copied,
  onCopyAddress,
  onTransfer,
  onAddEmail,
  onClose,
}: {
  address: string;
  displayUsername: string | null;
  email: string | null;
  copied: boolean;
  onCopyAddress: () => void;
  onTransfer: () => void;
  onAddEmail: () => void;
  onClose: () => void;
}) {
  return (
    <>
      <div className="border-b border-border/40 px-4 py-3">
        <p
          className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground"
          style={{ fontFamily: "var(--font-manrope)" }}
        >
          Account
        </p>
        {displayUsername ? (
          <p
            className="mt-1 truncate text-sm font-bold capitalize text-foreground"
            style={{ fontFamily: '"Clash Display", sans-serif' }}
          >
            {displayUsername}
          </p>
        ) : null}
        <p className="mt-0.5 truncate font-mono text-xs text-muted-foreground">
          {formatAddress(address)}
        </p>
      </div>

      <div className="p-2">
        <MenuItem
          icon={
            copied ? (
              <Check className="h-4 w-4 text-[#35d07f]" />
            ) : (
              <Copy className="h-4 w-4" />
            )
          }
          onClick={onCopyAddress}
        >
          {copied ? "Address copied" : "Copy wallet address"}
        </MenuItem>

        {email ? (
          <div className="flex items-center gap-3 rounded-xl px-3 py-2.5">
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted/60 text-muted-foreground">
              <Mail className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span
                className="block text-sm font-semibold text-foreground"
                style={{ fontFamily: "var(--font-manrope)" }}
              >
                Email
              </span>
              <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                {email}
              </span>
            </span>
          </div>
        ) : (
          <MenuItem
            icon={<Mail className="h-4 w-4 text-[#35d07f]" />}
            onClick={() => {
              onClose();
              onAddEmail();
            }}
          >
            Add email
          </MenuItem>
        )}

        <MenuItem
          icon={<ArrowRightLeft className="h-4 w-4 text-[#35d07f]" />}
          description="Send G$ or CELO"
          onClick={() => {
            onClose();
            onTransfer();
          }}
        >
          Transfer
        </MenuItem>

        <MenuItem
          icon={<Settings className="h-4 w-4" />}
          href="/settings"
          onClick={onClose}
        >
          Settings
        </MenuItem>
      </div>
    </>
  );
}

export function ProfilePageActionsMenu({
  address,
  displayUsername,
  email,
  onTransfer,
  onAddEmail,
  className,
}: ProfilePageActionsMenuProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, right: 16 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const updatePosition = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setMenuPos({
      top: rect.bottom + 8,
      right: Math.max(16, window.innerWidth - rect.right),
    });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        triggerRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    };
  }, []);

  const close = () => setOpen(false);

  const handleCopyAddress = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
      copyTimeoutRef.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  };

  const dropdown =
    open && mounted
      ? createPortal(
          <div
            ref={menuRef}
            role="menu"
            className={cn(
              "fixed z-[200] w-[min(100vw-2rem,280px)]",
              "overflow-hidden rounded-2xl border border-border/50 bg-card py-2",
              "shadow-[0_12px_40px_rgba(0,0,0,0.16)]",
            )}
            style={{
              top: menuPos.top,
              right: menuPos.right,
            }}
          >
            <MenuPanel
              address={address}
              displayUsername={displayUsername}
              email={email}
              copied={copied}
              onCopyAddress={() => void handleCopyAddress()}
              onTransfer={onTransfer}
              onAddEmail={onAddEmail}
              onClose={close}
            />
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <div className={cn("relative z-50", className)}>
        <button
          ref={triggerRef}
          type="button"
          onClick={() => {
            setOpen((v) => !v);
            if (!open) {
              requestAnimationFrame(updatePosition);
            }
          }}
          className={cn(
            "inline-flex h-10 w-10 items-center justify-center rounded-full border border-border/60 bg-card text-muted-foreground shadow-sm transition-colors hover:bg-muted/60 hover:text-foreground",
            open && "bg-muted/60 text-foreground ring-2 ring-delulu-blue/20",
          )}
          aria-label="Account options"
          aria-expanded={open}
          aria-haspopup="menu"
        >
          <MoreHorizontal className="h-5 w-5" />
        </button>
      </div>
      {dropdown}
    </>
  );
}
