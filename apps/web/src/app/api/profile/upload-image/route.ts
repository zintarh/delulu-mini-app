import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/push/supabase";

const DEFAULT_BUCKET = "profile-images";

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
    fileSizeLimit: 5 * 1024 * 1024,
    allowedMimeTypes: ["image/*"],
  });

  if (createError) {
    const message = String(createError.message || "").toLowerCase();
    if (message.includes("already")) return null;
    return createError;
  }
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return NextResponse.json({ error: "Database not configured" }, { status: 500 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const addressRaw = formData.get("address");
    const address = typeof addressRaw === "string" ? addressRaw.toLowerCase() : "";

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    if (!address || !address.startsWith("0x") || address.length !== 42) {
      return NextResponse.json({ error: "Valid address is required" }, { status: 400 });
    }
    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "File must be an image" }, { status: 400 });
    }
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: "Image must be under 5MB" }, { status: 400 });
    }

    const bucket = process.env.SUPABASE_PROFILE_IMAGES_BUCKET || DEFAULT_BUCKET;
    const ext = file.name.includes(".") ? file.name.split(".").pop() : "jpg";
    const filePath = `${address}/${Date.now()}.${ext}`;

    const bucketError = await ensureBucket(supabase, bucket);
    if (bucketError) {
      return NextResponse.json(
        { error: bucketError.message || "Failed to initialize storage bucket" },
        { status: 500 },
      );
    }

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(filePath, file, {
        cacheControl: "3600",
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      return NextResponse.json(
        { error: uploadError.message || "Failed to upload image to storage" },
        { status: 500 },
      );
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from(bucket).getPublicUrl(filePath);

    if (!publicUrl) {
      return NextResponse.json({ error: "Failed to generate image URL" }, { status: 500 });
    }

    return NextResponse.json({ url: publicUrl, path: filePath, bucket });
  } catch (error) {
    console.error("[profile/upload-image] error:", error);
    return NextResponse.json({ error: "Failed to upload image" }, { status: 500 });
  }
}

