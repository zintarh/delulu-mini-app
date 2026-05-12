"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { useTheme } from "@/contexts/theme-context";
import { usePendingMilestones } from "@/hooks/graph/useAdminDashboard";
import { ConnectorSelectionSheet } from "@/components/connector-selection-sheet";
import { CreateChallengeSheet } from "@/components/create-challenge-sheet";
import {
  LayoutDashboard,
  ShieldCheck,
  BarChart3,
  Megaphone,
  Users,
  Home,
  Trophy,
  LogIn,
  User,
  Menu,
  Moon,
  Sun,
  Zap,
  Bell,
  Mail,
} from "lucide-react";
import { cn, formatAddress } from "@/lib/utils";

function NavItem({
  icon: Icon,
  label,
  active,
  badge,
  href,
}: {
  icon: React.ElementType;
  label: string;
  active?: boolean;
  badge?: number;
  href: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
        active
          ? "bg-white/10 text-white font-semibold"
          : "text-white/55 hover:bg-white/[0.06] hover:text-white",
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="flex-1">{label}</span>
      {badge !== undefined && badge > 0 && (
        <span className="inline-flex min-w-[20px] items-center justify-center rounded-full bg-white/20 px-1.5 py-0.5 text-[10px] font-black tabular-nums text-white">
          {badge}
        </span>
      )}
    </Link>
  );
}

const BREADCRUMBS: Record<string, string> = {
  "/admin": "Overview",
  "/admin/milestones": "Milestone Queue",
  "/admin/markets": "All Markets",
  "/admin/broadcasts": "Broadcasts",
  "/admin/send-email": "Send Email",
  "/admin/users": "Users",
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/admin/login") return <>{children}</>;
  return <AdminShell pathname={pathname}>{children}</AdminShell>;
}

function AdminShell({ pathname, children }: { pathname: string; children: React.ReactNode }) {
  const { address, isConnected } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { isAdmin } = useIsAdmin();
  const { milestones: pendingMilestones } = usePendingMilestones();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showLoginSheet, setShowLoginSheet] = useState(false);
  const [showCreateChallengeSheet, setShowCreateChallengeSheet] = useState(false);

  const canModerate = Boolean(isConnected && isAdmin);
  const pendingCount = pendingMilestones.length;
  const breadcrumb = BREADCRUMBS[pathname] ?? "Admin";

  return (
    <div className="h-screen flex overflow-hidden bg-[#f6f7f9] dark:bg-[#0d0d0d] text-foreground">

      {sidebarOpen && (
        <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* ── Sidebar ─────────────────────────────────────────────────── */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-40 flex w-60 flex-col bg-[#111111] transition-transform duration-200 lg:static lg:translate-x-0",
        sidebarOpen ? "translate-x-0" : "-translate-x-full",
      )}>
        {/* Logo */}
        <div className="flex h-16 items-center gap-3 border-b border-white/10 px-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#fcff52]">
            <Zap className="h-4 w-4 text-[#111111]" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">Platform</p>
            <p className="text-sm font-black text-white leading-tight">Delulu Admin</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-5 px-3 space-y-6">
          <div>
            <p className="px-3 mb-2 text-[10px] font-bold uppercase tracking-widest text-white/30">
              Overview
            </p>
            <div className="space-y-0.5">
              <NavItem
                icon={LayoutDashboard}
                label="Dashboard"
                href="/admin"
                active={pathname === "/admin"}
              />
            </div>
          </div>

          <div>
            <p className="px-3 mb-2 text-[10px] font-bold uppercase tracking-widest text-white/30">
              Operations
            </p>
            <div className="space-y-0.5">
              <NavItem
                icon={ShieldCheck}
                label="Milestone Queue"
                href="/admin/milestones"
                active={pathname.startsWith("/admin/milestones")}
                badge={pendingCount}
              />
              <NavItem
                icon={BarChart3}
                label="All Markets"
                href="/admin/markets"
                active={pathname.startsWith("/admin/markets")}
              />
              <NavItem
                icon={Megaphone}
                label="Broadcasts"
                href="/admin/broadcasts"
                active={pathname.startsWith("/admin/broadcasts")}
              />
              <NavItem
                icon={Mail}
                label="Send Email"
                href="/admin/send-email"
                active={pathname.startsWith("/admin/send-email")}
              />
            </div>
          </div>

          <div>
            <p className="px-3 mb-2 text-[10px] font-bold uppercase tracking-widest text-white/30">
              Admin
            </p>
            <div className="space-y-0.5">
              <NavItem
                icon={Users}
                label="Users"
                href="/admin/users"
                active={pathname.startsWith("/admin/users")}
              />
              <NavItem icon={Home} label="Back to App" href="/" />
            </div>
          </div>
        </nav>

        {/* Status */}
        <div className="shrink-0 border-t border-white/10 p-4">
          <div className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2.5">
            <div className={cn("h-2 w-2 rounded-full", canModerate ? "bg-[#35d07f]" : "bg-amber-400")} />
            <p className="text-xs font-medium text-white/60">
              {canModerate ? "Admin connected" : "Read-only mode"}
            </p>
          </div>
          {isConnected && address && (
            <p className="mt-2 px-1 text-[10px] font-mono text-white/30 truncate">
              {formatAddress(address)}
            </p>
          )}
        </div>
      </aside>

      {/* ── Main ────────────────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        {/* Topbar */}
        <header className="shrink-0 z-20 flex h-16 items-center justify-between border-b border-border bg-card px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden flex items-center justify-center rounded-lg p-2 text-foreground hover:bg-muted transition-colors"
            >
              <Menu className="h-5 w-5" />
            </button>
            <p className="text-xs text-muted-foreground">
              Admin / <span className="font-semibold text-foreground">{breadcrumb}</span>
            </p>
          </div>

          <div className="flex items-center gap-2">
            {pendingCount > 0 && (
              <Link
                href="/admin/milestones"
                className="relative flex items-center justify-center rounded-lg p-2 text-muted-foreground hover:bg-muted transition-colors"
                title={`${pendingCount} milestones pending`}
              >
                <Bell className="h-5 w-5" />
                <span className="absolute top-1.5 right-1.5 flex h-2 w-2 rounded-full bg-red-500" />
              </Link>
            )}

            <button
              type="button"
              onClick={toggleTheme}
              className="flex items-center justify-center rounded-lg p-2 text-muted-foreground hover:bg-muted transition-colors"
            >
              {theme === "dark" ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
            </button>

            <button
              type="button"
              onClick={() => setShowCreateChallengeSheet(true)}
              className="hidden sm:inline-flex items-center gap-2 rounded-lg bg-foreground px-3 py-2 text-xs font-bold text-background hover:opacity-80 transition-opacity"
            >
              <Trophy className="h-3.5 w-3.5" />
              New Challenge
            </button>

            {isConnected && address ? (
              <Link
                href="/profile"
                className="flex items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors"
              >
                <User className="h-4 w-4" />
                <span className="hidden sm:inline">{formatAddress(address)}</span>
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => setShowLoginSheet(true)}
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs font-bold text-foreground hover:bg-muted transition-colors"
              >
                <LogIn className="w-4 h-4" />
                Connect
              </button>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto scrollbar-hide">
          {children}
        </main>
      </div>

      <ConnectorSelectionSheet open={showLoginSheet} onOpenChange={setShowLoginSheet} />
      <CreateChallengeSheet open={showCreateChallengeSheet} onOpenChange={setShowCreateChallengeSheet} />
    </div>
  );
}
