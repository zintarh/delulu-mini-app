import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/push/supabase";
import { CommunityCampaignPageClient } from "./campaign-page-client";

const appUrl = process.env.NEXT_PUBLIC_URL || "https://www.staydelulu.xyz";

async function fetchCampaignMeta(id: string) {
  try {
    const admin = getSupabaseAdmin();
    if (!admin) return null;
    const { data } = await admin
      .from("community_campaigns")
      .select("title, description, cover_image_url, proof_instructions, communities(name, slug)")
      .eq("id", id)
      .maybeSingle();
    return data ?? null;
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}): Promise<Metadata> {
  const { slug, id } = await params;
  const campaign = await fetchCampaignMeta(id);

  if (!campaign) {
    return {
      title: "Mission · Delulu",
      description: "Join this challenge on Delulu and earn your reward.",
    };
  }

  const community = Array.isArray(campaign.communities)
    ? campaign.communities[0]
    : campaign.communities;
  const communityName = community?.name ?? "Delulu";
  const pageUrl = `${appUrl}/communities/${slug}/campaigns/${id}`;
  const title = `${campaign.title} · ${communityName}`;
  const description =
    campaign.description
      ? `${campaign.description} — Join the challenge and earn your reward on Delulu.`
      : `Join the "${campaign.title}" challenge on ${communityName} and earn your reward on Delulu.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: pageUrl,
      siteName: "Delulu",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
    alternates: { canonical: pageUrl },
  };
}

/** A Bingo stake tier is a campaign underneath — send every old-style link to its Bingo. */
async function bingoSlugFor(campaignId: string): Promise<string | null> {
  const admin = getSupabaseAdmin();
  if (!admin) return null;
  const { data } = await admin
    .from("community_campaigns")
    .select("bingo_cycles(bingo_campaigns(slug))")
    .eq("id", campaignId)
    .not("bingo_cycle_id", "is", null)
    .maybeSingle();
  const cycle = data?.bingo_cycles as { bingo_campaigns?: { slug?: string } | { slug?: string }[] } | null | undefined;
  const camp = Array.isArray(cycle?.bingo_campaigns) ? cycle?.bingo_campaigns[0] : cycle?.bingo_campaigns;
  return camp?.slug ?? null;
}

export default async function CommunityCampaignPage({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { id } = await params;
  const bingo = await bingoSlugFor(id).catch(() => null);
  if (bingo) redirect(`/bingo/${bingo}`);
  return <CommunityCampaignPageClient />;
}
