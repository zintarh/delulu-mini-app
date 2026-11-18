import { ImageResponse } from "next/og";
import sharp from "sharp";
import type { NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/push/supabase";
import { squareTint } from "@/lib/bingo/mission-art";
import type { BingoMission, BingoTier } from "@/lib/bingo/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Same palette as the in-app flex card (components/bingo/bingo-flex-card.tsx). */
const THEMES: Record<string, { bg: string; fg: string; sub: string; accent: string; frame: string; chipBg: string; chipFg: string }> = {
  starter: { bg: "#F6C324", fg: "#161615", sub: "#5c4a0a", accent: "#161615", frame: "#161615", chipBg: "#161615", chipFg: "#F6C324" },
  pro: { bg: "#EC5B8D", fg: "#ffffff", sub: "#ffe3ee", accent: "#ffffff", frame: "#161615", chipBg: "#ffffff", chipFg: "#C23E6E" },
  elite: { bg: "#161615", fg: "#ffffff", sub: "#bdbdb5", accent: "#F6C324", frame: "#F6C324", chipBg: "#F6C324", chipFg: "#161615" },
  entry: { bg: "#2DB36F", fg: "#ffffff", sub: "#dff7e9", accent: "#ffffff", frame: "#161615", chipBg: "#ffffff", chipFg: "#157041" },
};

async function font(family: string, weight: number, text: string): Promise<ArrayBuffer | null> {
  try {
    const css = await (await fetch(`https://fonts.googleapis.com/css2?family=${family}:wght@${weight}&text=${encodeURIComponent(text)}`)).text();
    const src = css.match(/src: url\((.+?)\) format\('(opentype|truetype)'\)/);
    if (!src) return null;
    const res = await fetch(src[1]);
    return res.ok ? await res.arrayBuffer() : null;
  } catch {
    return null;
  }
}

/**
 * GET /api/og/bingo/:attemptId — the player's Bingo card as a 1080×1350
 * share image: their approved photos, tier colours, score, BINGO stamp.
 * Only approved (public) squares are drawn.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ attemptId: string }> }) {
  const { attemptId } = await params;
  const admin = getSupabaseAdmin();
  if (!admin) return new Response("unavailable", { status: 503 });
  const { data: a } = await admin
    .from("bingo_attempts")
    .select("id, wallet, tier_key, stake_amount, required_filled, started_at, ends_at, status, version_id, bingo_campaigns(title, duration_days)")
    .eq("id", attemptId)
    .maybeSingle();
  if (!a) return new Response("not found", { status: 404 });
  const camp = (Array.isArray(a.bingo_campaigns) ? a.bingo_campaigns[0] : a.bingo_campaigns) as { title: string; duration_days: number };
  const [{ data: version }, { data: squares }, { data: profile }] = await Promise.all([
    admin.from("bingo_versions").select("missions, tiers").eq("id", a.version_id).single(),
    admin.from("bingo_squares").select("square_index, proof_url").eq("attempt_id", a.id).eq("status", "filled"),
    admin.from("profiles").select("username").eq("address", a.wallet).maybeSingle(),
  ]);
  const missions = ((version?.missions ?? []) as BingoMission[]).filter((m) => !m.bonus);
  const tier = ((version?.tiers ?? []) as BingoTier[]).find((t) => t.key === a.tier_key);
  const t = THEMES[a.tier_key as string] ?? THEMES.starter;
  const required = missions.length || camp.duration_days;
  // Phones store rotation separately (EXIF); the image renderer ignores it — straighten each photo first.
  const filled = new Map<number, string>();
  await Promise.all(
    (squares ?? []).map(async (s) => {
      try {
        const res = await fetch(s.proof_url as string, { signal: AbortSignal.timeout(8000) });
        if (!res.ok) return;
        const jpg = await sharp(Buffer.from(await res.arrayBuffer())).rotate().resize(600, 600, { fit: "cover" }).jpeg({ quality: 82 }).toBuffer();
        filled.set(s.square_index as number, `data:image/jpeg;base64,${jpg.toString("base64")}`);
      } catch {
        /* leave the square empty rather than fail the card */
      }
    }),
  );
  const done = (a.required_filled as number) >= required;
  const day = Math.min(required, Math.floor((Date.now() - Date.parse(a.started_at as string)) / 86_400_000) + 1);
  const status = done ? "BINGO!" : `Day ${day} of ${required}`;
  const name = profile?.username ? `@${profile.username}` : `${String(a.wallet).slice(0, 6)}…${String(a.wallet).slice(-4)}`;
  const origin = request.nextUrl.origin;

  const cells: ({ kind: "sq"; i: number } | { kind: "lulu" } | { kind: "score" })[] = missions.slice(0, 9).map((_, i) => ({ kind: "sq" as const, i }));
  if (cells.length === 7) cells.push({ kind: "lulu" }, { kind: "score" });
  const rows: (typeof cells)[] = [];
  for (let i = 0; i < cells.length; i += 3) rows.push(cells.slice(i, i + 3));
  // 3-square cards: tall strips that fill the card; 7/9-square cards: a 3×3.
  const tile = 268;
  const tileH = cells.length <= 3 ? 640 : tile;

  const text = `${name}${camp.title}${tier?.label ?? ""}${status}BINGO0123456789/ G$·,SQUARESstaydelulu.xyz`;
  const [display, body] = await Promise.all([font("Big+Shoulders+Display", 900, text.toUpperCase() + text), font("Schibsted+Grotesk", 800, text)]);
  const fonts = [
    display && { name: "Display", data: display, weight: 900 as const, style: "normal" as const },
    body && { name: "Body", data: body, weight: 800 as const, style: "normal" as const },
  ].filter(Boolean) as { name: string; data: ArrayBuffer; weight: 800 | 900; style: "normal" }[];

  return new ImageResponse(
    (
      <div style={{ width: 1080, height: 1350, display: "flex", background: "#fdf1c7", padding: 60, fontFamily: "Body, sans-serif" }}>
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            background: t.bg,
            color: t.fg,
            border: `8px solid ${t.frame}`,
            borderRadius: 64,
            boxShadow: `0 16px 0 ${t.frame}`,
            padding: 48,
          }}
        >
          <div style={{ display: "flex", alignItems: "center" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`${origin}/favicon_io/android-chrome-192x192.png`} width={84} height={84} style={{ borderRadius: 42, background: "#fff", border: `4px solid ${t.frame}` }} />
            <span style={{ marginLeft: 22, fontSize: 44, fontWeight: 800, flex: 1 }}>{name}</span>
            <span style={{ fontSize: 28, fontWeight: 800, padding: "10px 22px", borderRadius: 40, background: t.chipBg, color: t.chipFg, textTransform: "uppercase" }}>
              {`${tier?.label ?? "Bingo"} · ${Number(a.stake_amount).toLocaleString("en-US")} G$`}
            </span>
          </div>
          <span style={{ marginTop: 22, fontSize: 76, fontFamily: "Display", fontWeight: 900, textTransform: "uppercase", lineHeight: 1 }}>{camp.title}</span>

          <div style={{ marginTop: 26, display: "flex", flexDirection: "column", background: "#fff", border: `6px solid ${t.frame}`, borderRadius: 36, padding: 18, position: "relative" }}>
            {rows.map((row, r) => (
              <div key={r} style={{ display: "flex", marginTop: r ? 18 : 0 }}>
                {row.map((c, k) => {
                  const box = { width: tile, height: tileH, borderRadius: 26, marginLeft: k ? 18 : 0, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" as const };
                  if (c.kind === "lulu")
                    return (
                      <div key={k} style={{ ...box, flexDirection: "column", background: t.chipBg, color: t.chipFg }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={`${origin}/favicon_io/android-chrome-192x192.png`} width={130} height={130} />
                        <span style={{ fontFamily: "Display", fontWeight: 900, fontSize: 40 }}>BINGO</span>
                      </div>
                    );
                  if (c.kind === "score")
                    return (
                      <div key={k} style={{ ...box, flexDirection: "column", background: t.bg, color: t.accent, border: `6px solid ${t.frame}` }}>
                        <span style={{ fontFamily: "Display", fontWeight: 900, fontSize: 104, lineHeight: 1 }}>{`${a.required_filled}/${required}`}</span>
                        <span style={{ fontSize: 26, fontWeight: 800, opacity: 0.7 }}>SQUARES</span>
                      </div>
                    );
                  const url = filled.get(c.i);
                  return url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={k} src={url} width={tile} height={tileH} style={{ ...box, objectFit: "cover" }} />
                  ) : (
                    <div key={k} style={{ ...box, background: squareTint(c.i).bg, color: squareTint(c.i).ink, padding: 22, textAlign: "center", fontSize: 30, fontWeight: 800 }}>
                      {missions[c.i]?.title ?? ""}
                    </div>
                  );
                })}
              </div>
            ))}
            {done ? (
              <div
                style={{
                  position: "absolute",
                  top: rows.length > 1 ? 360 : 260,
                  left: 170,
                  display: "flex",
                  transform: "rotate(-10deg)",
                  background: "#ffffff",
                  border: "10px solid #157041",
                  borderRadius: 30,
                  padding: "14px 46px",
                  color: "#157041",
                  fontFamily: "Display",
                  fontWeight: 900,
                  fontSize: 120,
                }}
              >
                BINGO!
              </div>
            ) : null}
          </div>

          <div style={{ marginTop: "auto", display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
            <div style={{ display: "flex", flexDirection: "column" }}>
              {cells.length !== 9 ? (
                <span style={{ fontFamily: "Display", fontWeight: 900, fontSize: 120, lineHeight: 1, color: t.accent }}>{`${a.required_filled}/${required}`}</span>
              ) : null}
              <span style={{ fontSize: 44, fontWeight: 800 }}>{status}</span>
            </div>
            <span style={{ fontSize: 34, fontWeight: 800, opacity: 0.85 }}>staydelulu.xyz</span>
          </div>
        </div>
      </div>
    ),
    { width: 1080, height: 1350, fonts: fonts.length ? fonts : undefined, headers: { "Cache-Control": "public, max-age=300" } },
  );
}
