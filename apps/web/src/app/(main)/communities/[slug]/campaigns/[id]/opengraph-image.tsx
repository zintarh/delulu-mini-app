import { ImageResponse } from "next/og";
import { getSupabaseAdmin } from "@/lib/push/supabase";

export const runtime = "edge";
export const alt = "Delulu campaign";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

async function fetchCampaignOg(id: string) {
  try {
    const admin = getSupabaseAdmin();
    if (!admin) return null;
    const { data } = await admin
      .from("community_campaigns")
      .select("title, proof_cadence, proposed_pool_amount, communities(name)")
      .eq("id", id)
      .maybeSingle();
    return data ?? null;
  } catch {
    return null;
  }
}

function truncate(str: string, max: number) {
  return str.length > max ? `${str.slice(0, max - 1)}…` : str;
}

export default async function Image({
  params,
}: {
  params: { slug: string; id: string };
}) {
  const campaign = await fetchCampaignOg(params.id);

  const community = campaign?.communities
    ? Array.isArray(campaign.communities)
      ? campaign.communities[0]
      : campaign.communities
    : null;

  const title = truncate(campaign?.title ?? "Community campaign", 90);
  const communityName = community?.name ?? "Delulu";
  const cadence =
    campaign?.proof_cadence === "weekly" ? "Weekly proofs" : "Daily proofs";
  const pool =
    campaign?.proposed_pool_amount && Number(campaign.proposed_pool_amount) > 0
      ? `${Number(campaign.proposed_pool_amount)} G$ prize pool`
      : "Join and earn rewards";

  const titleSize =
    title.length > 70 ? 38 : title.length > 45 ? 46 : 54;

  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          background: "#080808",
          display: "flex",
          flexDirection: "column",
          padding: "56px 64px",
          position: "relative",
          overflow: "hidden",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: -120,
            right: -120,
            width: 480,
            height: 480,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(246,195,36,0.14) 0%, transparent 70%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: -80,
            left: -80,
            width: 320,
            height: 320,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(53,208,127,0.08) 0%, transparent 70%)",
          }}
        />

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 32,
          }}
        >
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: "#f6c324",
              boxShadow: "0 0 12px rgba(246,195,36,0.8)",
            }}
          />
          <span
            style={{
              fontSize: 16,
              fontWeight: 700,
              color: "#f6c324",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
            }}
          >
            delulu campaign
          </span>
        </div>

        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
          }}
        >
          <p
            style={{
              fontSize: titleSize,
              fontWeight: 800,
              color: "rgba(255,255,255,0.95)",
              lineHeight: 1.2,
              margin: 0,
              maxWidth: 980,
            }}
          >
            {title}
          </p>
          <p
            style={{
              marginTop: 18,
              fontSize: 24,
              fontWeight: 600,
              color: "#f6c324",
              opacity: 0.95,
            }}
          >
            {communityName}
          </p>
        </div>

        <div
          style={{
            borderTop: "1px solid rgba(255,255,255,0.08)",
            paddingTop: 28,
            display: "flex",
            alignItems: "center",
            gap: 40,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span
              style={{
                fontSize: 22,
                fontWeight: 800,
                color: "rgba(255,255,255,0.9)",
              }}
            >
              {cadence}
            </span>
            <span
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "rgba(255,255,255,0.4)",
                textTransform: "uppercase",
                letterSpacing: "0.1em",
              }}
            >
              proof schedule
            </span>
          </div>

          <div
            style={{
              width: 1,
              height: 40,
              background: "rgba(255,255,255,0.08)",
            }}
          />

          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span
              style={{
                fontSize: 22,
                fontWeight: 800,
                color: "#f6c324",
              }}
            >
              {pool}
            </span>
            <span
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "rgba(255,255,255,0.4)",
                textTransform: "uppercase",
                letterSpacing: "0.1em",
              }}
            >
              rewards
            </span>
          </div>

          <div
            style={{
              marginLeft: "auto",
              display: "flex",
              alignItems: "center",
              background: "#f6c324",
              borderRadius: 40,
              padding: "14px 32px",
            }}
          >
            <span
              style={{
                fontSize: 18,
                fontWeight: 800,
                color: "#1a1a19",
                letterSpacing: "-0.01em",
              }}
            >
              Join the challenge →
            </span>
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
