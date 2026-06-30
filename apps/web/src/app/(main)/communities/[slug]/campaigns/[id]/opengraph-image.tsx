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

  const title = truncate(campaign?.title ?? "Community campaign", 80);
  const communityName = community?.name ?? "Delulu";
  const cadence =
    campaign?.proof_cadence === "weekly" ? "Weekly proofs" : "Daily proofs";
  const pool =
    campaign?.proposed_pool_amount && Number(campaign.proposed_pool_amount) > 0
      ? `${Number(campaign.proposed_pool_amount)} G$ prize pool`
      : "Join and earn rewards";

  const titleSize = title.length > 60 ? 44 : title.length > 40 ? 52 : 60;

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

        {/* Center — campaign title */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <span
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: "#7a7a74",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
            }}
          >
            {communityName} · Campaign
          </span>
          <p
            style={{
              fontSize: titleSize,
              fontWeight: 900,
              color: "#1a1a19",
              letterSpacing: "-0.04em",
              lineHeight: 1.1,
              margin: 0,
              maxWidth: 960,
            }}
          >
            {title}
          </p>
          <p
            style={{
              fontSize: 22,
              fontWeight: 500,
              color: "#7a7a74",
              margin: 0,
              marginTop: 4,
              letterSpacing: "-0.01em",
            }}
          >
            {cadence} · {pool}
          </p>
        </div>

        {/* Bottom — CTA + URL */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div
            style={{
              background: "#1a1a19",
              borderRadius: 100,
              padding: "16px 36px",
              display: "flex",
              alignItems: "center",
            }}
          >
            <span
              style={{
                fontSize: 20,
                fontWeight: 800,
                color: "#f6c324",
                letterSpacing: "-0.01em",
              }}
            >
              Join the challenge →
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
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
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
