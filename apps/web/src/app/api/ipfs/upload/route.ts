import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/push/supabase";

const DEFAULT_BUCKET = "delulu-content";

async function ensureBucket(
  supabase: NonNullable<ReturnType<typeof getSupabaseAdmin>>,
  bucket: string,
) {
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();
  if (listError) return listError;

  const exists = (buckets ?? []).some((b) => b.name === bucket);
  if (exists) return null;

  const { error: createError } = await supabase.storage.createBucket(bucket, {
    public: true,
    fileSizeLimit: 1 * 1024 * 1024, // 1MB — JSON metadata is tiny
  });

  if (createError) {
    const msg = String(createError.message || "").toLowerCase();
    if (msg.includes("already")) return null;
    return createError;
  }
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const {
      content,
      description,
      username,
      pfpUrl,
      createdAt,
      gatekeeper,
      bgImageUrl,
    } = await request.json();

    if (!content || typeof content !== "string") {
      return NextResponse.json(
        { error: "Content is required and must be a string" },
        { status: 400 },
      );
    }

    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return NextResponse.json({ error: "Storage not configured" }, { status: 500 });
    }

    // Build metadata object (same shape IPFS used)
    const metadata: Record<string, unknown> = { text: content };
    if (description && typeof description === "string") metadata.description = description;
    if (username && typeof username === "string") metadata.username = username;
    if (pfpUrl && typeof pfpUrl === "string") metadata.pfpUrl = pfpUrl;
    if (createdAt && typeof createdAt === "string") metadata.createdAt = createdAt;
    if (gatekeeper && typeof gatekeeper === "object" && gatekeeper.enabled) {
      metadata.gatekeeper = {
        enabled: gatekeeper.enabled,
        type: gatekeeper.type || "country",
        value: gatekeeper.value,
        label: gatekeeper.label,
      };
    }
    if (bgImageUrl && typeof bgImageUrl === "string") metadata.bgImageUrl = bgImageUrl;

    const bucket = process.env.SUPABASE_DELULU_CONTENT_BUCKET || DEFAULT_BUCKET;
    const filePath = `${Date.now()}-${Math.random().toString(36).slice(2)}.json`;
    const body = Buffer.from(JSON.stringify(metadata));

    const bucketError = await ensureBucket(supabase, bucket);
    if (bucketError) {
      return NextResponse.json(
        { error: bucketError.message || "Failed to initialize storage" },
        { status: 500 },
      );
    }

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(filePath, body, {
        contentType: "application/json",
        cacheControl: "31536000",
        upsert: false,
      });

    if (uploadError) {
      return NextResponse.json(
        { error: uploadError.message || "Failed to upload metadata" },
        { status: 500 },
      );
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from(bucket).getPublicUrl(filePath);

    if (!publicUrl) {
      return NextResponse.json({ error: "Failed to get metadata URL" }, { status: 500 });
    }

    // Return `hash` so existing callers (ipfs.ts → uploadToIPFS) need no changes
    return NextResponse.json({ hash: publicUrl });
  } catch (error) {
    console.error("[metadata-upload]", error);
    return NextResponse.json(
      {
        error: "Failed to upload to IPFS",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
