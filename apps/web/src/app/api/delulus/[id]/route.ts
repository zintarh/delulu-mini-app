import { NextRequest, NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { getDeluluById, getDeluluByOnChainId, resolveDelulu, cancelDelulu } from "@/lib/db/delulus";
import { jsonResponse, formatZodError, errorResponse } from "@/lib/api";

type Params = { params: Promise<{ id: string }> };

const patchSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("resolve"), outcome: z.boolean() }),
  z.object({ action: z.literal("cancel") }),
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
      const delulu = await resolveDelulu(id, validated.outcome);
      return jsonResponse(delulu);
    }

    const delulu = await cancelDelulu(id);
    return jsonResponse(delulu);
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(formatZodError(error), { status: 400 });
    }
    console.error("PATCH /api/delulus/[id] error:", error);
    return errorResponse("Internal error");
  }
}
