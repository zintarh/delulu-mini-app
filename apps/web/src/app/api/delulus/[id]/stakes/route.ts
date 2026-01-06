import { NextRequest } from "next/server";
import { getStakesByDelulu } from "@/lib/db/stakes";
import { jsonResponse, errorResponse } from "@/lib/api";

type Params = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const stakes = await getStakesByDelulu(id);

    return jsonResponse(stakes);
  } catch (error) {
    console.error("GET /api/delulus/[id]/stakes error:", error);
    return errorResponse("Internal error");
  }
}
