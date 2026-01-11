import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { createClaim, getClaimsByUser, getTotalClaimedByUser } from "@/lib/db/claims";
import { jsonResponse, formatZodError, errorResponse } from "@/lib/api";
import { createClaimSchema } from "@/lib/validations/claim";

export async function GET(request: NextRequest) {
  try {
    const address = request.nextUrl.searchParams.get("address");
    const total = request.nextUrl.searchParams.get("total") === "true";

    if (!address) {
      return errorResponse("Address required", 400);
    }

    if (total) {
      const amount = await getTotalClaimedByUser(address);
      return jsonResponse({ total: amount });
    }

    const claims = await getClaimsByUser(address);
    return jsonResponse(claims);
  } catch (error) {
    console.error("GET /api/claims error:", error);
    return errorResponse("Internal error");
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = createClaimSchema.parse(body);

    const claim = await createClaim(validated);

    return jsonResponse(claim, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(formatZodError(error), { status: 400 });
    }
    console.error("POST /api/claims error:", error);
    return errorResponse("Internal error");
  }
}
