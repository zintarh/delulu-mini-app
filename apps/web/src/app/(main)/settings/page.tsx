"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Bell, Check, ChevronRight, Copy, Loader2, LogOut, Mail, Send, ShieldCheck, User, Wallet } from "lucide-react";

import { useAuth } from "@/hooks/use-auth";
import {
  getPushSupportState,
  subscribeToWebPush,
  unsubscribeWebPush,
  type PushSupportState,
} from "@/lib/web-push-client";
import { useUserStore } from "@/stores/useUserStore";
import { useUsernameByAddress } from "@/hooks/use-username-by-address";

import { AddEmailSheet } from "@/components/add-email-sheet";
import { useLogoutSheet } from "@/contexts/logout-sheet-context";
import { MainPage } from "@/components/main-app-header";
import { PageBackHeader } from "@/components/page-back-header";
import { GameButton, GameSwitch, Stamp } from "@/components/ds";
import { useGoodDollarClaim } from "@/hooks/useGoodDollarClaim";
import { useFaceCheck } from "@/contexts/right-panel-context";

import { TG_GROUP_URL } from "@/components/get-gas-modal";
import { cn, formatAddress } from "@/lib/utils";


export default function SettingsPage() {
  const router = useRouter();
  const { isConnected, address, isReady } = useAuth();
  const { user } = useUserStore();
  const { openLogoutSheet } = useLogoutSheet();
  const { isWhitelisted, isInitialized: isClaimReady } = useGoodDollarClaim();
  const { start: openVerify } = useFaceCheck();
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
  useEffect(() => {
    if (isReady && !isConnected) router.replace("/sign-in");
  }, [isReady, isConnected, router]);

  if (!isReady || !isConnected) return (
    <MainPage>
      <div className="sticky top-0 z-40 mx-auto max-w-xl bg-background/95 backdrop-blur-sm border-b border-border px-4 py-3 flex items-center gap-3 lg:max-w-4xl xl:max-w-6xl">
        <div className="h-9 w-9 animate-pulse rounded-full bg-muted/60" />
        <div className="h-5 w-24 animate-pulse rounded-md bg-muted/60" />
      </div>
      <div className="mx-auto max-w-xl px-4 pt-5 space-y-7 lg:max-w-4xl xl:max-w-6xl">
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

  const pushOn = pushState?.state === "ready" && pushState.subscribed;

  return (
    <>
      <MainPage>
        <PageBackHeader title="Settings" />

        {address && (
          <div className="mx-auto flex max-w-xl flex-col gap-5 px-5 pb-6 pt-6 lg:max-w-4xl xl:max-w-6xl">
            <section className="flex animate-rise flex-col gap-2">
              <SectionLabel>Account</SectionLabel>
              <SettingsCard>
                <Row icon={<User className="h-5 w-5" strokeWidth={2} />} title="Username">
                  <span className="label-mono truncate text-muted-foreground">
                    {displayUsername ? `@${displayUsername}` : "—"}
                  </span>
                </Row>
                {email ? (
                  <Row icon={<Mail className="h-5 w-5" strokeWidth={2} />} title="Email">
                    <span className="label-mono truncate text-muted-foreground">{email}</span>
                  </Row>
                ) : (
                  <Row icon={<Mail className="h-5 w-5" strokeWidth={2} />} title="Email" onClick={() => setAddEmailSheetOpen(true)}>
                    <span className="label-mono text-blue">Add</span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={2} />
                  </Row>
                )}
                <Row icon={<Wallet className="h-5 w-5" strokeWidth={2} />} title="Wallet" last>
                  <span className="label-mono text-muted-foreground">{formatAddress(address)}</span>
                  <button
                    type="button"
                    onClick={handleCopyAddress}
                    aria-label="Copy address"
                    className="press-edge inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-line bg-white shadow-edge-sm"
                  >
                    {copied ? <Check className="h-4 w-4 text-green-edge" strokeWidth={2.4} /> : <Copy className="h-4 w-4" strokeWidth={1.8} />}
                  </button>
                </Row>
              </SettingsCard>
            </section>

            {pushState && pushState.state !== "unsupported" ? (
              <section className="flex animate-rise flex-col gap-2">
                <SectionLabel>Preferences</SectionLabel>
                <SettingsCard>
                  <Row icon={<Bell className="h-5 w-5" strokeWidth={2} />} title="Push alerts" last>
                    {pushBusy ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null}
                    <GameSwitch checked={!!pushOn} onChange={() => void handleTogglePush()} label="Push alerts" />
                  </Row>
                </SettingsCard>
                {pushError ? <p className="text-xs text-orange">{pushError}</p> : null}
              </section>
            ) : null}

            <section className="flex animate-rise flex-col gap-2">
              <SectionLabel>Identity</SectionLabel>
              <SettingsCard>
                <Row icon={<ShieldCheck className="h-5 w-5" strokeWidth={2} />} title="Face verification" last>
                  {!isClaimReady ? (
                    <span className="h-6 w-20 animate-pulse rounded-lg bg-line" />
                  ) : isWhitelisted ? (
                    <Stamp tone="kept" className="text-[10px]">Verified</Stamp>
                  ) : (
                    <GameButton variant="blue" size="sm" onClick={openVerify}>
                      Verify
                    </GameButton>
                  )}
                </Row>
              </SettingsCard>
            </section>

            <section className="flex animate-rise flex-col gap-2">
              <SectionLabel>Help</SectionLabel>
              <SettingsCard>
                <Row
                  icon={<Send className="h-5 w-5" strokeWidth={2} />}
                  title="Join Telegram"
                  href={TG_GROUP_URL}
                  last
                >
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={2} />
                </Row>
              </SettingsCard>
            </section>

            <button
              type="button"
              onClick={openLogoutSheet}
              className="press-edge inline-flex h-[52px] w-full animate-rise items-center justify-center gap-2 rounded-2xl border-2 border-line bg-white font-bold text-orange shadow-edge"
            >
              <LogOut className="h-[18px] w-[18px]" strokeWidth={2} />
              Sign out
            </button>
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
  return <span className="label-mono text-muted-foreground">{children}</span>;
}

function SettingsCard({ children }: { children: React.ReactNode }) {
  return <div className="rounded-[20px] border-2 border-line bg-white px-4 shadow-edge">{children}</div>;
}

/** One settings row (design: Settings.dc.html — 56px, dashed divider). */
function Row({
  icon,
  title,
  children,
  last = false,
  href,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  children?: React.ReactNode;
  last?: boolean;
  href?: string;
  onClick?: () => void;
}) {
  const cls = cn(
    "flex min-h-14 w-full items-center gap-3 text-left text-ink no-underline",
    !last && "border-b border-dashed border-line",
  );
  const inner = (
    <>
      {icon}
      <span className="flex-1 font-medium">{title}</span>
      {children}
    </>
  );
  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>
        {inner}
      </a>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={cls}>
        {inner}
      </button>
    );
  }
  return <div className={cls}>{inner}</div>;
}
