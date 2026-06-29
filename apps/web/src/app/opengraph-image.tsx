import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "delulu — crush your goals with a community behind you";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          background: "#f9f8f4",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px 80px",
          fontFamily: "sans-serif",
        }}
      >
        {/* Top — wordmark */}
        <div style={{ display: "flex", alignItems: "baseline" }}>
          <span
            style={{
              fontSize: 36,
              fontWeight: 900,
              color: "#1a1a19",
              letterSpacing: "-0.03em",
            }}
          >
            delulu
          </span>
          <span
            style={{
              fontSize: 36,
              fontWeight: 900,
              color: "#f6c324",
              letterSpacing: "-0.03em",
            }}
          >
            .
          </span>
        </div>

        {/* Center — headline */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <p
            style={{
              fontSize: 84,
              fontWeight: 900,
              color: "#1a1a19",
              letterSpacing: "-0.04em",
              lineHeight: 1.05,
              margin: 0,
              maxWidth: 920,
            }}
          >
            Join thousands already achieving their goals.
          </p>
          <p
            style={{
              fontSize: 24,
              fontWeight: 500,
              color: "#7a7a74",
              margin: 0,
              marginTop: 4,
              letterSpacing: "-0.01em",
            }}
          >
            Stake your goal · Prove your progress · Win together
          </p>
        </div>

        {/* Bottom — URL */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: "#f6c324",
            }}
          />
          <span
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: "#1a1a19",
              letterSpacing: "0.02em",
              opacity: 0.45,
            }}
          >
            staydelulu.xyz
          </span>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
