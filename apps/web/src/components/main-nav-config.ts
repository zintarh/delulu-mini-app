import {
  Bell,
  Compass,
  Flame,
  Gift,
  Home,
  Plus,
  Trophy,
  User,
  type LucideIcon,
} from "lucide-react";

export type MainNavItem = {
  icon: LucideIcon;
  label: string;
  href?: string;
  action:
    | "home"
    | "notifications"
    | "create"
    | "claim"
    | "explore"
    | "leaderboard"
    | "streaks"
    | "profile";
};

/** Normalize for comparisons; never use startsWith("/") — every path starts with "/". */
export function normalizePathname(pathname: string) {
  if (!pathname || pathname === "/") return "/";
  return pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
}

export function isNavHrefActive(pathname: string, href: string) {
  const path = normalizePathname(pathname);
  const target = normalizePathname(href);
  if (target === "/") return path === "/";
  return path === target || path.startsWith(`${target}/`);
}

const coreNavItems = (authenticated: boolean): MainNavItem[] => [
  { icon: Home, label: "Home", href: "/", action: "home" },
  { icon: Bell, label: "Updates", action: "notifications" },
  {
    icon: Plus,
    label: "Create",
    href: authenticated ? "/board" : undefined,
    action: "create",
  },
  { icon: Compass, label: "Explore", href: "/explore", action: "explore" },
  { icon: Gift, label: "Claim G$", action: "claim" },
];

/** Desktop left sidebar */
export function getMainNavItems(authenticated: boolean): MainNavItem[] {
  return [
    ...coreNavItems(authenticated),
    {
      icon: Trophy,
      label: "Leaderboard",
      href: "/leaderboard",
      action: "leaderboard",
    },
    {
      icon: Flame,
      label: "Streaks",
      href: "/streaks",
      action: "streaks",
    },
  ];
}

export function getProfileNavItem(authenticated: boolean): MainNavItem {
  return {
    icon: User,
    label: "Profile",
    href: authenticated ? "/profile" : undefined,
    action: "profile",
  };
}

/** Mobile bottom nav (no Updates — use header / /notifications on mobile) */
export function getMobileBottomNavItems(authenticated: boolean): MainNavItem[] {
  return [
    ...coreNavItems(authenticated).filter(
      (item) => item.action !== "notifications",
    ),
    getProfileNavItem(authenticated),
  ];
}

export function isMainNavItemActive(
  item: MainNavItem,
  pathname: string,
  options: {
    isHomeRoute: boolean;
    notificationsOpen: boolean;
    claimOpen: boolean;
    layoutSegment: string | null;
  },
): boolean {
  const path = normalizePathname(pathname);

  switch (item.action) {
    case "home":
      return (
        options.isHomeRoute && !options.notificationsOpen && !options.claimOpen
      );
    case "notifications":
      return options.notificationsOpen;
    case "create":
      return isNavHrefActive(path, "/board");
    case "claim":
      return options.claimOpen;
    case "explore":
      return (
        options.layoutSegment === "explore" ||
        isNavHrefActive(path, "/explore")
      );
    case "leaderboard":
      return (
        options.layoutSegment === "leaderboard" ||
        isNavHrefActive(path, "/leaderboard")
      );
    case "streaks":
      return (
        options.layoutSegment === "streaks" ||
        isNavHrefActive(path, "/streaks")
      );
    case "profile":
      return (
        options.layoutSegment === "profile" ||
        isNavHrefActive(path, "/profile")
      );
    default:
      return false;
  }
}
