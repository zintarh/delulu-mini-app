import type { SupportCategory } from "@/lib/support/rules";

/** Card header colour per category — our palette only. */
export const CATEGORY_THEME: Record<SupportCategory | "none", { band: string; icon: string }> = {
  fitness: { band: "bg-green-soft", icon: "text-green-edge" },
  learning: { band: "bg-yellow-soft", icon: "text-[#8a6a00]" },
  productivity: { band: "bg-ink", icon: "text-yellow" },
  personal_development: { band: "bg-pink-soft", icon: "text-pink" },
  finance: { band: "bg-yellow", icon: "text-ink" },
  lifestyle: { band: "bg-orange-soft", icon: "text-orange" },
  none: { band: "bg-paper", icon: "text-ink" },
};
