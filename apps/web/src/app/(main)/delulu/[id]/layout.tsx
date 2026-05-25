import type { Metadata } from "next";

const SUBGRAPH_URL =
  process.env.NEXT_PUBLIC_SUBGRAPH_URL_MAINNET ||
  process.env.NEXT_PUBLIC_SUBGRAPH_URL ||
  "";

const IPFS_GATEWAYS = [
  "https://gateway.pinata.cloud/ipfs/",
  "https://ipfs.io/ipfs/",
  "https://cloudflare-ipfs.com/ipfs/",
];

async function fetchDeluluMeta(
  id: string,
): Promise<{ title: string | null; creator: string | null } | null> {
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
            creator { username id }
          }
        }`,
      }),
      next: { revalidate: 60 },
    });
    const json = await res.json();
    const d = json?.data?.delulu;
    if (!d) return null;

    let title: string | null = null;
    if (d.contentHash) {
      for (const gw of IPFS_GATEWAYS) {
        try {
          const r = await fetch(`${gw}${d.contentHash}`, {
            next: { revalidate: 86400 },
          });
          if (r.ok) {
            const meta = await r.json();
            title = meta.text || meta.content || null;
            break;
          }
        } catch {
          // try next gateway
        }
      }
    }

    const creator = d.creator?.username
      ? `@${d.creator.username}`
      : d.creator?.id
        ? `${d.creator.id.slice(0, 6)}…${d.creator.id.slice(-4)}`
        : null;

    return {
      title: title || `Delulu #${d.onChainId}`,
      creator,
    };
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const meta = await fetchDeluluMeta(params.id);

  const title = meta?.title ?? "Delulu";
  const description = meta?.creator
    ? `${meta.creator} just staked onchain on this goal. Buy a share and back their journey on Delulu.`
    : "A wild goal staked onchain. Buy a share and back their journey on Delulu.";

  return {
    title,
    description,
    openGraph: {
      title,
      description,
    },
    // opengraph-image.tsx in this folder auto-populates og:image.
    // We only need to set the twitter card type here.
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default function DeluluLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
