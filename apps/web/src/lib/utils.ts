import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatAddress(address: string): string {
  if (!address) return "";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/**
 * Format a G$ (or other token) amount for display: use K for thousands, M for millions.
 * Use everywhere we display G$ amounts for consistent, compact display.
 */
export function formatGAmountInt(value: number): string {
  if (typeof value !== "number" || Number.isNaN(value)) return "0";
  const v = Math.round(value);
  if (v >= 1_000_000) return `${Math.round(v / 1_000_000)}M`;
  if (v >= 1_000) return `${Math.round(v / 1_000)}K`;
  return `${v}`;
}

export function formatGAmount(value: number): string {
  if (typeof value !== "number" || Number.isNaN(value)) return "0";
  if (value >= 1_000_000) {
    const m = value / 1_000_000;
    return m >= 10 ? `${Math.floor(m)}M` : m % 1 === 0 ? `${m}M` : `${m.toFixed(1)}M`;
  }
  if (value >= 1_000) {
    const k = value / 1_000;
    return k >= 10 ? `${Math.floor(k)}K` : k % 1 === 0 ? `${k}K` : `${k.toFixed(1)}K`;
  }
  if (value >= 100) return value % 1 === 0 ? `${Math.floor(value)}` : value.toFixed(1);
  if (value >= 1) return value.toFixed(2);
  if (value >= 0.01) return value.toFixed(2);
  if (value > 0) return value.toFixed(4);
  return "0";
}

/** "my 10,000 steps" → "My 10,000 steps". Only the first letter changes; the rest is left as typed. */
export function capitalizeFirst(text: string): string {
  const t = text.trimStart();
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : t;
}
