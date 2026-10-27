"use client";

import { useId } from "react";
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

export type LuluMood = "dream" | "kept" | "worried" | "gloomy" | "sad" | "storm";

/** Path of Lulu's body (viewBox units); shared by the fill and the shading layer. */
const LULU_BODY = "M120 44C180 44 216 92 216 150C216 206 176 240 120 240C64 240 24 206 24 150C24 92 60 44 120 44Z";

/**
 * Lulu — the Delulu mascot and logo mark: a little character with depth,
 * arms, feet and a sprout (the habit that's growing). `animated` brings the
 * mood to life — blinks, glances, breathing, plus a per-mood move (hop when
 * kept, shiver when worried, tears when sad); see the `lu-*` rules in
 * globals.css. Defaults to animating at mascot sizes (64px+) and staying
 * still as a logo/icon. Tiny sizes get bolder strokes so it stays crisp.
 */
export function Lulu({
  size = 40,
  mood = "dream",
  animated,
  wave = false,
  className,
  label,
}: ArtProps & { mood?: LuluMood; animated?: boolean; wave?: boolean }) {
  const uid = useId().replace(/:/g, "");
  const id = (name: string) => `lu-${name}-${uid}`;
  const url = (name: string) => `url(#${id(name)})`;
  const live = animated ?? size >= 64;
  // Strokes are in a 266-unit box: thicken them as Lulu shrinks so lines never go hairline.
  const k = size <= 32 ? 2.1 : size <= 48 ? 1.6 : size <= 72 ? 1.2 : 1;
  const sw = (w: number) => w * k;
  const fx = live && size >= 64;
  const frosty = mood === "storm";
  const eyeWhite = (cx: number, cy: number, rx: number, ry: number) => (
    <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={url("eye")} stroke={INK} strokeWidth={sw(3.5)} />
  );
  const star = (d: string, fill: string, cls: string) => (
    <path className={cn("lu-fx", cls)} d={d} fill={fill} stroke={INK} strokeWidth={sw(2.3)} strokeLinejoin="round" />
  );

  return (
    <svg
      width={size}
      height={size}
      viewBox="-13 -6 266 266"
      className={cn("shrink-0 overflow-visible", live && "lu-a", `lu-m-${mood}`, className)}
      {...a11y(label)}
    >
      <defs>
        <radialGradient id={id("body")} cx="0.36" cy="0.28" r="0.82">
          {frosty ? (
            <>
              <stop offset="0" stopColor="#FFFBEA" />
              <stop offset="0.5" stopColor="#ECE4BC" />
              <stop offset="1" stopColor="#B8AC72" />
            </>
          ) : (
            <>
              <stop offset="0" stopColor="#FFF3B8" />
              <stop offset="0.32" stopColor="#FFDA4D" />
              <stop offset="0.68" stopColor="#F6C324" />
              <stop offset="1" stopColor="#D08F04" />
            </>
          )}
        </radialGradient>
        <radialGradient id={id("shade")} cx="0.42" cy="0.38" r="0.66">
          <stop offset="0.72" stopColor="#9A5B00" stopOpacity="0" />
          <stop offset="1" stopColor="#9A5B00" stopOpacity="0.32" />
        </radialGradient>
        <radialGradient id={id("limb")} cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor={frosty ? "#F6F0D2" : "#FFE47E"} />
          <stop offset="1" stopColor={frosty ? "#C2B681" : "#DFA00A"} />
        </radialGradient>
        <linearGradient id={id("foot")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={frosty ? "#DCD2A0" : "#F3B51E"} />
          <stop offset="1" stopColor={frosty ? "#AFA36A" : "#C08404"} />
        </linearGradient>
        <radialGradient id={id("eye")} cx="0.42" cy="0.32" r="0.75">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="1" stopColor="#E7E6DE" />
        </radialGradient>
        <radialGradient id={id("iris")} cx="0.38" cy="0.32" r="0.7">
          <stop offset="0" stopColor="#6B4515" />
          <stop offset="0.55" stopColor="#2A1A08" />
          <stop offset="1" stopColor={INK} />
        </radialGradient>
        <radialGradient id={id("blush")} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#F48FA8" stopOpacity="0.9" />
          <stop offset="1" stopColor="#F48FA8" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={id("leaf")} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={frosty ? "#B9D8C4" : "#6EDC9C"} />
          <stop offset="1" stopColor={frosty ? "#6E9C80" : "#1F9A5B"} />
        </linearGradient>
        <radialGradient id={id("ground")} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor={INK} stopOpacity="0.24" />
          <stop offset="1" stopColor={INK} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={id("water")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#F2FAFF" />
          <stop offset="1" stopColor="#8FD0FF" />
        </linearGradient>
      </defs>

      <ellipse className="lu-shadow" cx="120" cy="250" rx="78" ry="9" fill={url("ground")} />

      <g className="lu-move">
        <ellipse cx="90" cy="236" rx="24" ry="13" fill={url("foot")} stroke={INK} strokeWidth={sw(3.5)} />
        <ellipse cx="150" cy="236" rx="24" ry="13" fill={url("foot")} stroke={INK} strokeWidth={sw(3.5)} />

        <g className="lu-body">
          <ellipse cx="36" cy="164" rx="15" ry="25" transform="rotate(24 36 164)" fill={url("limb")} stroke={INK} strokeWidth={sw(3.5)} />
          {wave ? (
            <g className="lu-wave">
              <ellipse cx="212" cy="104" rx="15" ry="26" transform="rotate(-32 212 104)" fill={url("limb")} stroke={INK} strokeWidth={sw(3.5)} />
            </g>
          ) : (
            <ellipse cx="204" cy="164" rx="15" ry="25" transform="rotate(-24 204 164)" fill={url("limb")} stroke={INK} strokeWidth={sw(3.5)} />
          )}

          <path d={LULU_BODY} fill={url("body")} stroke={INK} strokeWidth={sw(4)} />
          <path d={LULU_BODY} fill={url("shade")} />
          <ellipse cx="82" cy="88" rx="30" ry="16" transform="rotate(-28 82 88)" fill="#FFFFFF" opacity="0.5" />
          {size > 32 ? (
            <>
              <ellipse cx="60" cy="116" rx="6" ry="4" transform="rotate(-28 60 116)" fill="#FFFFFF" opacity="0.45" />
              <path d="M176 206q-18 18-44 22" fill="none" stroke="#FFF3B8" strokeWidth="4" strokeLinecap="round" opacity="0.55" />
            </>
          ) : null}

          <g className="lu-sprout">
            <path d="M118 46C114 30 120 16 134 12" fill="none" stroke={INK} strokeWidth={sw(4.5)} strokeLinecap="round" />
            <path d="M134 12C142 0 162 -1 170 8C162 20 146 22 134 12Z" fill={url("leaf")} stroke={INK} strokeWidth={sw(3)} strokeLinejoin="round" />
          </g>

          {frosty ? (
            <path d="M44 150l12 4M46 168l12-2M196 150l-12 4M194 168l-12-2" stroke="#FFFFFF" strokeWidth={sw(3.5)} strokeLinecap="round" />
          ) : mood !== "sad" ? (
            <>
              <circle cx="64" cy="166" r="17" fill={url("blush")} />
              <circle cx="176" cy="166" r="17" fill={url("blush")} />
            </>
          ) : null}

          {mood === "dream" && (
            <>
              <path d="M78 100q14-8 28-2M134 98q14-6 28 2" fill="none" stroke={INK} strokeWidth={sw(4)} strokeLinecap="round" />
              <g className="lu-eyes">
                {eyeWhite(94, 132, 18, 23)}
                {eyeWhite(146, 132, 18, 23)}
                <g className="lu-pupils">
                  <circle cx="97" cy="122" r="11" fill={url("iris")} />
                  <circle cx="149" cy="122" r="11" fill={url("iris")} />
                  <circle cx="101" cy="117" r="4.2" fill="#FFFFFF" />
                  <circle cx="153" cy="117" r="4.2" fill="#FFFFFF" />
                </g>
              </g>
              <path d="M106 172q14 13 28 0" fill="none" stroke={INK} strokeWidth={sw(4.5)} strokeLinecap="round" />
            </>
          )}

          {mood === "kept" && (
            <>
              <path d="M78 96q14-12 28-4M134 92q14-8 28 4" fill="none" stroke={INK} strokeWidth={sw(4)} strokeLinecap="round" />
              <path d="M76 138q18-20 36 0M128 138q18-20 36 0" fill="none" stroke={INK} strokeWidth={sw(5.5)} strokeLinecap="round" />
              <path d="M98 160h44q-2 30-22 30t-22-30z" fill="#3A1306" stroke={INK} strokeWidth={sw(3.5)} strokeLinejoin="round" />
              <path d="M106 179q14-10 28 0q-4 10-14 10t-14-10z" fill="#F28B8B" />
              <path d="M103 162h34" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" opacity="0.9" />
            </>
          )}

          {mood === "worried" && (
            <>
              <path d="M76 110l24-10M164 110l-24-10" fill="none" stroke={INK} strokeWidth={sw(4.5)} strokeLinecap="round" />
              <g className="lu-eyes">
                {eyeWhite(94, 136, 17, 21)}
                {eyeWhite(146, 136, 17, 21)}
                <g className="lu-pupils">
                  <circle cx="94" cy="140" r="8" fill={url("iris")} />
                  <circle cx="146" cy="140" r="8" fill={url("iris")} />
                  <circle cx="96.5" cy="137" r="3" fill="#FFFFFF" />
                  <circle cx="148.5" cy="137" r="3" fill="#FFFFFF" />
                </g>
              </g>
              <path d="M104 182q8-8 16 0t16 0" fill="none" stroke={INK} strokeWidth={sw(4.5)} strokeLinecap="round" />
              {fx ? <path className="lu-sweat" d="M180 96q-8 12 0 17q8-5 0-17z" fill={url("water")} stroke={INK} strokeWidth={sw(2.5)} strokeLinejoin="round" /> : null}
            </>
          )}

          {mood === "gloomy" && (
            <>
              <g className="lu-eyes">
                {eyeWhite(94, 138, 17, 18)}
                {eyeWhite(146, 138, 17, 18)}
                <circle cx="94" cy="144" r="8.5" fill={url("iris")} />
                <circle cx="146" cy="144" r="8.5" fill={url("iris")} />
                {/* Heavy lids */}
                <path d="M76 138a18 18 0 0 1 36 0zM128 138a18 18 0 0 1 36 0z" fill={url("limb")} stroke={INK} strokeWidth={sw(3.5)} strokeLinejoin="round" />
              </g>
              <path d="M106 182h28" fill="none" stroke={INK} strokeWidth={sw(4.5)} strokeLinecap="round" />
            </>
          )}

          {mood === "sad" && (
            <>
              <path d="M76 116l24-12M164 116l-24-12" fill="none" stroke={INK} strokeWidth={sw(4.5)} strokeLinecap="round" />
              <g className="lu-eyes">
                {eyeWhite(94, 140, 16, 19)}
                {eyeWhite(146, 140, 16, 19)}
                <circle cx="94" cy="147" r="9.5" fill={url("iris")} />
                <circle cx="146" cy="147" r="9.5" fill={url("iris")} />
                <circle cx="97" cy="143" r="3.4" fill="#FFFFFF" />
                <circle cx="149" cy="143" r="3.4" fill="#FFFFFF" />
              </g>
              <path className="lu-tear1" d="M82 158q-7 11 0 15q7-4 0-15z" fill={url("water")} stroke={INK} strokeWidth={sw(2.2)} strokeLinejoin="round" />
              {fx ? <path className="lu-tear2" d="M158 158q-7 11 0 15q7-4 0-15z" fill={url("water")} stroke={INK} strokeWidth={sw(2.2)} strokeLinejoin="round" /> : null}
              <path d="M102 194q18-16 36 0" fill="none" stroke={INK} strokeWidth={sw(4.5)} strokeLinecap="round" />
            </>
          )}

          {mood === "storm" && (
            <>
              <path d="M76 112l24-8M164 112l-24-8" fill="none" stroke={INK} strokeWidth={sw(4.5)} strokeLinecap="round" />
              <path d="M78 140q16 12 32 0M130 140q16 12 32 0" fill="none" stroke={INK} strokeWidth={sw(5)} strokeLinecap="round" />
              <path d="M98 190l6-6 6 6 6-6 6 6 6-6 6 6 6-6" fill="none" stroke={INK} strokeWidth={sw(4)} strokeLinecap="round" strokeLinejoin="round" />
            </>
          )}
        </g>
      </g>

      {fx && mood === "dream" ? (
        <>
          {star("M196 60l3 7 7 3-7 3-3 7-3-7-7-3 7-3z", "#FFFFFF", "lu-float1")}
          {star("M40 74l2.5 6 6 2.5-6 2.5-2.5 6-2.5-6-6-2.5 6-2.5z", "#F6C324", "lu-float2")}
        </>
      ) : null}
      {fx && mood === "kept" ? (
        <>
          {star("M28 70l4 9 9 4-9 4-4 9-4-9-9-4 9-4z", "#F6C324", "lu-tw1")}
          {star("M212 46l3.5 8 8 3.5-8 3.5-3.5 8-3.5-8-8-3.5 8-3.5z", "#FFFFFF", "lu-tw2")}
          {star("M222 140l3 6.5 6.5 3-6.5 3-3 6.5-3-6.5-6.5-3 6.5-3z", "#2DB36F", "lu-tw3")}
        </>
      ) : null}
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

export function Bolt({ size = 24, color = "#F6C324", className, label }: ArtProps & { color?: string }) {
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
      <path d="M32 4 54 12v18c0 15-9.5 25-22 30C19.5 55 10 45 10 30V12z" fill="#2DB36F" stroke={INK} strokeWidth="3" strokeLinejoin="round" />
      <path d="M32 11 47 16.5v13.5c0 10.5-6.4 18-15 21.8z" fill="#57C98D" />
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
