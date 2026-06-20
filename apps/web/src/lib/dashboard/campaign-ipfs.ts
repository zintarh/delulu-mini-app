import { getSupabaseAdmin } from "@/lib/push/supabase";

const DEFAULT_BUCKET = "delulu-content";

export async function uploadCampaignContentHash(
  title: string,
  description?: string | null,
): Promise<string> {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Storage not configured");

  const metadata: Record<string, unknown> = {
    text: title,
    description: description ?? "",
    createdAt: new Date().toISOString(),
    kind: "community_campaign",
  };

  const bucket = process.env.SUPABASE_DELULU_CONTENT_BUCKET || DEFAULT_BUCKET;
  const filePath = `campaign-${Date.now()}-${Math.random().toString(36).slice(2)}.json`;
  const body = Buffer.from(JSON.stringify(metadata));

  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(filePath, body, {
      contentType: "application/json",
      cacheControl: "31536000",
      upsert: false,
    });

  if (uploadError) throw new Error(uploadError.message || "Upload failed");

  const {
    data: { publicUrl },
  } = supabase.storage.from(bucket).getPublicUrl(filePath);

  if (!publicUrl) throw new Error("Failed to get content URL");
  return publicUrl;
}
