import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 60;

type CoinGeckoResponse = {
  gooddollar?: {
    usd?: number;
  };
};

export async function GET() {
  try {
    const response = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=gooddollar&vs_currencies=usd",
      {
        headers: {
          accept: "application/json",
        },
        next: { revalidate: 60 },
      },
    );

    if (!response.ok) {
      return NextResponse.json(
        { usd: null, error: `Upstream error: HTTP ${response.status}` },
        { status: 200 },
      );
    }

    const json = (await response.json()) as CoinGeckoResponse;
    const usd = json?.gooddollar?.usd;

    return NextResponse.json(
      {
        usd: typeof usd === "number" && Number.isFinite(usd) ? usd : null,
      },
      { status: 200 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        usd: null,
        error: error instanceof Error ? error.message : "Failed to fetch price",
      },
      { status: 200 },
    );
  }
}

