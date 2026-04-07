import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Delulu";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const SUBGRAPH_URL =
  process.env.NEXT_PUBLIC_SUBGRAPH_URL_MAINNET ||
  process.env.NEXT_PUBLIC_SUBGRAPH_URL ||
  "";

const IPFS_GATEWAYS = [
  "https://gateway.pinata.cloud/ipfs/",
  "https://ipfs.io/ipfs/",
  "https://cloudflare-ipfs.com/ipfs/",
];

async function fetchDeluluBasic(id: string) {
  if (!SUBGRAPH_URL) return null;
  try {
    const res = await fetch(SUBGRAPH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `{
          delulu(id: "${id}") {
            onChainId
            contentHash
            creatorStake
            totalSupportCollected
            shareSupply
            uniqueBuyerCount
            creator { id username }
          }
        }`,
      }),
      next: { revalidate: 60 },
    });
    const json = await res.json();
    return json?.data?.delulu ?? null;
  } catch {
    return null;
  }
}

async function fetchIPFSTitle(hash: string): Promise<string | null> {
  for (const gw of IPFS_GATEWAYS) {
    try {
      const res = await fetch(`${gw}${hash}`, {
        next: { revalidate: 86400 },
      });
      if (res.ok) {
        const json = await res.json();
        return (json.text || json.content) ?? null;
      }
    } catch {
      // try next gateway
    }
  }
  return null;
}

function weiToG(wei: string | null | undefined): number {
  if (!wei) return 0;
  try {
    return Number(BigInt(wei)) / 1e18;
  } catch {
    return 0;
  }
}

function fmtG(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toFixed(0);
}

function truncate(str: string, max: number) {
  return str.length > max ? str.slice(0, max) + "…" : str;
}

export default async function Image({
  params,
}: {
  params: { id: string };
}) {
  const delulu = await fetchDeluluBasic(params.id);

  const rawTitle = delulu?.contentHash
    ? await fetchIPFSTitle(delulu.contentHash)
    : null;

  const title = truncate(
    rawTitle || `Delulu #${delulu?.onChainId ?? "?"}`,
    120,
  );

  const creatorHandle = delulu?.creator?.username
    ? `@${delulu.creator.username}`
    : delulu?.creator?.id
      ? `${delulu.creator.id.slice(0, 6)}…${delulu.creator.id.slice(-4)}`
      : null;

  const totalG = fmtG(
    weiToG(delulu?.creatorStake) + weiToG(delulu?.totalSupportCollected),
  );
  const shares = Number(delulu?.shareSupply ?? 0);
  const ub = Number(delulu?.uniqueBuyerCount ?? 0);

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
        {/* Background glow */}
        <div
          style={{
            position: "absolute",
            top: -120,
            right: -120,
            width: 480,
            height: 480,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(252,255,82,0.12) 0%, transparent 70%)",
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
              "radial-gradient(circle, rgba(53,208,127,0.07) 0%, transparent 70%)",
          }}
        />

        {/* Brand mark */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 40,
          }}
        >
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: "#fcff52",
              boxShadow: "0 0 12px rgba(252,255,82,0.8)",
            }}
          />
          <span
            style={{
              fontSize: 16,
              fontWeight: 700,
              color: "#fcff52",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
            }}
          >
            delulu
          </span>
        </div>

        {/* Title */}
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
              fontSize: title.length > 80 ? 36 : title.length > 50 ? 44 : 54,
              fontWeight: 800,
              color: "rgba(255,255,255,0.95)",
              lineHeight: 1.25,
              margin: 0,
              maxWidth: 960,
            }}
          >
            {title}
          </p>

          {creatorHandle && (
            <p
              style={{
                marginTop: 20,
                fontSize: 22,
                fontWeight: 600,
                color: "#fcff52",
                opacity: 0.9,
              }}
            >
              {creatorHandle}
            </p>
          )}
        </div>

        {/* Divider + stats */}
        <div
          style={{
            borderTop: "1px solid rgba(255,255,255,0.08)",
            paddingTop: 28,
            display: "flex",
            alignItems: "center",
            gap: 48,
          }}
        >
          {/* G$ staked */}
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span
              style={{
                fontSize: 26,
                fontWeight: 800,
                color: "rgba(255,255,255,0.9)",
              }}
            >
              {totalG} G$
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
              staked
            </span>
          </div>

          <div
            style={{
              width: 1,
              height: 40,
              background: "rgba(255,255,255,0.08)",
            }}
          />

          {/* Shares */}
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span
              style={{
                fontSize: 26,
                fontWeight: 800,
                color: "rgba(255,255,255,0.9)",
              }}
            >
              {shares}
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
              shares
            </span>
          </div>

          <div
            style={{
              width: 1,
              height: 40,
              background: "rgba(255,255,255,0.08)",
            }}
          />

          {/* Unique buyers */}
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span
              style={{
                fontSize: 26,
                fontWeight: 800,
                color: "#fcff52",
              }}
            >
              {ub}
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
              buyers
            </span>
          </div>

          {/* Spacer + "buy a share" CTA */}
          <div
            style={{
              marginLeft: "auto",
              display: "flex",
              alignItems: "center",
              gap: 10,
              background: "#fcff52",
              borderRadius: 40,
              padding: "12px 28px",
            }}
          >
            <span
              style={{
                fontSize: 16,
                fontWeight: 800,
                color: "#000",
                letterSpacing: "-0.01em",
              }}
            >
              Buy a share →
            </span>
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
