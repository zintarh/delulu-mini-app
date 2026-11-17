/**
 * Delulu's own mission stickers — same hand as Lulu, Flame and Trophy:
 * chunky ink outlines, our palette, and a little face on the friendly ones.
 * Picked from the mission's words, so admin-made missions get one too.
 */
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const INK = "#161615";
const Y = "#F6C324";
const Y2 = "#FBD65A";
const G = "#2DB36F";
const G2 = "#8ED9AF";
const P = "#EC5B8D";
const P2 = "#F7B3CC";
const V = "#8B5CF6";
const V2 = "#C9B5FB";
const O = "#F28B30";
const O2 = "#F8C08C";
const W = "#FFFFFF";
const s = { stroke: INK, strokeWidth: 3, strokeLinejoin: "round" as const, strokeLinecap: "round" as const };

/** Two dot eyes and a smile — Lulu's face, shrunk. */
function Face({ x, y, k = 1, blush = false }: { x: number; y: number; k?: number; blush?: boolean }) {
  return (
    <g>
      <circle cx={x - 5 * k} cy={y} r={2 * k} fill={INK} />
      <circle cx={x + 5 * k} cy={y} r={2 * k} fill={INK} />
      <path d={`M${x - 3.5 * k} ${y + 4 * k}q${3.5 * k} ${3 * k} ${7 * k} 0`} fill="none" stroke={INK} strokeWidth={2.4 * k} strokeLinecap="round" />
      {blush ? (
        <>
          <circle cx={x - 9 * k} cy={y + 4 * k} r={2.2 * k} fill={P} opacity={0.45} />
          <circle cx={x + 9 * k} cy={y + 4 * k} r={2.2 * k} fill={P} opacity={0.45} />
        </>
      ) : null}
    </g>
  );
}

