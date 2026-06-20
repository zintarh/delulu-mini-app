"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/** Active filter / pagination pill — Delulu blue */
export const adminPillActive =
  "border-delulu-blue bg-delulu-blue text-white";

export const adminPillInactive =
  "border-border bg-white text-foreground hover:bg-muted";

export function AdminPageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
        {description ? (
          <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

export function AdminKpiCard({
  label,
  value,
  icon: Icon,
  accent = "blue",
  isLoading,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  accent?: "blue" | "neutral" | "warning";
  isLoading?: boolean;
}) {
  const border = {
    blue: "border-l-delulu-blue",
    neutral: "border-l-border",
    warning: "border-l-destructive",
  };
  const iconColor = {
    blue: "text-delulu-blue bg-delulu-blue-light",
    neutral: "text-muted-foreground bg-muted/60",
    warning: "text-destructive bg-destructive/10",
  };

  return (
    <div
      className={cn(
        "rounded-xl border border-border border-l-4 bg-white px-5 py-5 shadow-sm",
        border[accent],
      )}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            {label}
          </p>
          {isLoading ? (
            <div className="mt-2 h-8 w-12 rounded bg-muted animate-pulse" />
          ) : (
            <p className="mt-2 text-3xl font-bold tabular-nums text-foreground">{value}</p>
          )}
        </div>
        <div
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-xl",
            iconColor[accent],
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

export function AdminKpiStrip({
  icon: Icon,
  children,
}: {
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-6 inline-flex items-center gap-2 rounded-xl border border-border bg-white px-4 py-2.5 shadow-sm">
      <Icon className="h-4 w-4 text-delulu-blue" />
      {children}
    </div>
  );
}

export function AdminQuickLink({
  href,
  icon: Icon,
  label,
  description,
  badge,
}: {
  href: string;
  icon: React.ElementType;
  label: string;
  description: string;
  badge?: number;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-4 rounded-xl border border-border bg-white px-5 py-4 shadow-sm hover:border-delulu-blue-border hover:bg-delulu-blue-light/40 transition-colors"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-delulu-blue-light text-delulu-blue">
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-bold text-foreground">{label}</p>
          {badge !== undefined && badge > 0 ? (
            <span className="inline-flex min-w-[20px] items-center justify-center rounded-full bg-delulu-blue px-1.5 py-0.5 text-[10px] font-bold text-white tabular-nums">
              {badge}
            </span>
          ) : null}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 truncate">{description}</p>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 group-hover:translate-x-0.5 group-hover:text-delulu-blue transition-all" />
    </Link>
  );
}

export function AdminAlertBanner({
  href,
  message,
  actionLabel = "Review →",
}: {
  href: string;
  message: string;
  actionLabel?: string;
}) {
  return (
    <Link
      href={href}
      className="mb-6 flex items-center justify-between rounded-xl border border-delulu-blue-border bg-delulu-blue-light px-4 py-3 hover:bg-delulu-blue-light/80 transition-colors"
    >
      <p className="text-sm font-semibold text-foreground">{message}</p>
      <span className="text-xs font-bold text-delulu-blue">{actionLabel}</span>
    </Link>
  );
}

export function AdminTableCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
      {children}
    </div>
  );
}

export function AdminStatusBadge({
  isResolved,
  isCancelled,
}: {
  isResolved: boolean;
  isCancelled: boolean;
}) {
  if (isCancelled) {
    return (
      <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
        Cancelled
      </span>
    );
  }
  if (isResolved) {
    return (
      <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
        Resolved
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-delulu-blue-light px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-delulu-blue">
      Active
    </span>
  );
}

export function AdminFilterPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors",
        active ? adminPillActive : adminPillInactive,
      )}
    >
      {children}
    </button>
  );
}

export function AdminPagination({
  page,
  totalPages,
  onPage,
}: {
  page: number;
  totalPages: number;
  onPage: (p: number) => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between border-t border-border px-5 py-3">
      <p className="text-xs text-muted-foreground">
        Page {page} of {totalPages}
      </p>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onPage(page - 1)}
          disabled={page === 1}
          className="inline-flex items-center justify-center rounded-lg border border-border bg-white p-1.5 text-foreground disabled:opacity-40 hover:bg-muted transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        {Array.from({ length: totalPages }, (_, i) => i + 1)
          .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
          .reduce<(number | "...")[]>((acc, p, i, arr) => {
            if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push("...");
            acc.push(p);
            return acc;
          }, [])
          .map((p, i) =>
            p === "..." ? (
              <span key={`ellipsis-${i}`} className="px-1 text-xs text-muted-foreground">
                …
              </span>
            ) : (
              <button
                key={p}
                type="button"
                onClick={() => onPage(p as number)}
                className={cn(
                  "min-w-[30px] rounded-lg border px-2 py-1 text-xs font-bold transition-colors",
                  page === p ? adminPillActive : adminPillInactive,
                )}
              >
                {p}
              </button>
            ),
          )}
        <button
          type="button"
          onClick={() => onPage(page + 1)}
          disabled={page === totalPages}
          className="inline-flex items-center justify-center rounded-lg border border-border bg-white p-1.5 text-foreground disabled:opacity-40 hover:bg-muted transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export function AdminPrimaryButton({
  className,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex items-center gap-2 rounded-lg bg-delulu-blue px-4 py-2.5 text-sm font-semibold text-white hover:bg-delulu-blue/90 disabled:opacity-40 transition-colors",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function AdminRowCheckbox({
  checked,
  indeterminate,
  onChange,
}: {
  checked: boolean;
  indeterminate?: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onChange();
      }}
      className={cn(
        "flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors",
        checked || indeterminate
          ? "border-delulu-blue bg-delulu-blue"
          : "border-border bg-white hover:border-delulu-blue/50",
      )}
    >
      {checked ? (
        <svg className="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 10 10">
          <path
            d="M1.5 5l2.5 2.5 4.5-4.5"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : null}
      {!checked && indeterminate ? <div className="w-2 h-0.5 bg-white rounded" /> : null}
    </button>
  );
}
