"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export type DashboardSectionTab = {
  href: string;
  label: string;
  /** Match this prefix for active state; defaults to href */
  match?: string;
  badge?: number;
};

/**
 * In-page subnav for collapsed dashboard sections (People, Goals, Outreach, Communities).
 */
export function DashboardSectionTabs({
  items,
  className,
}: {
  items: DashboardSectionTab[];
  className?: string;
}) {
  const pathname = usePathname();

  return (
    <div
      className={cn(
        "mb-5 flex flex-wrap items-center gap-1 rounded-full border border-border/60 bg-muted/30 p-1",
        className,
      )}
      role="tablist"
    >
      {items.map((item) => {
        const match = item.match ?? item.href;
        const active =
          pathname === match ||
          pathname === item.href ||
          (match !== "/dashboard" &&
            match !== "/dashboard/communities" &&
            pathname.startsWith(`${match}/`));

        return (
          <Link
            key={item.href}
            href={item.href}
            role="tab"
            aria-selected={active}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors sm:text-sm",
              active
                ? "bg-foreground text-background shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {item.label}
            {item.badge !== undefined && item.badge > 0 ? (
              <span
                className={cn(
                  "inline-flex min-w-[1.15rem] items-center justify-center rounded-full px-1 py-0.5 text-[10px] font-bold tabular-nums",
                  active ? "bg-white/20 text-white" : "bg-delulu-blue text-white",
                )}
              >
                {item.badge}
              </span>
            ) : null}
          </Link>
        );
      })}
    </div>
  );
}

export const PEOPLE_SECTION_TABS: DashboardSectionTab[] = [
  { href: "/dashboard/users", label: "Directory", match: "/dashboard/users" },
  { href: "/dashboard/leaderboard", label: "Leaderboard", match: "/dashboard/leaderboard" },
  { href: "/dashboard/rewards", label: "Reward history", match: "/dashboard/rewards" },
];

export function goalsSectionTabs(pendingCount = 0): DashboardSectionTab[] {
  return [
    { href: "/dashboard/markets", label: "All goals", match: "/dashboard/markets" },
    {
      href: "/dashboard/milestones",
      label: "Pending review",
      match: "/dashboard/milestones",
      badge: pendingCount,
    },
  ];
}

export const OUTREACH_SECTION_TABS: DashboardSectionTab[] = [
  {
    href: "/dashboard/broadcasts",
    label: "Milestone nudges",
    match: "/dashboard/broadcasts",
  },
  { href: "/dashboard/send-email", label: "Custom email", match: "/dashboard/send-email" },
];

export const COMMUNITIES_SECTION_TABS: DashboardSectionTab[] = [
  { href: "/dashboard/communities", label: "Communities", match: "/dashboard/communities" },
  { href: "/dashboard/campaigns", label: "All campaigns", match: "/dashboard/campaigns" },
];
