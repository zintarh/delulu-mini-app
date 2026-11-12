import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/push/supabase";

export const dynamic = "force-dynamic";

const MAX_BYTES = 3 * 1024 * 1024;

/** Only our own storage — never fetch arbitrary user-supplied URLs (SSRF). */
function allowedSource(url: string): boolean {
  try {
    const u = new URL(url);
    const own = process.env.SUPABASE_URL ? new URL(process.env.SUPABASE_URL).host : null;
    return u.protocol === "https:" && !!own && u.host === own && u.pathname.startsWith("/storage/v1/object/public/");
  } catch {
    return false;
  }
}

/**
 * Profile picture by username for public Support pages. Profile images live
 * under a wallet-address path, so linking them directly would leak wallets;
 * this streams the image without revealing where it's stored.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const name = decodeURIComponent(username).trim();
  const goal = /^~d(\d{1,12})$/.exec(name);
  if (!goal && !/^[A-Za-z0-9_.-]{1,40}$/.test(name)) return new NextResponse(null, { status: 404 });
  const admin = getSupabaseAdmin();
  if (!admin) return new NextResponse(null, { status: 503 });

  let src: string | undefined;
  if (goal) {
    // "~d<onChainId>": the creator of a PUBLIC Delulu only.
    const { data: c } = await admin
      .from("forfeit_commitments")
      .select("creator_wallet")
      .eq("on_chain_commitment_id", Number(goal[1]))
      .eq("is_private", false)
      .maybeSingle();
    if (!c) return new NextResponse(null, { status: 404 });
    const { data: p } = await admin.from("profiles").select("pfp_url").ilike("address", c.creator_wallet).maybeSingle();
    src = p?.pfp_url ?? undefined;
  } else {
    const { data } = await admin.from("profiles").select("pfp_url").ilike("username", name).limit(1).maybeSingle();
    src = data?.pfp_url ?? undefined;
  }
  if (!src || !allowedSource(src)) return new NextResponse(null, { status: 404 });

  const upstream = await fetch(src, { cache: "no-store" }).catch(() => null);
  const type = upstream?.headers.get("content-type") ?? "";
  if (!upstream?.ok || !type.startsWith("image/")) return new NextResponse(null, { status: 404 });
  const buf = await upstream.arrayBuffer();
  if (buf.byteLength > MAX_BYTES) return new NextResponse(null, { status: 404 });

  return new NextResponse(buf, {
    headers: {
      "Content-Type": type,
      "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
