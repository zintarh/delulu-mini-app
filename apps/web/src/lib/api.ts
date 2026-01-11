import { NextResponse } from "next/server";
import { ZodError } from "zod";

/**
 * Serializes data containing BigInt values to JSON-safe format.
 * Converts BigInt to string recursively.
 */
export function serializeBigInt<T>(data: T): T {
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
 * Formats Zod validation errors into a clean response.
 */
export function formatZodError(error: ZodError) {
  return {
    error: "Validation failed",
    details: error.errors.map((e) => ({
      field: e.path.join("."),
      message: e.message,
    })),
  };
}

/**
 * Standard error response helper.
 */
export function errorResponse(message: string, status = 500) {
  return NextResponse.json({ error: message }, { status });
}
