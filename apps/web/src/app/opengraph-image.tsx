import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "delulu — stake your goals onchain";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          background: "#090909",
          display: "flex",
          flexDirection: "column",
          padding: "60px 72px",
          position: "relative",
          overflow: "hidden",
          fontFamily: "sans-serif",
        }}
      >
        {/* Subtle noise grid overlay */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "radial-gradient(circle, rgba(255,255,255,0.025) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />

        {/* Top-right glow — very subtle yellow */}
        <div
          style={{
            position: "absolute",
            top: -160,
            right: -160,
            width: 520,
            height: 520,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(246,195,36,0.10) 0%, transparent 65%)",
          }}
        />

        {/* Bottom-left glow — subtle green/teal */}
        <div
          style={{
            position: "absolute",
            bottom: -140,
            left: -100,
            width: 420,
            height: 420,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(53,208,127,0.07) 0%, transparent 65%)",
          }}
        />

        {/* Content */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            height: "100%",
            position: "relative",
          }}
        >
          {/* Top bar — domain pill */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 100,
                padding: "8px 18px",
              }}
            >
              {/* Yellow dot */}
              <div
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: "#f6c324",
                  boxShadow: "0 0 8px rgba(246,195,36,0.9)",
                }}
              />
              <span
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: "rgba(255,255,255,0.55)",
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                }}
              >
                staydelulu.xyz
              </span>
            </div>

            {/* Subtle "Live on Celo" badge */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                background: "rgba(53,208,127,0.08)",
                border: "1px solid rgba(53,208,127,0.2)",
                borderRadius: 100,
                padding: "8px 16px",
              }}
            >
              <div
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: "#35d07f",
                }}
              />
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#35d07f",
                  letterSpacing: "0.04em",
                }}
              >
                Live on Celo
              </span>
            </div>
          </div>

          {/* Main wordmark */}
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              gap: 20,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: 0,
              }}
            >
              <span
                style={{
                  fontSize: 108,
                  fontWeight: 900,
                  color: "rgba(255,255,255,0.95)",
                  letterSpacing: "-0.04em",
                  lineHeight: 1,
                }}
              >
                delulu
              </span>
              <span
                style={{
                  fontSize: 108,
                  fontWeight: 900,
                  color: "#f6c324",
                  letterSpacing: "-0.04em",
                  lineHeight: 1,
                }}
              >
                .
              </span>
            </div>

            <p
              style={{
                fontSize: 26,
                fontWeight: 500,
                color: "rgba(255,255,255,0.45)",
                margin: 0,
                letterSpacing: "-0.01em",
                lineHeight: 1.4,
                maxWidth: 600,
              }}
            >
              Stake your goals. Build in public.
              <br />
              Win when you deliver.
            </p>
          </div>

          {/* Bottom strip — feature pills */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              borderTop: "1px solid rgba(255,255,255,0.06)",
              paddingTop: 28,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              {["Goals", "Stakes", "Community", "Onchain"].map((label) => (
                <div
                  key={label}
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 100,
                    padding: "10px 20px",
                    display: "flex",
                  }}
                >
                  <span
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: "rgba(255,255,255,0.4)",
                      letterSpacing: "0.02em",
                    }}
                  >
                    {label}
                  </span>
                </div>
              ))}
            </div>

            {/* CTA pill */}
            <div
              style={{
                background: "#f6c324",
                borderRadius: 100,
                padding: "12px 28px",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span
                style={{
                  fontSize: 16,
                  fontWeight: 800,
                  color: "#0a0a0a",
                  letterSpacing: "-0.01em",
                }}
              >
                Start your journey →
              </span>
            </div>
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
