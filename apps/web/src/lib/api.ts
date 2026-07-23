import { NextResponse } from "next/server";

/**
 * Serializes data containing BigInt values to JSON-safe format.
 * Converts BigInt to string recursively.
 */
function serializeBigInt<T>(data: T): T {
  return JSON.parse(
    JSON.stringify(data, (_, value) =>
      typeof value === "bigint" ? value.toString() : value
    )
  );
}

/**
 * Creates a JSON response with BigInt serialization.
 */
export function jsonResponse<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(serializeBigInt(data), init);
}

/**
 * Standard error response helper.
 */
export function errorResponse(message: string, status = 500) {
  return NextResponse.json({ error: message }, { status });
}
