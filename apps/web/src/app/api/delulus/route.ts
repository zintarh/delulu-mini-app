import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { createDelulu, getDelulus } from "@/lib/db/delulus";
import { jsonResponse, formatZodError, errorResponse } from "@/lib/api";
import { createDeluluSchema } from "@/lib/validations/delulu";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const limit = parseInt(searchParams.get("limit") ?? "20");
    const cursor = searchParams.get("cursor") ?? undefined;
    const creatorAddress = searchParams.get("creator") ?? undefined;
    const includeResolved = searchParams.get("includeResolved") !== "false";

    const delulus = await getDelulus({
      limit,
      cursor,
      creatorAddress,
      includeResolved,
    });

    // Add computed totalStake (TVL) to each delulu
    const delulusWithTVL = delulus.map((d: (typeof delulus)[number]) => ({
      ...d,
      totalStake: d.totalBelieverStake + d.totalDoubterStake,
    }));

    return jsonResponse({
      data: delulusWithTVL,
      nextCursor:
        delulus.length === limit ? delulus[delulus.length - 1]?.id : null,
    });
  } catch (error) {
    console.error("GET /api/delulus error:", error);
    return errorResponse("Internal error");
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = createDeluluSchema.parse(body);

    const delulu = await createDelulu({
      onChainId: validated.onChainId,
      contentHash: validated.contentHash,
      content: validated.content,
      creatorAddress: validated.creatorAddress,
      stakingDeadline: validated.stakingDeadline,
      resolutionDeadline: validated.resolutionDeadline,
      bgImageUrl: validated.bgImageUrl,
      gatekeeper: validated.gatekeeper,
    });

    return jsonResponse(delulu, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(formatZodError(error), { status: 400 });
    }
    console.error("POST /api/delulus error:", error);
    return errorResponse("Internal error");
  }
}