const ART: Record<string, ReactNode> = {
  selfie: (
    <>
      <rect x="18" y="6" width="28" height="52" rx="7" fill={V2} {...s} />
      <rect x="22" y="13" width="20" height="34" rx="3" fill={W} {...s} />
      <Face x={32} y={27} k={0.85} blush />
      <circle cx="32" cy="52" r="2" fill={INK} />
      <path d="M50 12l3-3M53 18h4M50 24l3 3" {...s} fill="none" />
    </>
  ),
  food: (
    <>
      <path d="M24 14c-2 3 2 5 0 8M32 10c-2 3 2 5 0 8M40 14c-2 3 2 5 0 8" fill="none" {...s} stroke="#9A9A93" />
      <path d="M8 30h48a24 22 0 0 1-48 0z" fill={O} {...s} />
      <path d="M14 30h36" {...s} />
      <Face x={32} y={40} blush />
    </>
  ),
  snack: (
    <>
      <circle cx="32" cy="33" r="23" fill="#E8B26A" {...s} />
      <circle cx="21" cy="24" r="3" fill="#7A4A1E" />
      <circle cx="44" cy="22" r="2.6" fill="#7A4A1E" />
      <circle cx="46" cy="42" r="3" fill="#7A4A1E" />
      <circle cx="19" cy="43" r="2.4" fill="#7A4A1E" />
      <Face x={32} y={32} />
    </>
  ),
  drink: (
    <>
      <path d="M38 4l-4 16" {...s} stroke={INK} />
      <path d="M38 4l-4 16" stroke={Y} strokeWidth="2" strokeLinecap="round" />
      <path d="M16 20h32l-4 36H20z" fill={P2} {...s} />
      <path d="M17.5 30h29" {...s} />
      <Face x={32} y={41} blush />
    </>
  ),
  sky: (
    <>
      <circle cx="42" cy="20" r="11" fill={Y} {...s} />
      <path d="M42 3v3M57 20h3M53 9l2-2" {...s} fill="none" />
      <path d="M14 50a10 10 0 0 1 2-19.8 13 13 0 0 1 25-1.2A9.5 9.5 0 0 1 50 50z" fill={W} {...s} />
      <Face x={30} y={40} k={0.9} />
    </>
  ),
  outfit: (
    <>
      <path d="M22 8l-14 9 6 11 6-3v31h24V25l6 3 6-11-14-9c-1 5-5 8-10 8s-9-3-10-8z" fill={V} {...s} />
      <path d="M26 36h12" stroke={W} strokeWidth="3" strokeLinecap="round" />
      <circle cx="32" cy="44" r="2.4" fill={W} />
    </>
  ),
  shoes: (
    <>
      <path d="M8 44V24c4 0 8 2 10 6l6-2c4 8 14 10 24 10 6 0 9 3 9 6v4H8z" fill={G} {...s} />
      <path d="M8 48h49v6H8z" fill={W} {...s} />
      <path d="M24 32l4 6M30 30l4 6" stroke={W} strokeWidth="2.6" strokeLinecap="round" />
    </>
  ),
  beautiful: (
    <>
      {[0, 72, 144, 216, 288].map((r) => (
        <ellipse key={r} cx="32" cy="16" rx="9" ry="12" fill={P2} {...s} transform={`rotate(${r} 32 32)`} />
      ))}
      <circle cx="32" cy="32" r="11" fill={Y} {...s} />
      <Face x={32} y={31} k={0.7} />
    </>
  ),
  smile: (
    <>
      <circle cx="32" cy="32" r="24" fill={Y} {...s} />
      <path d="M21 25q3-4 6 0M37 25q3-4 6 0" fill="none" {...s} />
      <path d="M19 35h26a13 13 0 0 1-26 0z" fill={W} {...s} />
      <circle cx="16" cy="36" r="3" fill={P} opacity="0.45" />
      <circle cx="48" cy="36" r="3" fill={P} opacity="0.45" />
    </>
  ),
  home: (
    <>
      <path d="M12 30L32 10l20 20" fill="none" {...s} />
      <path d="M16 28v28h32V28L32 13z" fill={Y2} {...s} />
      <path d="M8 31L32 7l24 24" fill="none" stroke={O} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M32 50s-8-5-8-10a4 4 0 0 1 8-1 4 4 0 0 1 8 1c0 5-8 10-8 10z" fill={P} {...s} strokeWidth={2.4} />
    </>
  ),
  new: (
    <>
      <path d="M28 6c2 12 6 16 18 18-12 2-16 6-18 18-2-12-6-16-18-18 12-2 16-6 18-18z" fill={Y} {...s} />
      <path d="M48 38c1 6 3 8 9 9-6 1-8 3-9 9-1-6-3-8-9-9 6-1 8-3 9-9z" fill={P2} {...s} strokeWidth={2.4} />
      <circle cx="12" cy="50" r="3" fill={V} />
    </>
  ),
  discover: (
    <>
      <circle cx="27" cy="27" r="17" fill="#DDF3FF" {...s} />
      <path d="M40 40l14 14" stroke={INK} strokeWidth="7" strokeLinecap="round" />
      <path d="M40 40l14 14" stroke={V} strokeWidth="3" strokeLinecap="round" />
      <Face x={27} y={26} k={0.85} />
    </>
  ),
  adventure: (
    <>
      <path d="M32 58S14 38 14 25a18 18 0 0 1 36 0c0 13-18 33-18 33z" fill={P} {...s} />
      <circle cx="32" cy="25" r="7" fill={W} {...s} />
    </>
  ),
  love: (
    <>
      <path d="M32 54S8 40 8 23a12 12 0 0 1 24-4 12 12 0 0 1 24 4c0 17-24 31-24 31z" fill={P} {...s} />
      <Face x={32} y={28} blush />
    </>
  ),
  friend: (
    <>
      <path d="M6 54a14 16 0 0 1 28 0z" fill={G} {...s} />
      <circle cx="20" cy="26" r="11" fill={G2} {...s} />
      <path d="M30 54a14 16 0 0 1 28 0z" fill={Y} {...s} />
      <circle cx="44" cy="24" r="11" fill={Y2} {...s} />
      <Face x={20} y={25} k={0.55} />
      <Face x={44} y={23} k={0.55} />
    </>
  ),
  colourful: (
    <>
      <path d="M6 48a26 26 0 0 1 52 0" fill="none" stroke={INK} strokeWidth="13" strokeLinecap="round" />
      <path d="M6 48a26 26 0 0 1 52 0" fill="none" stroke={P} strokeWidth="7" strokeLinecap="round" />
      <path d="M15 48a17 17 0 0 1 34 0" fill="none" stroke={Y} strokeWidth="7" strokeLinecap="round" />
      <path d="M23 48a9 9 0 0 1 18 0" fill="none" stroke={G} strokeWidth="6" strokeLinecap="round" />
    </>
  ),
  green: (
    <>
      <path d="M12 52C10 28 26 10 54 10c0 28-16 44-42 42z" fill={G} {...s} />
      <path d="M12 52L36 28" fill="none" stroke={INK} strokeWidth="3" strokeLinecap="round" />
      <Face x={36} y={24} k={0.65} />
    </>
  ),
  view: (
    <>
      <rect x="10" y="8" width="44" height="48" rx="5" fill="#DDF3FF" {...s} />
      <circle cx="40" cy="22" r="5" fill={Y} />
      <path d="M12 46l12-12 9 9 7-6 12 12" fill={G2} stroke={INK} strokeWidth="3" strokeLinejoin="round" />
      <path d="M32 8v48M10 32h44" {...s} />
    </>
  ),
  work: (
    <>
      <rect x="12" y="12" width="40" height="28" rx="4" fill={V2} {...s} />
      <path d="M6 46h52l-4 8H10z" fill={W} {...s} />
      <Face x={32} y={24} k={0.75} />
    </>
  ),
  old: (
    <>
      <path d="M22 18L40 6" {...s} />
      <rect x="8" y="18" width="48" height="36" rx="7" fill={O2} {...s} />
      <circle cx="22" cy="36" r="9" fill={O} {...s} />
      <path d="M38 30h11M38 37h11M38 44h7" {...s} />
    </>
  ),
  week: (
    <>
      <rect x="9" y="12" width="46" height="44" rx="6" fill={W} {...s} />
      <path d="M9 24h46" {...s} />
      <path d="M11 13h42v11H11z" fill={P} />
      <path d="M9 24h46M21 8v8M43 8v8" {...s} fill="none" />
      <path d="M24 40l6 6 11-12" fill="none" stroke={G} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  book: (
    <>
      <path d="M32 16c-6-5-15-6-24-4v38c9-2 18-1 24 4 6-5 15-6 24-4V12c-9-2-18-1-24 4z" fill={Y2} {...s} />
      <path d="M32 16v38" {...s} />
      <path d="M14 22c4-1 9 0 12 1M14 30c4-1 9 0 12 1M38 23c3-1 8-2 12-1M38 31c3-1 8-2 12-1" fill="none" stroke={INK} strokeWidth="2" strokeLinecap="round" />
    </>
  ),
  move: (
    <>
      <circle cx="38" cy="11" r="6" fill={Y} {...s} />
      <path d="M36 20l-8 14 8 6-4 14M28 34l-10 4M36 24l10 8" fill="none" {...s} strokeWidth={4} />
      <path d="M8 48h10M10 42h8" stroke={G} strokeWidth="3" strokeLinecap="round" />
    </>
  ),
  pray: (
    <>
      {/* Glow */}
      <path d="M32 4v5M14 12l3 3M50 12l-3 3M8 28h4M56 28h-4" fill="none" stroke={Y} strokeWidth="3" strokeLinecap="round" />
      {/* Two hands, palms together */}
      <path d="M32 16c-5 5-9 14-9 22v9l9 5z" fill={O2} {...s} />
      <path d="M32 16c5 5 9 14 9 22v9l-9 5z" fill={O2} {...s} />
      <path d="M32 16v36" {...s} />
      {/* Sleeves */}
      <path d="M20 46l12 7v7H18v-9z" fill={V} {...s} />
      <path d="M44 46l-12 7v7h14v-9z" fill={V} {...s} />
    </>
  ),
  camera: (
    <>
      <path d="M8 22a5 5 0 0 1 5-5h8l4-6h14l4 6h8a5 5 0 0 1 5 5v26a5 5 0 0 1-5 5H13a5 5 0 0 1-5-5z" fill={Y} {...s} />
      <circle cx="32" cy="35" r="11" fill={W} {...s} />
      <circle cx="32" cy="35" r="4.5" fill={INK} />
      <circle cx="48" cy="25" r="2.4" fill={INK} />
    </>
  ),
};

const MATCH: [RegExp, keyof typeof ART][] = [
  [/pray|prayer/i, "pray"],
  [/selfie/i, "selfie"],
  [/snack|cookie/i, "snack"],
  [/\b(ate|eat|food|meal|lunch|dinner|breakfast)\b/i, "food"],
  [/drink|coffee|tea|juice/i, "drink"],
  [/sky|cloud|sunset|sunrise/i, "sky"],
  [/shoe|sneaker/i, "shoes"],
  [/outfit|wear|dress/i, "outfit"],
  [/beautiful|pretty|flower/i, "beautiful"],
  [/happy place|favourite place|favorite place/i, "home"],
  [/smile|laugh|makes you happy/i, "smile"],
  [/new|tried/i, "new"],
  [/discover|interesting|curious/i, "discover"],
  [/adventure|went|trip|somewhere/i, "adventure"],
  [/friend/i, "friend"],
  [/love/i, "love"],
  [/colou?rful|rainbow/i, "colourful"],
  [/green|plant|tree|nature/i, "green"],
  [/view|window/i, "view"],
  [/work|study|desk/i, "work"],
  [/old/i, "old"],
  [/week/i, "week"],
  [/book|read/i, "book"],
  [/walk|run|steps|gym|workout/i, "move"],
];

export function missionStickerKey(title: string): keyof typeof ART {
  for (const [re, key] of MATCH) if (re.test(title)) return key;
  return "camera";
}

export function MissionSticker({
  title,
  size = 40,
  muted = false,
  className,
}: {
  title: string;
  size?: number;
  /** Missed squares: faded and grey. */
  muted?: boolean;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      aria-hidden
      className={cn("shrink-0 overflow-visible", muted && "opacity-30 grayscale", className)}
    >
      {ART[missionStickerKey(title)]}
    </svg>
  );
}
