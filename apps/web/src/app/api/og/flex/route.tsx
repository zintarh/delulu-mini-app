import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";

export const runtime = "edge";

const THEMES = {
  ink: { bg: "#161615", fg: "#FFFFFF", accent: "#F6C324", sub: "#A3A39C" },
  yellow: { bg: "#F6C324", fg: "#161615", accent: "#161615", sub: "#4A3D0A" },
  paper: { bg: "#F7F7F4", fg: "#161615", accent: "#B4410C", sub: "#5C5C56" },
} as const;

async function loadGoogleFont(family: string, weight: number, text: string): Promise<ArrayBuffer | null> {
  try {
    const url = `https://fonts.googleapis.com/css2?family=${family}:wght@${weight}&text=${encodeURIComponent(text)}`;
    const css = await (await fetch(url)).text();
    const src = css.match(/src: url\((.+?)\) format\('(opentype|truetype)'\)/);
    if (!src) return null;
    const res = await fetch(src[1]);
    return res.ok ? await res.arrayBuffer() : null;
  } catch {
    return null;
  }
}

/**
 * Shareable flex card image (1080×1350, story-friendly).
 * Query: user, streak, week (7 chars of 0/1), kept (0–100), level, kind=streak|week, theme=ink|yellow|paper
 */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const user = (q.get("user") ?? "").replace(/[^a-zA-Z0-9_.]/g, "").slice(0, 24);
  const streak = Math.max(0, Math.min(9999, Number(q.get("streak") ?? 0) || 0));
  const week = (q.get("week") ?? "0000000").replace(/[^01]/g, "").padEnd(7, "0").slice(0, 7);
  const level = Math.max(1, Math.min(999, Number(q.get("level") ?? 1) || 1));
  const kind = q.get("kind") === "week" ? "week" : "streak";
  const t = THEMES[(q.get("theme") as keyof typeof THEMES) ?? "ink"] ?? THEMES.ink;
  const keptDays = week.split("").filter((c) => c === "1").length;

  const displayText = `${streak}${keptDays}/7DAYSTREAKKEPTTHISWEEK`;
  const [display, brand, body] = await Promise.all([
    loadGoogleFont("Big+Shoulders+Display", 900, displayText),
    loadGoogleFont("Fredoka", 700, "delulu"),
    loadGoogleFont("Schibsted+Grotesk", 700, `@${user}Level${level}·staydelulu.xyzKEPTMYWORDkeptmyword0123456789 `),
  ]);
  const fonts = [
    display && { name: "Display", data: display, weight: 900 as const, style: "normal" as const },
    brand && { name: "Brand", data: brand, weight: 700 as const, style: "normal" as const },
    body && { name: "Body", data: body, weight: 700 as const, style: "normal" as const },
  ].filter(Boolean) as { name: string; data: ArrayBuffer; weight: 700 | 900; style: "normal" }[];

  return new ImageResponse(
    (
      <div
        style={{
          width: 1080,
          height: 1350,
          background: t.bg,
          color: t.fg,
          display: "flex",
          flexDirection: "column",
          padding: 84,
          fontFamily: "Body, sans-serif",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 72, fontWeight: 700, fontFamily: "Brand", letterSpacing: "-0.02em" }}>delulu</span>
          <span style={{ fontSize: 36, color: t.sub }}>{user ? `@${user}` : ""}</span>
        </div>

        {kind === "streak" ? (
          <div style={{ display: "flex", flexDirection: "column", marginTop: 140 }}>
            <span style={{ fontSize: 560, fontWeight: 900, fontFamily: "Display", lineHeight: 0.8, color: t.accent }}>{streak}</span>
            <span style={{ fontSize: 120, fontWeight: 900, fontFamily: "Display", marginTop: 40, textTransform: "uppercase" }}>Day streak</span>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", marginTop: 160 }}>
            <span style={{ fontSize: 400, fontWeight: 900, fontFamily: "Display", lineHeight: 0.8, color: t.accent }}>{keptDays}/7</span>
            <span style={{ fontSize: 120, fontWeight: 900, fontFamily: "Display", marginTop: 110, textTransform: "uppercase" }}>Kept this week</span>
            <div style={{ display: "flex", gap: 24, marginTop: 48 }}>
              {week.split("").map((c, i) => (
                <div
                  key={i}
                  style={{
                    width: 96,
                    height: 96,
                    borderRadius: 48,
                    border: `8px solid ${t.accent}`,
                    background: c === "1" ? t.accent : "transparent",
                  }}
                />
              ))}
            </div>
          </div>
        )}

        <div style={{ marginTop: "auto", display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <span style={{ fontSize: 40, color: t.sub }}>Level {level} · staydelulu.xyz</span>
          <span
            style={{
              fontSize: 40,
              fontWeight: 800,
              color: t.accent,
              border: `6px solid ${t.accent}`,
              borderRadius: 16,
              padding: "12px 24px",
              transform: "rotate(-8deg)",
              textTransform: "uppercase",
              letterSpacing: "0.12em",
            }}
          >
            Kept my word
          </span>
        </div>
      </div>
    ),
    { width: 1080, height: 1350, fonts },
  );
}
