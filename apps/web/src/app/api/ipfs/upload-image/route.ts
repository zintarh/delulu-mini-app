import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/push/supabase";

const DEFAULT_BUCKET = "delulu-images";

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
    const msg = String(createError.message || "").toLowerCase();
    if (msg.includes("already")) return null;
    return createError;
  }
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return NextResponse.json({ error: "Storage not configured" }, { status: 500 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "File must be an image" }, { status: 400 });
    }
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: "Image must be under 5MB" }, { status: 400 });
    }

    const bucket = process.env.SUPABASE_DELULU_IMAGES_BUCKET || DEFAULT_BUCKET;
    const ext = file.name.includes(".") ? file.name.split(".").pop() : "jpg";
    const filePath = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const uploadOptions = {
      cacheControl: "3600",
      contentType: file.type,
      upsert: false,
    };

    // Prefer direct upload — listing buckets on every frame was a major hang source.
    let { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(filePath, file, uploadOptions);

    if (uploadError) {
      const msg = String(uploadError.message || "").toLowerCase();
      const missingBucket =
        msg.includes("bucket") && (msg.includes("not found") || msg.includes("does not exist"));
      if (missingBucket) {
        const bucketError = await ensureBucket(supabase, bucket);
        if (bucketError) {
          return NextResponse.json(
            { error: bucketError.message || "Failed to initialize storage" },
            { status: 500 },
          );
        }
        ({ error: uploadError } = await supabase.storage
          .from(bucket)
          .upload(filePath, file, uploadOptions));
      }
    }

    if (uploadError) {
      return NextResponse.json(
        { error: uploadError.message || "Failed to upload image" },
        { status: 500 },
      );
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from(bucket).getPublicUrl(filePath);

    if (!publicUrl) {
      return NextResponse.json({ error: "Failed to get image URL" }, { status: 500 });
    }

    return NextResponse.json({ url: publicUrl, path: filePath, bucket });
  } catch (error) {
    console.error("[upload-image]", error);
    return NextResponse.json({ error: "Failed to upload image" }, { status: 500 });
  }
}
