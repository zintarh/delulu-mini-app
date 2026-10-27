import { ImageResponse } from "next/og";
import { luluSvgDataUri } from "@/lib/brand/lulu-svg";

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
          position: "relative",
        }}
      >
        {/* Lulu on a sun on the right */}
        <div
          style={{
            position: "absolute",
            right: -90,
            top: 70,
            width: 520,
            height: 520,
            borderRadius: 999,
            background: "#F6C324",
            display: "flex",
          }}
        />
        {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse needs a plain img */}
        <img
          src={luluSvgDataUri()}
          width={380}
          height={380}
          alt=""
          style={{ position: "absolute", right: 30, top: 150 }}
        />
        {/* Top — Lulu + wordmark */}
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse needs a plain img */}
          <img src={luluSvgDataUri()} width={72} height={72} alt="" />
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
              maxWidth: 680,
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
