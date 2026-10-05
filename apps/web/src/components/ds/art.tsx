import { cn } from "@/lib/utils";

/**
 * Brand + game illustrations used across the redesign (see docs/redesign).
 * All are decorative by default (aria-hidden); pass `label` to expose one.
 */

type ArtProps = { size?: number; className?: string; label?: string };

function a11y(label?: string) {
  return label ? { role: "img", "aria-label": label } : { "aria-hidden": true as const };
}

const INK = "#161615";

export type LuluMood = "dream" | "kept" | "worried";

/** Lulu — the Delulu mascot and logo mark. */
export function Lulu({
  size = 40,
  mood = "dream",
  className,
  label,
}: ArtProps & { mood?: LuluMood }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={cn("shrink-0", className)} {...a11y(label)}>
      <path d="M30 11.5q3-7 10-5" fill="none" stroke={INK} strokeWidth="3" strokeLinecap="round" />
      <circle cx="32" cy="35" r="23.5" fill="#F6C324" stroke={INK} strokeWidth="3" />
      <circle cx="17.5" cy="40.5" r="3" fill="#F4A3B5" opacity=".85" />
      <circle cx="46.5" cy="40.5" r="3" fill="#F4A3B5" opacity=".85" />
      {mood === "dream" && (
        <>
          <ellipse cx="25" cy="31" rx="5.6" ry="7" fill="#fff" stroke={INK} strokeWidth="2.6" />
          <ellipse cx="39" cy="31" rx="5.6" ry="7" fill="#fff" stroke={INK} strokeWidth="2.6" />
          <circle cx="26.2" cy="27.6" r="2.7" fill={INK} />
          <circle cx="40.2" cy="27.6" r="2.7" fill={INK} />
          <path d="M27.5 42.5q4.5 3.6 9 0" fill="none" stroke={INK} strokeWidth="2.8" strokeLinecap="round" />
        </>
      )}
      {mood === "kept" && (
        <>
          <path d="M20.5 32q4.5-6 9 0M34.5 32q4.5-6 9 0" fill="none" stroke={INK} strokeWidth="3" strokeLinecap="round" />
          <path d="M25 39.5h14q-1 8-7 8t-7-8z" fill={INK} stroke={INK} strokeWidth="2" strokeLinejoin="round" />
          <path d="M28 44.5q4 2.2 8 0" fill="none" stroke="#F28B8B" strokeWidth="2.4" strokeLinecap="round" />
        </>
      )}
      {mood === "worried" && (
        <>
          <ellipse cx="25" cy="32" rx="5.2" ry="6.4" fill="#fff" stroke={INK} strokeWidth="2.6" />
          <ellipse cx="39" cy="32" rx="5.2" ry="6.4" fill="#fff" stroke={INK} strokeWidth="2.6" />
          <circle cx="25" cy="34.6" r="2.5" fill={INK} />
          <circle cx="39" cy="34.6" r="2.5" fill={INK} />
          <path d="M19.5 24.5l8 2.2M44.5 24.5l-8 2.2" fill="none" stroke={INK} strokeWidth="2.6" strokeLinecap="round" />
          <path d="M27.5 45q2.25-2.4 4.5 0t4.5 0" fill="none" stroke={INK} strokeWidth="2.6" strokeLinecap="round" />
        </>
      )}
    </svg>
  );
}

export function Flame({ size = 24, lit = true, className, label }: ArtProps & { lit?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={cn("shrink-0", className)} {...a11y(label)}>
      <path
        d="M12 2c1 3.5 6 6 6 12a6 6 0 0 1-12 0c0-3 1.6-4.8 2.6-5.6.2 1.6 1 2.8 2.2 3.2C10.4 8.6 11 5 12 2z"
        fill={lit ? "#F28B30" : "#E6E6E0"}
      />
      {lit && (
        <path
          d="M12 13c1 1.2 2.6 2.2 2.6 4.1a2.6 2.6 0 0 1-5.2 0c0-1.4.9-2.4 1.6-2.9.2.6.6 1 1 1-.2-.8-.2-1.5 0-2.2z"
          fill="#F6C324"
        />
      )}
    </svg>
  );
}

