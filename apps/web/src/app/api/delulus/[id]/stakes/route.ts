import { NextRequest } from "next/server";
import { getStakesByDelulu } from "@/lib/db/stakes";
import { getDeluluById, getDeluluByOnChainId } from "@/lib/db/delulus";
import { jsonResponse, errorResponse } from "@/lib/api";

type Params = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    
    // Try to find delulu by database ID first (UUID)
    let delulu = await getDeluluById(id);
    
    // If not found and ID is numeric, try finding by onChainId
    if (!delulu && /^\d+$/.test(id)) {
      delulu = await getDeluluByOnChainId(BigInt(id));
    }

    if (!delulu) {
      return errorResponse("Delulu not found", 404);
    }

    // Use the database ID (UUID) to fetch stakes
    const stakes = await getStakesByDelulu(delulu.id);

    return jsonResponse(stakes);
  } catch (error) {
    console.error("GET /api/delulus/[id]/stakes error:", error);
    return errorResponse("Internal error");
  }
}
