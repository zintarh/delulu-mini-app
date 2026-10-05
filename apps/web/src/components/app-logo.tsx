import { Lulu } from "@/components/ds/art";

/** Compact brand mark: Lulu, the Delulu mascot. */
export function AppLogo({ size = 32, className }: { size?: number; className?: string }) {
  return <Lulu size={size} className={className} label="Delulu" />;
}
