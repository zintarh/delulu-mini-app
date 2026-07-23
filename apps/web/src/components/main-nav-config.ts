import {
  Compass,
  Home,
  Trophy,
  User,
  Wallet,
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
    | "explore"
    | "leaderboard"
    | "profile"
    | "wallet";
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

const coreNavItems = (): MainNavItem[] => [
  { icon: Home, label: "Home", href: "/", action: "home" },
  { icon: Compass, label: "Campaigns", href: "/explore", action: "explore" },
];

export function getWalletNavItem(): MainNavItem {
  return {
    icon: Wallet,
    label: "Wallet",
    href: "/wallet",
    action: "wallet",
  };
}

/** Desktop left sidebar */
export function getMainNavItems(authenticated: boolean): MainNavItem[] {
  return [
    ...coreNavItems(),
    {
      icon: Trophy,
      label: "Leaderboard",
      href: "/leaderboard",
      action: "leaderboard",
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

/** Mobile bottom nav — Wallet immediately before Profile */
export function getMobileBottomNavItems(authenticated: boolean): MainNavItem[] {
  return [...coreNavItems(), getWalletNavItem(), getProfileNavItem(authenticated)];
}

export function isMainNavItemActive(
  item: MainNavItem,
  pathname: string,
  options: {
    isHomeRoute: boolean;
    notificationsOpen: boolean;
    layoutSegment: string | null;
  },
): boolean {
  const path = normalizePathname(pathname);

  switch (item.action) {
    case "home":
      return options.isHomeRoute && !options.notificationsOpen;
    case "notifications":
      return options.notificationsOpen;
    case "create":
      return isNavHrefActive(path, "/board");
    case "wallet":
      return (
        options.layoutSegment === "wallet" ||
        isNavHrefActive(path, "/wallet")
      );
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
    case "profile":
      return (
        options.layoutSegment === "profile" ||
        isNavHrefActive(path, "/profile")
      );
    default:
      return false;
  }
}
