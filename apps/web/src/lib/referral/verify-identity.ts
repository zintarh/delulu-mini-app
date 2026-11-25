import { createPublicClient, http, type Address } from "viem";
import { celo } from "viem/chains";
import { IDENTITY_ABI, IDENTITY_ADDRESS, hasEverVerified, readIdentityStatus } from "@/lib/identity/status";

const CELO_RPC =
  process.env.NEXT_PUBLIC_CELO_RPC_URL ??
  process.env.NEXT_PUBLIC_RPC_URL ??
  process.env.CELO_RPC_URL ??
  "https://forno.celo.org";

const publicClient = createPublicClient({
  chain: celo,
  transport: http(CELO_RPC),
});

/** Bulk face checks go through the public Celo node so a large partner list does not trip a keyed RPC limit. */
const bulkClient = createPublicClient({
  chain: celo,
  transport: http("https://forno.celo.org"),
});

const ZERO = "0x0000000000000000000000000000000000000000";

function selfEverVerified(id: unknown): boolean {
  const [dateAuthenticated, , , , status] = id as [bigint, bigint, string, bigint, number, number];
  return status !== 255 && dateAuthenticated !== 0n;
}

/**
 * Server-side, non-client-trusted GoodDollar face-verification check —
 * mirrors what apps/web/src/hooks/identityHook.ts does client-side. Reads
 * the actual re-verification ladder (see lib/identity/status.ts) rather
 * than just `getWhitelistedRoot() != 0`, which goes to zero the moment a
 * wallet's current window lapses and makes someone who verified last week
 * look identical to someone who never verified at all.
 *
 * Returns true for "verified" AND "lapsed" — every caller of this (referral
 * crediting, referral-link eligibility, the onboarding gift) cares whether
 * this wallet ever genuinely proved it's a real person, not whether it
 * happens to be inside its current rolling window right now. Only "none"
 * (never verified) and "blacklisted" return false. Fails closed: any RPC
 * error returns false, never credits anything on an uncertain check.
 */
export async function isGoodDollarVerified(address: string): Promise<boolean> {
  try {
    const status = await readIdentityStatus(publicClient, address);
    return hasEverVerified(status);
  } catch (err) {
    console.error("[referral] GoodDollar verification check failed", err);
    return false;
  }
}

type CallResult = { status: "success"; result: unknown } | { status: "failure" };

/** One explicit multicall per chunk. Automatic readContract batching mixes in reverting rung probes and can mark strangers as verified. */
async function readIdentityBundle(addresses: string[]): Promise<CallResult[]> {
  const contracts = addresses.flatMap((address) =>
    (["getWhitelistedRoot", "identities", "connectedAccounts"] as const).map((functionName) => ({
      address: IDENTITY_ADDRESS,
      abi: IDENTITY_ABI,
      functionName,
      args: [address as Address],
    })),
  );
  return bulkClient.multicall({ contracts, allowFailure: true });
}

/**
 * Face-check status for a whole referral list.
 * A wallet counts if it is whitelisted now, or its own identity record shows it verified before.
 * Linked wallets whose own record is empty get one extra read of the root they point at.
 */
export async function everVerifiedWallets(addresses: string[]): Promise<Set<string>> {
  const verified = new Set<string>();
  const pendingHolders = new Map<string, string>();

  const consume = (list: string[], rows: CallResult[]) => {
    const failed: string[] = [];
    list.forEach((address, index) => {
      const root = rows[index * 3];
      const self = rows[index * 3 + 1];
      const linked = rows[index * 3 + 2];
      if (!root || !self || !linked || root.status === "failure" || self.status === "failure" || linked.status === "failure") {
        failed.push(address);
        return;
      }
      const rootAddr = String(root.result).toLowerCase();
      const linkedAddr = String(linked.result).toLowerCase();
      if (rootAddr !== ZERO || selfEverVerified(self.result)) {
        verified.add(address);
        return;
      }
      if (linkedAddr !== ZERO) pendingHolders.set(address, linkedAddr);
    });
    return failed;
  };

  const chunks: string[][] = [];
  for (let i = 0; i < addresses.length; i += 80) chunks.push(addresses.slice(i, i + 80));
  for (let i = 0; i < chunks.length; i += 3) {
    const wave = chunks.slice(i, i + 3);
    const rows = await Promise.all(wave.map((chunk) => readIdentityBundle(chunk)));
    const failed = wave.flatMap((chunk, index) => consume(chunk, rows[index]));
    if (failed.length > 0) consume(failed, await readIdentityBundle(failed));
  }

  const holders = [...pendingHolders.entries()].filter(([address]) => !verified.has(address));
  for (let i = 0; i < holders.length; i += 80) {
    const slice = holders.slice(i, i + 80);
    const rows = await bulkClient.multicall({
      allowFailure: true,
      contracts: slice.map(([, holder]) => ({
        address: IDENTITY_ADDRESS,
        abi: IDENTITY_ABI,
        functionName: "identities" as const,
        args: [holder as Address],
      })),
    });
    slice.forEach(([address], index) => {
      const row = rows[index];
      if (row?.status === "success" && selfEverVerified(row.result)) verified.add(address);
    });
  }
  return verified;
}
