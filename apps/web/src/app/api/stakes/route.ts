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
    const validated = createStakeSchema.parse(body);

    const stake = await createStake(validated);

    return jsonResponse(stake, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(formatZodError(error), { status: 400 });
    }
    console.error("POST /api/stakes error:", error);
    return errorResponse("Internal error");
  }
}
