import { NextRequest, NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { getDeluluById, getDeluluByOnChainId, resolveDelulu, cancelDelulu } from "@/lib/db/delulus";
import { jsonResponse, formatZodError, errorResponse } from "@/lib/api";

type Params = { params: Promise<{ id: string }> };

const patchSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("resolve"), outcome: z.boolean() }),
  z.object({ action: z.literal("cancel"), creatorAddress: z.string().optional() }),
]);

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    
    // Try to find by database ID first (UUID)
    let delulu = await getDeluluById(id);
    
    // If not found and ID is numeric, try finding by onChainId
    if (!delulu && /^\d+$/.test(id)) {
      delulu = await getDeluluByOnChainId(BigInt(id));
    }

    if (!delulu) {
      return errorResponse("Not found", 404);
    }

    // Add computed totalStake (TVL)
    const deluluWithTVL = {
      ...delulu,
      totalStake: delulu.totalBelieverStake + delulu.totalDoubterStake,
    };

    return jsonResponse(deluluWithTVL);
  } catch (error) {
    console.error("GET /api/delulus/[id] error:", error);
    return errorResponse("Internal error");
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const body = await request.json();
    const validated = patchSchema.parse(body);

    if (validated.action === "resolve") {
      // Try to find by database ID first (UUID)
      let delulu = await getDeluluById(id);
      
      // If not found and ID is numeric, try finding by onChainId
      if (!delulu && /^\d+$/.test(id)) {
        delulu = await getDeluluByOnChainId(BigInt(id));
      }

      if (!delulu) {
        return errorResponse("Delulu not found", 404);
      }

      // Check if already resolved
      if (delulu.isResolved) {
        return errorResponse("Delulu is already resolved", 400);
      }
      if (delulu.isCancelled) {
        return errorResponse("Cannot resolve a cancelled delulu", 400);
      }

      // Use the database ID (UUID) for resolveDelulu, not the URL param
      const resolvedDelulu = await resolveDelulu(delulu.id, validated.outcome);
      return jsonResponse(resolvedDelulu);
    }

    if (validated.action === "cancel") {
      // Get the delulu to check creator
      // Try to find by database ID first (UUID)
      let delulu = await getDeluluById(id);
      
      // If not found and ID is numeric, try finding by onChainId
      if (!delulu && /^\d+$/.test(id)) {
        delulu = await getDeluluByOnChainId(BigInt(id));
      }

      if (!delulu) {
        return errorResponse("Delulu not found", 404);
      }

      // Get creator address from request body
      const creatorAddress = validated.creatorAddress;
      if (!creatorAddress) {
        return errorResponse("Creator address required", 400);
      }

      // Verify the requester is the creator
      if (delulu.creatorAddress.toLowerCase() !== creatorAddress.toLowerCase()) {
        return errorResponse("Only the creator can cancel this delulu", 403);
      }

      // Check if already cancelled or resolved
      if (delulu.isCancelled) {
        return errorResponse("Delulu is already cancelled", 400);
      }
      if (delulu.isResolved) {
        return errorResponse("Cannot cancel a resolved delulu", 400);
      }

      // Use the database ID (UUID) for cancelDelulu, not the URL param
      const cancelledDelulu = await cancelDelulu(delulu.id);
      return jsonResponse(cancelledDelulu);
    }

    return errorResponse("Invalid action", 400);
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(formatZodError(error), { status: 400 });
    }
    console.error("PATCH /api/delulus/[id] error:", error);
    return errorResponse("Internal error");
  }
}
