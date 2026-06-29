import type { Metadata } from "next";
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
      title: "Campaign · Delulu",
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

  const images = campaign.cover_image_url
    ? [{ url: campaign.cover_image_url, width: 1200, height: 630, alt: campaign.title }]
    : [{ url: `${appUrl}/og-default.png`, width: 1200, height: 630, alt: "Delulu" }];

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: pageUrl,
      siteName: "Delulu",
      images,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: images.map((i) => i.url),
    },
    alternates: { canonical: pageUrl },
  };
}

export default function CommunityCampaignPage() {
  return <CommunityCampaignPageClient />;
}
