import { NextRequest } from "next/server";
import { handleGasRequest } from "@/lib/faucet/route-handler";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  return handleGasRequest(request);
}
