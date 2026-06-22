"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, X } from "lucide-react";
import type { SelectHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalDescription,
} from "@/components/ui/modal";

/* ─── Layout ───────────────────────────────────────────────────────────── */

export function DashboardPage({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8", className)}>
      {children}
    </div>
  );
}

export function DashboardPageHeader({
  title,
  action,
}: {
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex items-center justify-between gap-4">
      <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">{title}</h1>
      {action}
    </div>
  );
}

/* ─── Stats ──────────────────────────────────────────────────────────── */

export function DashboardStatGrid({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4", className)}>{children}</div>
  );
}

export function DashboardStat({
  label,
  value,
  isLoading,
}: {
  label: string;
  value: number | string;
  isLoading?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-[#e8e8e3] bg-white px-4 py-4 shadow-sm">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      {isLoading ? (
        <div className="mt-2 h-8 w-14 animate-pulse rounded-lg bg-muted" />
      ) : (
        <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">{value}</p>
      )}
    </div>
  );
}

/* ─── Cards (Pinterest-style) ────────────────────────────────────────── */

export function DashboardCardGrid({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function DashboardCard({
  href,
  onClick,
  children,
  className,
}: {
  href?: string;
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  const classes = cn(
    "group block rounded-2xl border border-[#e8e8e3] bg-white p-4 shadow-sm transition-all",
    "hover:border-delulu-blue/30 hover:shadow-md",
    onClick && "cursor-pointer text-left w-full",
    className,
  );

  if (href) {
    return (
      <Link href={href} className={classes}>
        {children}
      </Link>
    );
  }

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={classes}>
        {children}
      </button>
    );
  }

  return <div className={classes}>{children}</div>;
}

export function DashboardCardAvatar({
  label,
  className,
}: {
  label: string;
  className?: string;
}) {
  const hue = label.charCodeAt(0) % 360;
  return (
    <div
      className={cn(
        "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-lg font-bold text-white",
        className,
      )}
      style={{ backgroundColor: `hsl(${hue} 55% 48%)` }}
    >
      {label[0]?.toUpperCase() ?? "?"}
    </div>
  );
}

export function DashboardEmpty({
  icon: Icon,
  title,
  action,
}: {
  icon: React.ElementType;
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#e8e8e3] bg-white py-16 text-center">
      <Icon className="mb-3 h-10 w-10 text-muted-foreground/25" />
      <p className="text-sm font-semibold text-foreground">{title}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

/* ─── Status ─────────────────────────────────────────────────────────── */

const STATUS_STYLES: Record<string, string> = {
  active: "bg-emerald-50 text-emerald-700",
  draft: "bg-muted text-muted-foreground",
  pending_approval: "bg-amber-50 text-amber-700",
  approved: "bg-delulu-blue-light text-delulu-blue",
  funding: "bg-violet-50 text-violet-700",
  ended: "bg-muted text-muted-foreground",
  rejected: "bg-red-50 text-red-600",
  archived: "bg-muted text-muted-foreground",
};

export function StatusChip({ status }: { status: string }) {
  const key = status.toLowerCase().replace(/\s+/g, "_");
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        STATUS_STYLES[key] ?? "bg-muted text-muted-foreground",
      )}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}

/* ─── Nav card (overview quick links) ────────────────────────────────── */

export function DashboardNavCard({
  href,
  icon: Icon,
  label,
  badge,
}: {
  href: string;
  icon: React.ElementType;
  label: string;
  badge?: number;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 rounded-2xl border border-[#e8e8e3] bg-white px-4 py-4 shadow-sm hover:border-delulu-blue/30 transition-all"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-delulu-blue-light text-delulu-blue">
        <Icon className="h-5 w-5" />
      </div>
      <span className="flex-1 text-sm font-semibold text-foreground">{label}</span>
      {badge !== undefined && badge > 0 ? (
        <span className="rounded-full bg-delulu-blue px-2 py-0.5 text-[10px] font-bold text-white tabular-nums">
          {badge}
        </span>
      ) : null}
      <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-delulu-blue transition-colors" />
    </Link>
  );
}

/* ─── Buttons ────────────────────────────────────────────────────────── */

export function DashboardPrimaryButton({
  className,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl bg-delulu-blue px-4 py-2.5 text-sm font-semibold text-white hover:bg-delulu-blue/90 disabled:opacity-50 transition-colors",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function DashboardIconButton({
  className,
  children,
  title,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { title?: string }) {
  return (
    <button
      type="button"
      title={title}
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[#e8e8e3] bg-white text-muted-foreground hover:text-foreground hover:border-delulu-blue/30 transition-colors",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

/* ─── Table ──────────────────────────────────────────────────────────── */

export function hasTableCellValue(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string" && value.trim() === "") return false;
  return true;
}

export function DashboardTableCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-[#e8e8e3] bg-white shadow-sm">
      {children}
    </div>
  );
}

export function DashboardTableLoading() {
  return (
    <div className="flex justify-center py-20">
      <div className="h-7 w-7 animate-spin rounded-full border-2 border-[#e8e8e3] border-t-delulu-blue" />
    </div>
  );
}

export function DashboardTableEmptyState({
  icon: Icon,
  title,
}: {
  icon: React.ElementType;
  title: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2 py-20">
      <Icon className="h-9 w-9 text-muted-foreground/25" />
      <p className="text-sm font-medium text-muted-foreground">{title}</p>
    </div>
  );
}

export function DashboardTableScroll({
  children,
  minWidth,
}: {
  children: React.ReactNode;
  minWidth?: string;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left" style={minWidth ? { minWidth } : undefined}>
        {children}
      </table>
    </div>
  );
}

export function DashboardTableHead({ children }: { children: React.ReactNode }) {
  return <thead>{children}</thead>;
}

export function DashboardTableHeadRow({ children }: { children: React.ReactNode }) {
  return (
    <tr className="border-b border-[#e8e8e3] bg-gradient-to-b from-[#fafaf8] to-[#f5f5f2]">
      {children}
    </tr>
  );
}

export function DashboardTableHeadCell({
  children,
  align = "left",
  className,
}: {
  children?: React.ReactNode;
  align?: "left" | "right" | "center";
  className?: string;
}) {
  return (
    <th
      className={cn(
        "px-4 py-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground",
        align === "right" && "text-right",
        align === "center" && "text-center",
        className,
      )}
    >
      {children}
    </th>
  );
}

export function DashboardTableBody({ children }: { children: React.ReactNode }) {
  return <tbody className="[&_tr:last-child]:border-0">{children}</tbody>;
}

export function DashboardTableRow({
  children,
  onClick,
  selected,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  selected?: boolean;
}) {
  return (
    <tr
      onClick={onClick}
      className={cn(
        "border-b border-[#f0f0eb] transition-colors",
        onClick && "cursor-pointer",
        selected ? "bg-delulu-blue-light/35" : "hover:bg-[#f9f8f4]",
      )}
    >
      {children}
    </tr>
  );
}

export function DashboardTableCell({
  children,
  align = "left",
  className,
  onClick,
}: {
  children?: React.ReactNode;
  align?: "left" | "right" | "center";
  className?: string;
  onClick?: React.MouseEventHandler<HTMLTableCellElement>;
}) {
  return (
    <td
      onClick={onClick}
      className={cn(
        "px-4 py-3.5 align-middle text-sm",
        align === "right" && "text-right",
        align === "center" && "text-center",
        className,
      )}
    >
      {children}
    </td>
  );
}

/* ─── Table shell (legacy alias) ─────────────────────────────────────── */

export function DashboardPanel({ children }: { children: React.ReactNode }) {
  return <DashboardTableCard>{children}</DashboardTableCard>;
}

/* ─── Toast ──────────────────────────────────────────────────────────── */

export function DashboardToast({
  message,
  onDismiss,
}: {
  message: string;
  onDismiss?: () => void;
}) {
  return (
    <div className="fixed bottom-6 left-1/2 z-[100] flex -translate-x-1/2 items-center gap-2 rounded-full border border-[#e8e8e3] bg-white px-4 py-2.5 text-sm font-medium text-foreground shadow-lg">
      {message}
      {onDismiss ? (
        <button type="button" onClick={onDismiss} className="ml-1 text-muted-foreground hover:text-foreground">
          <X className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </div>
  );
}

export { DashboardToastProvider, useDashboardToast } from "@/components/dashboard/dashboard-toast";

/* ─── Modal wrapper ──────────────────────────────────────────────────── */

/** Standard admin dashboard modal — intentionally larger than app modals. */
export const DASHBOARD_MODAL_CONTENT_CLASS =
  "max-w-2xl w-[calc(100%-2rem)] bg-white p-8";

/** Wide admin workflows (broadcast composer, split layouts). */
export const DASHBOARD_MODAL_LARGE_CLASS =
  "max-w-6xl w-[calc(100%-2rem)] max-h-[92vh] bg-white";

export function DashboardModal({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
  size = "default",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  size?: "default" | "large";
}) {
  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent
        className={cn(
          size === "large" ? DASHBOARD_MODAL_LARGE_CLASS : DASHBOARD_MODAL_CONTENT_CLASS,
          className,
        )}
      >
        <ModalHeader>
          <ModalTitle className="text-xl font-bold">{title}</ModalTitle>
          {description ? (
            <ModalDescription className="text-sm text-muted-foreground">
              {description}
            </ModalDescription>
          ) : null}
        </ModalHeader>
        {children}
      </ModalContent>
    </Modal>
  );
}

export function DashboardField({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold text-foreground">
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </label>
      {children}
    </div>
  );
}

export const dashboardInputClass =
  "w-full rounded-xl border border-[#e8e8e3] bg-[#f9f8f4] px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-delulu-blue/30 text-foreground";

export function DashboardSelect({
  className,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(dashboardInputClass, className)} {...props} />;
}
