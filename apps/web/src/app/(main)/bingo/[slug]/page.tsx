import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/push/supabase";
import { BingoPageClient } from "@/components/bingo/bingo-page-client";

const appUrl = process.env.NEXT_PUBLIC_URL || "https://www.staydelulu.xyz";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Link previews. A link shared from a card (`?card=<attemptId>`) previews as
 * that player's card — their photos, score, tier (/api/og/bingo/:attemptId);
 * a plain Bingo link keeps the title + description.
 */
export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const { slug } = await params;
  const raw = (await searchParams).card;
  const cardId = typeof raw === "string" && UUID.test(raw) ? raw : null;
  const admin = getSupabaseAdmin();
  const { data } = admin
    ? await admin.from("bingo_campaigns").select("id, title, description").eq("slug", slug).neq("status", "draft").maybeSingle()
    : { data: null };

  // Only a card from this Bingo becomes the preview.
  let card: { id: string; filled: number; name: string | null } | null = null;
  if (admin && data && cardId) {
    const { data: a } = await admin.from("bingo_attempts").select("id, wallet, required_filled, campaign_id").eq("id", cardId).maybeSingle();
    if (a && a.campaign_id === data.id) {
      const { data: profile } = await admin.from("profiles").select("username").eq("address", a.wallet).maybeSingle();
      card = { id: a.id, filled: Number(a.required_filled ?? 0), name: profile?.username ?? null };
    }
  }

  const title = data
    ? card
      ? `${card.name ? `@${card.name}'s` : "My"} ${data.title} card · Delulu`
      : `${data.title} · Delulu`
    : "Bingo · Delulu";
  const description = card
    ? "One photo a day fills the card. Play with me on Delulu."
    : (data?.description ?? "One photo a day fills your Bingo card.");
  const url = card ? `${appUrl}/bingo/${slug}?card=${card.id}` : `${appUrl}/bingo/${slug}`;
  // Version the image by score so apps that cache previews pick up new squares.
  const images = card
    ? [{ url: `${appUrl}/api/og/bingo/${card.id}?v=${card.filled}`, width: 1080, height: 1350, alt: `${data!.title} Bingo card` }]
    : undefined;
  return {
    title,
    description,
    openGraph: { title, description, url, siteName: "Delulu", type: "website", images },
    twitter: { card: "summary_large_image", title, description, images: images?.map((i) => i.url) },
    alternates: { canonical: `${appUrl}/bingo/${slug}` },
  };
}

/** Renamed Bingos keep their old links working. */
const RENAMED: Record<string, string> = { "my-first-3": "delulu-debut" };

export default async function BingoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (RENAMED[slug]) redirect(`/bingo/${RENAMED[slug]}`);
  return <BingoPageClient slug={slug} />;
}
