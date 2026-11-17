import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/push/supabase";
import { BingoPageClient } from "@/components/bingo/bingo-page-client";

const appUrl = process.env.NEXT_PUBLIC_URL || "https://www.staydelulu.xyz";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const admin = getSupabaseAdmin();
  const { data } = admin
    ? await admin.from("bingo_campaigns").select("title, description").eq("slug", slug).neq("status", "draft").maybeSingle()
    : { data: null };
  const title = data ? `${data.title} · Delulu` : "Bingo · Delulu";
  const description = data?.description ?? "One photo a day fills your Bingo card.";
  const url = `${appUrl}/bingo/${slug}`;
  return {
    title,
    description,
    openGraph: { title, description, url, siteName: "Delulu", type: "website" },
    twitter: { card: "summary_large_image", title, description },
    alternates: { canonical: url },
  };
}

/** Renamed Bingos keep their old links working. */
const RENAMED: Record<string, string> = { "my-first-3": "delulu-debut" };

export default async function BingoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (RENAMED[slug]) redirect(`/bingo/${RENAMED[slug]}`);
  return <BingoPageClient slug={slug} />;
}
