import { NextRequest } from "next/server";
import { errorResponse, jsonResponse } from "@/lib/api";
import { getSupabaseAdmin } from "@/lib/push/supabase";

// GET /api/goals/metadata/[onChainId]
export async function GET(
  _req: NextRequest,
  { params }: { params: { onChainId: string } }
) {
  try {
    const supabase = getSupabaseAdmin();
    if (!supabase) return errorResponse("Database not configured", 503);

    const { data, error } = await supabase
      .from("delulu_metadata")
      .select("*")
      .eq("on_chain_id", params.onChainId)
      .maybeSingle();

    if (error) throw error;

    return jsonResponse({ metadata: data });
  } catch (err: any) {
    return errorResponse(err?.message || "Failed to fetch metadata", 500);
  }
}

// PATCH /api/goals/metadata/[onChainId] — edit title/description/image
export async function PATCH(
  req: NextRequest,
  { params }: { params: { onChainId: string } }
) {
  try {
    const body = await req.json();
    const { creatorAddress, titleOverride, descriptionOverride, imageOverride } = body;

    if (!creatorAddress) return errorResponse("creatorAddress required", 400);

    const supabase = getSupabaseAdmin();
    if (!supabase) return errorResponse("Database not configured", 503);

    // Verify ownership
    const { data: existing } = await supabase
      .from("delulu_metadata")
      .select("creator_address")
      .eq("on_chain_id", params.onChainId)
      .maybeSingle();

    if (existing && existing.creator_address !== creatorAddress.toLowerCase()) {
      return errorResponse("Unauthorized", 403);
    }

    const updates: Record<string, any> = { updated_at: new Date().toISOString() };
    if (titleOverride !== undefined) updates.title_override = titleOverride;
    if (descriptionOverride !== undefined) updates.description_override = descriptionOverride;
    if (imageOverride !== undefined) updates.image_override = imageOverride;

    const { error } = await supabase
      .from("delulu_metadata")
      .upsert({
        on_chain_id: params.onChainId,
        creator_address: creatorAddress.toLowerCase(),
        ...updates,
      });

    if (error) throw error;

    return jsonResponse({ success: true });
  } catch (err: any) {
    return errorResponse(err?.message || "Failed to update metadata", 500);
  }
}

// DELETE /api/goals/metadata/[onChainId] — soft delete (is_hidden = true)
export async function DELETE(
  req: NextRequest,
  { params }: { params: { onChainId: string } }
) {
  try {
    const body = await req.json();
    const { creatorAddress } = body;

    if (!creatorAddress) return errorResponse("creatorAddress required", 400);

    const supabase = getSupabaseAdmin();
    if (!supabase) return errorResponse("Database not configured", 503);

    const { data: existing } = await supabase
      .from("delulu_metadata")
      .select("creator_address")
      .eq("on_chain_id", params.onChainId)
      .maybeSingle();

    if (existing && existing.creator_address !== creatorAddress.toLowerCase()) {
      return errorResponse("Unauthorized", 403);
    }

    const { error } = await supabase
      .from("delulu_metadata")
      .upsert({
        on_chain_id: params.onChainId,
        creator_address: creatorAddress.toLowerCase(),
        is_hidden: true,
        updated_at: new Date().toISOString(),
      });

    if (error) throw error;

    return jsonResponse({ success: true });
  } catch (err: any) {
    return errorResponse(err?.message || "Failed to delete", 500);
  }
}
