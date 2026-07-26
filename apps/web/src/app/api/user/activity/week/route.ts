import { NextRequest, NextResponse } from "next/server";
import { fetchWeeklyUserActivity } from "@/lib/user-activity-subgraph";

export const dynamic = "force-dynamic";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const address = String(searchParams.get("address") ?? "").trim().toLowerCase();
  const weekStart = String(searchParams.get("weekStart") ?? "").trim();
  const fromRaw = searchParams.get("from");
  const toRaw = searchParams.get("to");
  const tzRaw = searchParams.get("tzOffsetMinutes");

  if (!address || !/^0x[a-f0-9]{40}$/.test(address)) {
    return NextResponse.json({ error: "Valid wallet address is required" }, { status: 400 });
  }
  if (!ISO_DATE.test(weekStart)) {
    return NextResponse.json(
      { error: "weekStart must be a Monday date (YYYY-MM-DD)" },
      { status: 400 },
    );
  }

  const fromUnix = Number(fromRaw);
  const toUnix = Number(toRaw);
  if (!Number.isFinite(fromUnix) || !Number.isFinite(toUnix) || toUnix <= fromUnix) {
    return NextResponse.json(
      { error: "from and to unix timestamps are required (to > from)" },
      { status: 400 },
    );
  }

  const tzOffsetMinutes = Number(tzRaw);
  if (!Number.isFinite(tzOffsetMinutes)) {
    return NextResponse.json(
      { error: "tzOffsetMinutes is required" },
      { status: 400 },
    );
  }

  try {
    const result = await fetchWeeklyUserActivity({
      address,
      weekStart,
      fromUnix: Math.floor(fromUnix),
      toUnix: Math.floor(toUnix),
      tzOffsetMinutes: Math.trunc(tzOffsetMinutes),
    });
    return NextResponse.json(result);
  } catch (err) {
    console.error("[user/activity/week]", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to load weekly activity",
      },
      { status: 500 },
    );
  }
}