export function Coin({ size = 24, className, label }: ArtProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={cn("shrink-0", className)} {...a11y(label)}>
      <circle cx="12" cy="12" r="10" fill="#F6C324" stroke="#C99A0A" strokeWidth="2" />
      <circle cx="12" cy="12" r="6.3" fill="none" stroke="#C99A0A" strokeWidth="1.5" />
      <path
        d="M14.2 9.6a3 3 0 1 0 .3 4.1V12h-2"
        fill="none"
        stroke="#7A5A00"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Two overlapping coins, with an optional lock badge (not verified yet). */
export function CoinStack({ locked = false, className }: { locked?: boolean; className?: string }) {
  return (
    <span className={cn("relative block h-11 w-12 shrink-0", className)} aria-hidden>
      <Coin size={32} className="absolute left-0 top-2.5" />
      <Coin size={32} className="absolute left-3.5 top-0" />
      {locked && (
        <span className="absolute -bottom-1 -right-1 flex h-[22px] w-[22px] items-center justify-center rounded-full border-2 border-white bg-blue text-white">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
            <rect x="4" y="11" width="16" height="10" rx="2" />
            <path d="M8 11V7a4 4 0 0 1 8 0v4" />
          </svg>
        </span>
      )}
    </span>
  );
}

export function Bolt({ size = 24, color = "#2F6BE0", className, label }: ArtProps & { color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={cn("shrink-0", className)} {...a11y(label)}>
      <path d="M13 2 4 14h7l-1 8 9-12h-7z" fill={color} stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

export function Chest({ size = 60, grey = false, className, label }: ArtProps & { grey?: boolean }) {
  const [body, lid, band] = grey ? ["#E6E6E0", "#EFEFEA", "#9A9A93"] : ["#F6C324", "#FBD65A", INK];
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={cn("shrink-0", className)} {...a11y(label)}>
      <rect x="8" y="28" width="48" height="28" rx="6" fill={body} stroke={band} strokeWidth="3" />
      <path d="M6 30v-8a10 10 0 0 1 10-10h32a10 10 0 0 1 10 10v8z" fill={lid} stroke={band} strokeWidth="3" strokeLinejoin="round" />
      <rect x="28" y="12" width="8" height="44" fill={band} />
      <rect x="24" y="30" width="16" height="12" rx="3" fill="#fff" stroke={band} strokeWidth="3" />
    </svg>
  );
}

export function Trophy({ size = 48, className, label }: ArtProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={cn("shrink-0", className)} {...a11y(label)}>
      <path d="M18 8h28v14a14 14 0 0 1-28 0z" fill="#F6C324" stroke={INK} strokeWidth="3" strokeLinejoin="round" />
      <path d="M18 13H9v4a9 9 0 0 0 9 9M46 13h9v4a9 9 0 0 1-9 9" fill="none" stroke={INK} strokeWidth="3" strokeLinecap="round" />
      <path d="M32 36v10" stroke={INK} strokeWidth="3" />
      <rect x="20" y="46" width="24" height="10" rx="3" fill="#FBD65A" stroke={INK} strokeWidth="3" />
      <path d="M27 18l3 3 6-6" fill="none" stroke={INK} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Blue shield with a person and a green check — face verification. */
export function ShieldBadge({ size = 48, className, label }: ArtProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={cn("shrink-0", className)} {...a11y(label)}>
      <path d="M32 4 54 12v18c0 15-9.5 25-22 30C19.5 55 10 45 10 30V12z" fill="#2F6BE0" stroke={INK} strokeWidth="3" strokeLinejoin="round" />
      <path d="M32 11 47 16.5v13.5c0 10.5-6.4 18-15 21.8z" fill="#5A8BEB" />
      <circle cx="32" cy="26" r="7" fill="#fff" stroke={INK} strokeWidth="2.6" />
      <path d="M20.5 44a12 12 0 0 1 23 0" fill="#fff" stroke={INK} strokeWidth="2.6" strokeLinecap="round" />
      <circle cx="48" cy="48" r="10" fill="#1F9A5B" stroke={INK} strokeWidth="2.6" />
      <path d="M43.5 48l3 3 6-6" fill="none" stroke="#fff" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Green circular check with a pressed edge — a kept day. */
export function CheckDot({ size = 30, className }: { size?: number; className?: string }) {
  return (
    <span
      className={cn("flex shrink-0 items-center justify-center rounded-full bg-green-strong text-white shadow-[0_3px_0_#157041]", className)}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <svg width={size * 0.53} height={size * 0.53} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 6 9 17l-5-5" />
      </svg>
    </span>
  );
}
