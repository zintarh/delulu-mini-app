import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Delulu — Build habits you can't skip";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const INK = "#161615";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          background: "#f7f7f4",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px 80px",
          fontFamily: "sans-serif",
        }}
      >
        {/* Top — Lulu + wordmark */}
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <svg width="64" height="64" viewBox="0 0 64 64">
            <path d="M30 11.5q3-7 10-5" fill="none" stroke={INK} strokeWidth="3" strokeLinecap="round" />
            <circle cx="32" cy="35" r="23.5" fill="#F6C324" stroke={INK} strokeWidth="3" />
            <circle cx="17.5" cy="40.5" r="3" fill="#F4A3B5" />
            <circle cx="46.5" cy="40.5" r="3" fill="#F4A3B5" />
            <ellipse cx="25" cy="31" rx="5.6" ry="7" fill="#fff" stroke={INK} strokeWidth="2.6" />
            <ellipse cx="39" cy="31" rx="5.6" ry="7" fill="#fff" stroke={INK} strokeWidth="2.6" />
            <circle cx="26.2" cy="27.6" r="2.7" fill={INK} />
            <circle cx="40.2" cy="27.6" r="2.7" fill={INK} />
            <path d="M27.5 42.5q4.5 3.6 9 0" fill="none" stroke={INK} strokeWidth="2.8" strokeLinecap="round" />
          </svg>
          <span style={{ fontSize: 44, fontWeight: 800, color: INK, letterSpacing: "-0.02em" }}>delulu</span>
        </div>

        {/* Center — headline */}
        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          <p
            style={{
              fontSize: 88,
              fontWeight: 900,
              color: INK,
              letterSpacing: "-0.04em",
              lineHeight: 1,
              margin: 0,
              textTransform: "uppercase",
            }}
          >
            Build habits you can&apos;t skip.
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 30, fontWeight: 800, color: INK }}>
            <span>Say it.</span>
            <span style={{ background: "#F6C324", padding: "4px 14px", borderRadius: 12, boxShadow: "0 5px 0 #C99A0A" }}>
              Stake it.
            </span>
            <span>Prove it.</span>
          </div>
        </div>

        {/* Bottom — CTA + URL */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div
            style={{
              background: "#F6C324",
              borderRadius: 18,
              padding: "16px 34px",
              display: "flex",
              boxShadow: "0 6px 0 #C99A0A",
            }}
          >
            <span style={{ fontSize: 22, fontWeight: 800, color: INK, letterSpacing: "0.06em" }}>START NOW</span>
          </div>
          <span style={{ fontSize: 20, fontWeight: 700, color: INK, opacity: 0.5 }}>staydelulu.xyz</span>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
