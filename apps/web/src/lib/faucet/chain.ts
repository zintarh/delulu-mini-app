import { createPublicClient, createWalletClient, http, type Hash } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { celo } from "viem/chains";
import { DELULU_ABI } from "@/lib/abi";
import { DELULU_CONTRACT_ADDRESS } from "@/lib/constant";

const RPC =
  process.env.CELO_RPC_URL ??
  process.env.NEXT_PUBLIC_CELO_RPC_URL ??
  process.env.NEXT_PUBLIC_RPC_URL ??
  "https://forno.celo.org";

export const faucetPublicClient = createPublicClient({ chain: celo, transport: http(RPC, { retryCount: 2 }) });

export function faucetAccount() {
  const raw = process.env.CELO_FAUCET_PRIVATE_KEY;
  if (!raw) throw new Error("CELO_FAUCET_PRIVATE_KEY is not configured");
  return privateKeyToAccount((raw.startsWith("0x") ? raw : `0x${raw}`) as `0x${string}`);
}

export function faucetAddress(): `0x${string}` | null {
  try {
    return faucetAccount().address;
  } catch {
    return null;
  }
}

/**
 * The max fee per gas a user's wallet will set right now. A wallet must hold
 * gasLimit × maxFeePerGas to submit, even though it usually pays less, so
 * this (not the base fee) is what the drip has to cover.
 */
export async function currentMaxFeePerGas(): Promise<bigint> {
  try {
    const fees = await faucetPublicClient.estimateFeesPerGas();
    if (fees.maxFeePerGas && fees.maxFeePerGas > 0n) return fees.maxFeePerGas;
  } catch (err) {
    console.warn("[faucet] estimateFeesPerGas failed, falling back to gasPrice", err);
  }
  // Legacy price + 20% so a fallback never under-prices.
  const price = await faucetPublicClient.getGasPrice();
  return (price * 12n) / 10n;
}

/** True once the wallet has a username on the Delulu contract (profile tx done). */
export async function hasOnChainProfile(address: `0x${string}`): Promise<boolean> {
  const name = (await faucetPublicClient.readContract({
    address: DELULU_CONTRACT_ADDRESS,
    abi: DELULU_ABI,
    functionName: "getUsername",
    args: [address],
  })) as string;
  return typeof name === "string" && name.trim().length > 0;
}

const NONCE_ERROR = /nonce|replacement transaction underpriced|already known|transaction underpriced/i;

/**
 * Broadcasts a CELO transfer from the faucet and returns the hash as soon as
 * it's accepted (the receipt is awaited separately so the hash can be saved
 * first). Several requests share one hot wallet, so two can race for the same
 * nonce: retry those with a fresh pending nonce.
 */
export async function broadcastCelo(to: `0x${string}`, valueWei: bigint): Promise<Hash> {
  const account = faucetAccount();
  const wallet = createWalletClient({ account, chain: celo, transport: http(RPC) });
  let lastErr: unknown;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const nonce = await faucetPublicClient.getTransactionCount({ address: account.address, blockTag: "pending" });
      return await wallet.sendTransaction({ to, value: valueWei, nonce });
    } catch (err) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);
      if (!NONCE_ERROR.test(msg)) throw err;
      await new Promise((r) => setTimeout(r, 250 + Math.random() * 750));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("Faucet send failed after nonce retries");
}

/** "success" | "reverted", or null while it isn't mined yet (or the RPC doesn't know it). */
export async function receiptStatus(hash: Hash): Promise<"success" | "reverted" | null> {
  try {
    const r = await faucetPublicClient.getTransactionReceipt({ hash });
    return r.status;
  } catch {
    return null;
  }
}

/** Waits up to `timeoutMs` for the receipt; null on timeout. */
export async function waitForReceipt(hash: Hash, timeoutMs: number): Promise<"success" | "reverted" | null> {
  try {
    const r = await faucetPublicClient.waitForTransactionReceipt({ hash, timeout: timeoutMs, confirmations: 1 });
    return r.status;
  } catch {
    return null;
  }
}

export type OutgoingCelo = { to: string | null; valueWei: bigint };

/**
 * Native CELO this wallet sent, from `sinceBlock` onward. null when the
 * history lookup fails — the caller must not treat that as "they sent it".
 * Fees are not included; only transaction value is.
 */
export async function outgoingCeloSince(address: `0x${string}`, sinceBlock: bigint): Promise<OutgoingCelo[] | null> {
  const found: OutgoingCelo[] = [];
  let query = "filter=from";
  try {
    for (let page = 0; page < 5; page++) {
      const res = await fetch(`https://celo.blockscout.com/api/v2/addresses/${address}/transactions?${query}`, {
        headers: { accept: "application/json" },
      });
      if (!res.ok) return null;
      const json = (await res.json()) as {
        items?: { block_number?: number; from?: { hash?: string }; to?: { hash?: string } | null; value?: string }[];
        next_page_params?: Record<string, string | number> | null;
      };
      let passedStart = false;
      for (const tx of json.items ?? []) {
        const block = BigInt(tx.block_number ?? 0);
        if (block < sinceBlock) {
          passedStart = true;
          continue;
        }
        if (String(tx.from?.hash ?? "").toLowerCase() !== address.toLowerCase()) continue;
        found.push({ to: tx.to?.hash ?? null, valueWei: BigInt(tx.value ?? "0") });
      }
      if (passedStart || !json.next_page_params) break;
      query = new URLSearchParams(
        Object.entries(json.next_page_params).map(([key, value]) => [key, String(value)]),
      ).toString();
    }
    return found;
  } catch (err) {
    console.error("[faucet] could not read outgoing transfers", err);
    return null;
  }
}

/** Whether the network still knows the tx at all (mempool or mined). */
export async function txKnown(hash: Hash): Promise<boolean> {
  try {
    await faucetPublicClient.getTransaction({ hash });
    return true;
  } catch {
    return false;
  }
}
