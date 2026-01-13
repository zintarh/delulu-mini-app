import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { createStake, getStakesByUser, getUserPosition } from "@/lib/db/stakes";
import { jsonResponse, formatZodError, errorResponse } from "@/lib/api";
import { createStakeSchema } from "@/lib/validations/stake";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const address = searchParams.get("address");
    const deluluId = searchParams.get("deluluId");

    if (!address) {
      return errorResponse("Address required", 400);
    }

    if (deluluId) {
      const position = await getUserPosition(address, deluluId);
      return jsonResponse(position ?? { believerStake: 0, doubterStake: 0 });
    }

    const stakes = await getStakesByUser(address);
    return jsonResponse(stakes);
  } catch (error) {
    console.error("GET /api/stakes error:", error);
    return errorResponse("Internal error");
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log("[POST /api/stakes] Received request (before validation):", {
      userAddress: body.userAddress,
      deluluId: body.deluluId,
      amount: body.amount,
      side: body.side,
      sideType: typeof body.side,
      sideValue: body.side,
      txHash: body.txHash,
    });

    const validated = createStakeSchema.parse(body);
    console.log("[POST /api/stakes] Validated data (after transform to boolean):", {
      userAddress: validated.userAddress,
      deluluId: validated.deluluId,
      amount: validated.amount,
      side: validated.side,
      sideType: typeof validated.side,
      sideValue: validated.side,
      txHash: validated.txHash,
    });

    const stake = await createStake(validated);
    console.log("[POST /api/stakes] Created stake:", {
      id: stake.id,
      userId: stake.userId,
      deluluId: stake.deluluId,
      amount: stake.amount,
      side: stake.side,
      txHash: stake.txHash,
    });

    return jsonResponse(stake, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      console.error("[POST /api/stakes] Validation error:", formatZodError(error));
      return NextResponse.json(formatZodError(error), { status: 400 });
    }
    console.error("POST /api/stakes error:", {
      error,
      errorMessage: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
    });
    return errorResponse("Internal error");
  }
}
