import { NextRequest } from "next/server";
import { createPublicClient, createWalletClient, http, parseEther } from "viem";
import { celo } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { createClient } from "@supabase/supabase-js";
import { errorResponse, jsonResponse } from "@/lib/api";

const DAILY_MS = 24 * 60 * 60 * 1000;
// Users qualify for the faucet as long as they have less than 0.05 CELO.
// If their balance later drops below 0.05 again, they can claim again (subject to daily rate limit).
const MIN_NATIVE_BALANCE = parseEther("0.05");
const FAUCET_AMOUNT = parseEther("1"); // amount of CELO to send

const RPC_URL =
  process.env.NEXT_PUBLIC_CELO_RPC_URL ??
  process.env.NEXT_PUBLIC_RPC_URL ??
  "https://forno.celo.org";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase =
  SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false },
      })
    : null;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const address = (body?.address as string | undefined)?.toLowerCase();

    if (!address || !address.startsWith("0x") || address.length !== 42) {
      return errorResponse("Valid address required", 400);
    }

    const pk = process.env.CELO_FAUCET_PRIVATE_KEY;
    if (!pk) {
      return errorResponse(
        "Faucet is not configured. Missing CELO_FAUCET_PRIVATE_KEY.",
        500
      );
    }

    if (!supabase) {
      return errorResponse(
        "Faucet is not configured. Missing Supabase credentials.",
        500
      );
    }

    const account = privateKeyToAccount(`0x${pk.replace(/^0x/, "")}`);

    const publicClient = createPublicClient({
      chain: celo,
      transport: http(RPC_URL),
    });

    const walletClient = createWalletClient({
      account,
      chain: celo,
      transport: http(RPC_URL),
    });

    // 0. Check faucet wallet balance first so users get a clear error.
    const faucetBalance = await publicClient.getBalance({ address: account.address });
    if (faucetBalance < FAUCET_AMOUNT) {
      return errorResponse(
        "Faucet is temporarily empty. Please try again later.",
        503
      );
    }

    // 1. Check user native CELO balance
    const balance = await publicClient.getBalance({ address: address as `0x${string}` });
    if (balance >= MIN_NATIVE_BALANCE) {
      return errorResponse(
        "You already have at least 0.05 CELO for gas. Faucet is only for low-balance wallets.",
        400
      );
    }

    // 2. Enforce 1 claim per 24h via Supabase table `faucet_claims`
    const { data: lastClaim, error: lastClaimError } = await supabase
      .from("faucet_claims")
      .select("created_at")
      .eq("address", address.toLowerCase())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastClaimError) {
      console.error("Supabase faucet_claims query error:", lastClaimError);
      const msg = String(lastClaimError.message || "");
      if (
        msg.includes("Could not find the table") &&
        msg.includes("faucet_claims")
      ) {
        return errorResponse(
          "Faucet DB table is missing. Create public.faucet_claims first.",
          500
        );
      }
      return errorResponse("Unable to validate faucet rate limit right now.", 500);
    }

    if (lastClaim?.created_at) {
      const since = Date.now() - new Date(lastClaim.created_at).getTime();
      if (since < DAILY_MS) {
        const remainingMs = DAILY_MS - since;
        const remainingHours = Math.ceil(remainingMs / (60 * 60 * 1000));
        return errorResponse(
          `You have already claimed gas in the last 24 hours. Try again in ~${remainingHours}h.`,
          429
        );
      }
    }

    // 3. Send CELO
    let hash: `0x${string}`;
    try {
      hash = await walletClient.sendTransaction({
        to: address as `0x${string}`,
        value: FAUCET_AMOUNT,
      });
    } catch (sendErr: any) {
      const msg = String(sendErr?.shortMessage || sendErr?.message || "");
      if (msg.toLowerCase().includes("insufficient funds")) {
        return errorResponse("Faucet is temporarily empty. Please try again later.", 503);
      }
      return errorResponse(
        msg || "Failed to send CELO from faucet wallet.",
        500
      );
    }

    // Store claim record in Supabase (table: faucet_claims)
    const { error: insertError } = await supabase.from("faucet_claims").insert({
      address: address.toLowerCase(),
      amount: Number(FAUCET_AMOUNT) / 1e18,
      tx_hash: hash,
    });

    if (insertError) {
      console.error("Supabase faucet_claims insert error:", insertError);
      const msg = String(insertError.message || "");
      if (
        msg.includes("Could not find the table") &&
        msg.includes("faucet_claims")
      ) {
        return errorResponse(
          "Faucet DB table is missing. Create public.faucet_claims first.",
          500
        );
      }
      return errorResponse("Failed to store faucet claim record.", 500);
    }

    return jsonResponse({ hash }, { status: 201 });
  } catch (error: any) {
    console.error("POST /api/faucet error:", error);
    const msg = String(error?.shortMessage || error?.message || "");
    return errorResponse(msg || "Failed to process faucet request", 500);
  }
}

