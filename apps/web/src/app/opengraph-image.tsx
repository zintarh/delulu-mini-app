import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "delulu — join campaigns and crush your goals together";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const CHARCOAL = "#1a1a19";
const CREAM = "#f9f8f4";
const YELLOW = "#f6c324";
const BORDER = "#d4d4ce";
const MUTED = "#7a7a74";

const campaigns = [
  { title: "30-day fitness streak", people: 312, days: "18d left", prize: "$120" },
  { title: "Ship a side project", people: 156, days: "12d left", prize: "$80" },
  { title: "Read 2 books this month", people: 89, days: "6d left", prize: "$40" },
];

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          background: CREAM,
          display: "flex",
          flexDirection: "column",
          padding: "48px 60px",
          fontFamily: "sans-serif",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Subtle warm noise texture via a low-opacity gradient */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(ellipse 80% 60% at 30% 50%, rgba(246,195,36,0.05) 0%, transparent 60%)",
          }}
        />

        {/* Main row — left copy, right cards */}
        <div style={{ display: "flex", flex: 1, gap: 48, position: "relative" }}>

          {/* ── Left column ─────────────────────────────────────── */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              flex: "0 0 480px",
              width: 480,
            }}
          >
            {/* Wordmark */}
            <div style={{ display: "flex", alignItems: "baseline", marginBottom: 36 }}>
              <span
                style={{
                  fontSize: 28,
                  fontWeight: 900,
                  color: CHARCOAL,
                  letterSpacing: "-0.03em",
                }}
              >
                delulu
              </span>
              <span
                style={{
                  fontSize: 28,
                  fontWeight: 900,
                  color: YELLOW,
                  letterSpacing: "-0.03em",
                }}
              >
                .
              </span>
            </div>

            {/* Eyebrow tag */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 20,
              }}
            >
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: YELLOW,
                }}
              />
              <span
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: MUTED,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                }}
              >
                Community campaigns
              </span>
            </div>

            {/* Headline */}
            <p
              style={{
                fontSize: 52,
                fontWeight: 900,
                color: CHARCOAL,
                lineHeight: 1.1,
                letterSpacing: "-0.03em",
                margin: 0,
                marginBottom: 24,
              }}
            >
              Crush your goals with others behind you.
            </p>

            {/* Subtext */}
            <p
              style={{
                fontSize: 18,
                fontWeight: 500,
                color: MUTED,
                lineHeight: 1.5,
                margin: 0,
                marginBottom: 36,
              }}
            >
              Join campaigns, stay accountable, and win real rewards when you deliver.
            </p>

            {/* Stats row */}
            <div style={{ display: "flex", gap: 20, marginBottom: "auto" }}>
              {[
                { n: "500+", label: "active goals" },
                { n: "50+", label: "campaigns" },
              ].map(({ n, label }) => (
                <div
                  key={label}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 2,
                  }}
                >
                  <span
                    style={{
                      fontSize: 26,
                      fontWeight: 900,
                      color: CHARCOAL,
                      letterSpacing: "-0.02em",
                    }}
                  >
                    {n}
                  </span>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: MUTED,
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                    }}
                  >
                    {label}
                  </span>
                </div>
              ))}
            </div>

            {/* CTA */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 16,
                marginTop: 32,
              }}
            >
              <div
                style={{
                  background: CHARCOAL,
                  borderRadius: 100,
                  padding: "14px 28px",
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <span
                  style={{
                    fontSize: 16,
                    fontWeight: 800,
                    color: YELLOW,
                    letterSpacing: "-0.01em",
                  }}
                >
                  Join a campaign →
                </span>
              </div>
              <span
                style={{
                  fontSize: 13,
                  color: MUTED,
                  fontWeight: 500,
                }}
              >
                staydelulu.xyz
              </span>
            </div>
          </div>

          {/* ── Right column — campaign cards ───────────────────── */}
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              gap: 14,
              justifyContent: "center",
            }}
          >
            {campaigns.map((c, i) => (
              <div
                key={c.title}
                style={{
                  background: i === 0 ? "#ffffff" : "rgba(255,255,255,0.7)",
                  border: `1.5px solid ${i === 0 ? BORDER : "rgba(212,212,206,0.5)"}`,
                  borderRadius: 16,
                  padding: "18px 20px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                  opacity: i === 2 ? 0.7 : 1,
                  transform: i === 0 ? "scale(1)" : "scale(0.97)",
                }}
              >
                {/* Card top row */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    gap: 12,
                  }}
                >
                  <span
                    style={{
                      fontSize: 16,
                      fontWeight: 800,
                      color: CHARCOAL,
                      letterSpacing: "-0.01em",
                      lineHeight: 1.2,
                    }}
                  >
                    {c.title}
                  </span>
                  {/* Prize badge */}
                  <div
                    style={{
                      background: YELLOW,
                      borderRadius: 100,
                      padding: "4px 12px",
                      display: "flex",
                      flexShrink: 0,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 800,
                        color: CHARCOAL,
                      }}
                    >
                      {c.prize}
                    </span>
                  </div>
                </div>

                {/* Progress bar */}
                <div
                  style={{
                    height: 5,
                    background: "rgba(26,26,25,0.08)",
                    borderRadius: 100,
                    display: "flex",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: i === 0 ? "60%" : i === 1 ? "45%" : "80%",
                      background: CHARCOAL,
                      borderRadius: 100,
                    }}
                  />
                </div>

                {/* Card bottom stats */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  {/* Participant count */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    {/* Avatar stack */}
                    {[0, 1, 2].map((j) => (
                      <div
                        key={j}
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: "50%",
                          background: j === 0
                            ? "#c8b8f0"
                            : j === 1
                            ? "#f0c8b8"
                            : "#b8f0c8",
                          border: "2px solid white",
                          marginLeft: j > 0 ? -8 : 0,
                          display: "flex",
                        }}
                      />
                    ))}
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: MUTED,
                        marginLeft: 6,
                      }}
                    >
                      {c.people} joined
                    </span>
                  </div>

                  {/* Days left */}
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: MUTED,
                      letterSpacing: "0.02em",
                    }}
                  >
                    {c.days}
                  </span>
                </div>
              </div>
            ))}

            {/* "and more" hint */}
            <div
              style={{
                display: "flex",
                justifyContent: "center",
              }}
            >
              <span
                style={{
                  fontSize: 13,
                  color: MUTED,
                  fontWeight: 600,
                  letterSpacing: "0.04em",
                }}
              >
                + dozens more campaigns waiting for you
              </span>
            </div>
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
