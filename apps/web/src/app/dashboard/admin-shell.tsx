"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { usePendingMilestones } from "@/hooks/graph/useAdminDashboard";
import { ConnectorSelectionSheet } from "@/components/connector-selection-sheet";
import {
  LayoutDashboard,
  Target,
  Megaphone,
  Users,
  LogIn,
  LogOut,
  User,
  Menu,
  Bell,
  Building2,
} from "lucide-react";
import { cn, formatAddress } from "@/lib/utils";
import { isPlatformAdminRole, type GlobalRole } from "@/lib/dashboard/authorize-types";
import { DashboardToastProvider } from "@/components/dashboard/dashboard-toast";

const BASE = "/dashboard";

function NavSection({ label }: { label: string }) {
  return (
    <p className="mb-1.5 mt-4 px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40 first:mt-0">
      {label}
    </p>
  );
}

function NavItem({
  icon: Icon,
  label,
  active,
  badge,
  href,
  onNavigate,
}: {
  icon: React.ElementType;
  label: string;
  active?: boolean;
  badge?: number;
  href: string;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={cn(
        "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
        active
          ? "bg-delulu-blue-light text-delulu-blue font-semibold"
          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="flex-1">{label}</span>
      {badge !== undefined && badge > 0 ? (
        <span className="inline-flex min-w-[20px] items-center justify-center rounded-full bg-delulu-blue px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-white">
          {badge}
        </span>
      ) : null}
    </Link>
  );
}

function pageTitle(pathname: string): string {
  if (pathname === BASE) return "Home";
  if (
    pathname.startsWith(`${BASE}/markets`) ||
    pathname.startsWith(`${BASE}/milestones`)
  ) {
    return "Goals";
  }
  if (
    pathname.startsWith(`${BASE}/broadcasts`) ||
    pathname.startsWith(`${BASE}/send-email`)
  ) {
    return "Outreach";
  }
  if (
    pathname.startsWith(`${BASE}/users`) ||
    pathname.startsWith(`${BASE}/leaderboard`) ||
    pathname.startsWith(`${BASE}/rewards`)
  ) {
    return "People";
  }
  if (pathname.startsWith(`${BASE}/communities/new`)) return "Communities";
  if (pathname.startsWith(`${BASE}/communities/`)) return "Community";
  if (
    pathname.startsWith(`${BASE}/communities`) ||
    pathname.startsWith(`${BASE}/campaigns`)
  ) {
    return "Communities";
  }
  return "Dashboard";
}

function isGoalsPath(pathname: string) {
  return (
    pathname.startsWith(`${BASE}/markets`) ||
    pathname.startsWith(`${BASE}/milestones`)
  );
}

function isOutreachPath(pathname: string) {
  return (
    pathname.startsWith(`${BASE}/broadcasts`) ||
    pathname.startsWith(`${BASE}/send-email`)
  );
}

function isPeoplePath(pathname: string) {
  return (
    pathname.startsWith(`${BASE}/users`) ||
    pathname.startsWith(`${BASE}/leaderboard`) ||
    pathname.startsWith(`${BASE}/rewards`)
  );
}

function isCommunitiesPath(pathname: string) {
  return (
    pathname.startsWith(`${BASE}/communities`) ||
    pathname.startsWith(`${BASE}/campaigns`)
  );
}

export function AdminShell({
  children,
  staffRole,
  communityIds: _communityIds,
}: {
  children: React.ReactNode;
  staffRole?: GlobalRole | null;
  communityIds?: string[];
}) {
  const pathname = usePathname();
  const { address, isConnected } = useAuth();
  const { isAdmin } = useIsAdmin();
  const { milestones: pendingMilestones } = usePendingMilestones();
  const router = useRouter();
  const isPlatformAdmin = isPlatformAdminRole(staffRole ?? null);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showLoginSheet, setShowLoginSheet] = useState(false);

  const handleLogout = async () => {
    await fetch("/api/dashboard/auth/logout", { method: "POST" });
    router.replace("/signin");
  };

  const canModerate = Boolean(isConnected && isAdmin);
  const pendingCount = pendingMilestones.length;
  const title = pageTitle(pathname);

  const closeMobile = () => setSidebarOpen(false);

  return (
    <div className="flex h-screen overflow-hidden bg-[#f9f8f4] text-foreground">
      {sidebarOpen ? (
        <div
          className="fixed inset-0 z-30 bg-black/20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      ) : null}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-[212px] flex-col border-r border-[#e8e8e3] bg-white transition-transform duration-200 lg:static lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-14 items-center gap-2.5 border-b border-[#e8e8e3] px-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-delulu-blue">
            <span className="text-sm font-black text-white">D</span>
          </div>
          <span className="text-sm font-bold text-foreground">Dashboard</span>
        </div>

        <nav className="flex-1 overflow-y-auto p-3">
          <NavSection label="Menu" />
          <NavItem
            icon={LayoutDashboard}
            label="Home"
            href={BASE}
            active={pathname === BASE}
            onNavigate={closeMobile}
          />
          <NavItem
            icon={Building2}
            label="Communities"
            href={`${BASE}/communities`}
            active={isCommunitiesPath(pathname)}
            onNavigate={closeMobile}
          />
          <NavItem
            icon={Target}
            label="Goals"
            href={`${BASE}/markets`}
            active={isGoalsPath(pathname)}
            badge={pendingCount}
            onNavigate={closeMobile}
          />

          {isPlatformAdmin ? (
            <>
              <NavItem
                icon={Megaphone}
                label="Outreach"
                href={`${BASE}/broadcasts`}
                active={isOutreachPath(pathname)}
                onNavigate={closeMobile}
              />
              <NavItem
                icon={Users}
                label="People"
                href={`${BASE}/users`}
                active={isPeoplePath(pathname)}
                onNavigate={closeMobile}
              />
            </>
          ) : null}
        </nav>

        <div className="shrink-0 space-y-2 border-t border-[#e8e8e3] p-3">
          <div className="flex items-center gap-2 rounded-xl bg-[#f9f8f4] px-3 py-2">
            <div
              className={cn(
                "h-2 w-2 rounded-full",
                canModerate ? "bg-delulu-blue" : "bg-amber-400",
              )}
            />
            <p className="text-[11px] font-medium text-muted-foreground">
              {canModerate ? "Wallet linked" : "Read-only"}
            </p>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign out
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="z-20 flex h-14 shrink-0 items-center justify-between border-b border-[#e8e8e3] bg-white px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="flex items-center justify-center rounded-xl p-2 text-foreground hover:bg-muted/60 lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
            <h2 className="text-sm font-semibold text-foreground">{title}</h2>
          </div>

          <div className="flex items-center gap-2">
            {pendingCount > 0 ? (
              <Link
                href={`${BASE}/milestones`}
                className="relative flex items-center justify-center rounded-xl p-2 text-muted-foreground hover:bg-muted/60"
                title={`${pendingCount} pending milestone reviews`}
              >
                <Bell className="h-5 w-5" />
                <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-delulu-blue" />
              </Link>
            ) : null}

            {isConnected && address ? (
              <Link
                href="/profile"
                className="flex items-center gap-2 rounded-xl border border-[#e8e8e3] px-2.5 py-1.5 text-xs font-medium hover:bg-muted/40"
              >
                <User className="h-4 w-4" />
                <span className="hidden sm:inline">{formatAddress(address)}</span>
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => setShowLoginSheet(true)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#e8e8e3] px-3 py-2 text-xs font-bold hover:bg-muted/40"
              >
                <LogIn className="h-4 w-4" />
                Connect
              </button>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto scrollbar-hide">
          <DashboardToastProvider>{children}</DashboardToastProvider>
        </main>
      </div>

      <ConnectorSelectionSheet open={showLoginSheet} onOpenChange={setShowLoginSheet} />
    </div>
  );
}
