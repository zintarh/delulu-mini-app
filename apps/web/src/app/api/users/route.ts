import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { findOrCreateUser, getUserByAddress } from "@/lib/db/users";
import { jsonResponse, formatZodError, errorResponse } from "@/lib/api";
import { createUserSchema } from "@/lib/validations/user";

export async function GET(request: NextRequest) {
  try {
    const address = request.nextUrl.searchParams.get("address");

    if (!address) {
      return errorResponse("Address required", 400);
    }

    const user = await getUserByAddress(address);

    if (!user) {
      return errorResponse("User not found", 404);
    }

    return jsonResponse(user);
  } catch (error) {
    console.error("GET /api/users error:", error);
    return errorResponse("Internal error");
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = createUserSchema.parse(body);

    const user = await findOrCreateUser(validated);

    return jsonResponse(user, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(formatZodError(error), { status: 400 });
    }
    console.error("POST /api/users error:", error);
    return errorResponse("Internal error");
  }
}
