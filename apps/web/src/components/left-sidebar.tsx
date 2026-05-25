"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSelectedLayoutSegment } from "next/navigation";
import Link from "next/link";
import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { useNotificationsPanel, useClaimPanel } from "@/contexts/right-panel-context";
import { prefetchCreateManifestStep } from "@/components/create-delusion-content";
import {
  getMainNavItems,
  getProfileNavItem,
  isMainNavItemActive,
  normalizePathname,
} from "@/components/main-nav-config";

function Tooltip({ label }: { label: string }) {
  return (
    <span className="absolute left-[calc(100%+10px)] top-1/2 -translate-y-1/2 px-2.5 py-1.5 rounded-lg bg-foreground text-background text-xs font-semibold whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 shadow-md z-[200]">
      {label}
    </span>
  );
}

function NavIcon({ icon: Icon, active }: { icon: LucideIcon; active: boolean }) {
  return (
    <Icon
      className={cn(
        "h-7 w-7 transition-colors",
        active ? "text-delulu-blue" : "text-primary",
      )}
      strokeWidth={active ? 2.25 : 2}
      fill="none"
    />
  );
}

export function LeftSidebar() {
  const pathname = usePathname();
  const segment = useSelectedLayoutSegment();
  const router = useRouter();
  const { authenticated } = useAuth();
  const {
    isOpen: notificationsOpen,
    toggle: toggleNotifications,
  } = useNotificationsPanel();
  const { isOpen: claimOpen, toggle: toggleClaim, close: closePanels } =
    useClaimPanel();

  useEffect(() => {
    ["/", "/board", "/explore", "/profile", "/leaderboard"].forEach((href) => router.prefetch(href));
    void import("@/components/create-delusion-content");
    prefetchCreateManifestStep();
  }, [router]);

  const prefetchCreate = () => {
    router.prefetch("/board");
    void import("@/components/create-delusion-content");
    prefetchCreateManifestStep();
  };

  const path = normalizePathname(pathname ?? "");
  const isHomeRoute = segment === null && path === "/";
  const navItems = getMainNavItems(authenticated);
  const profileItem = getProfileNavItem(authenticated);
  const profileActive = isMainNavItemActive(profileItem, path, {
    isHomeRoute,
    notificationsOpen,
    claimOpen,
    layoutSegment: segment,
  });

  const activeOptions = {
    isHomeRoute,
    notificationsOpen,
    claimOpen,
    layoutSegment: segment,
  };

  const itemCls = (active: boolean) =>
    cn(
      "flex items-center justify-center w-14 h-14 rounded-xl border border-transparent transition-all",
      active
        ? "border-delulu-blue-border bg-delulu-blue-light"
        : "hover:bg-secondary/80",
    );

  return (
    <aside className="h-full flex flex-col items-center py-6 border-r border-border bg-background w-24">
      <div className="mb-8">
        <Link
          href="/"
          aria-label="Home"
          className="flex items-center justify-center w-14 h-14"
          onClick={() => closePanels()}
        >
          <span
            className="text-3xl font-black text-delulu-yellow-reserved leading-none"
            style={{
              fontFamily: "var(--font-gloria), cursive",
              textShadow: "2px 2px 0 #1a1a19, -1px -1px 0 #1a1a19",
            }}
          >
            D
          </span>
        </Link>
      </div>

      <nav className="flex-1 flex flex-col items-center gap-4">
        {navItems.map((item) => {
          const { icon, label, href, action } = item;
          const active = isMainNavItemActive(item, path, activeOptions);

          const handlePanelAction = () => {
            if (action === "notifications") {
              toggleNotifications();
              return;
            }
            closePanels();
            if (action === "claim") toggleClaim();
          };

          return (
            <div key={action} className="group relative">
              {href ? (
                <Link
                  href={href}
                  className={itemCls(active)}
                  aria-label={label}
                  aria-current={active ? "page" : undefined}
                  onClick={() => closePanels()}
                  onMouseEnter={() => {
                    router.prefetch(href);
                    if (action === "create") prefetchCreate();
                  }}
                >
                  <NavIcon icon={icon} active={active} />
                </Link>
              ) : authenticated ? (
                <button
                  type="button"
                  onClick={handlePanelAction}
                  onMouseEnter={action === "create" ? prefetchCreate : undefined}
                  className={itemCls(active)}
                  aria-label={label}
                  aria-expanded={
                    action === "claim"
                      ? claimOpen
                      : action === "notifications"
                        ? notificationsOpen
                        : undefined
                  }
                >
                  <NavIcon icon={icon} active={active} />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => router.push("/sign-in")}
                  className={itemCls(active)}
                  aria-label={label}
                >
                  <NavIcon icon={icon} active={active} />
                </button>
              )}
              <Tooltip label={label} />
            </div>
          );
        })}
      </nav>

      <div className="group relative mt-auto pt-4">
        {profileItem.href ? (
          <Link
            href={profileItem.href}
            className={itemCls(profileActive)}
            aria-label={profileItem.label}
            aria-current={profileActive ? "page" : undefined}
            onClick={() => closePanels()}
            onMouseEnter={() => router.prefetch(profileItem.href!)}
          >
            <NavIcon icon={profileItem.icon} active={profileActive} />
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => router.push("/sign-in")}
            className={itemCls(profileActive)}
            aria-label={profileItem.label}
          >
            <NavIcon icon={profileItem.icon} active={profileActive} />
          </button>
        )}
        <Tooltip label={profileItem.label} />
      </div>
    </aside>
  );
}
