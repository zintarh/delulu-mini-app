import { createPublicClient, http, parseAbi, zeroAddress } from "viem";
import { celo } from "viem/chains";

const CELO_RPC =
  process.env.NEXT_PUBLIC_CELO_RPC_URL ??
  process.env.CELO_RPC_URL ??
  "https://forno.celo.org";

const publicClient = createPublicClient({
  chain: celo,
  transport: http(CELO_RPC),
});

// Same address/ABI @goodsdks/identity-sdk uses for env "production"
// (identityContractAddresses.production in that package's src/constants.ts).
// Copied locally rather than imported — that package pulls in wagmi/React,
// which a server route shouldn't depend on. Keep this in sync manually if
// the SDK ever changes it.
const GOOD_DOLLAR_IDENTITY_ADDRESS = "0xC361A6E67822a0EDc17D899227dd9FC50BD62F42" as const;

const identityV2ABI = parseAbi([
  "function getWhitelistedRoot(address account) view returns (address)",
]);

/**
 * Server-side, non-client-trusted GoodDollar face-verification check —
 * mirrors what apps/web/src/hooks/identityHook.ts does client-side via the
 * GoodDollar SDK, but as a direct read-only contract call so it can run in
 * an API route. Fails closed: any RPC error returns false, never credits a
 * referral on an uncertain check.
 */
export async function isGoodDollarVerified(address: string): Promise<boolean> {
  try {
    const root = await publicClient.readContract({
      address: GOOD_DOLLAR_IDENTITY_ADDRESS,
      abi: identityV2ABI,
      functionName: "getWhitelistedRoot",
      args: [address as `0x${string}`],
    });
    return root !== zeroAddress;
  } catch (err) {
    console.error("[referral] GoodDollar verification check failed", err);
    return false;
  }
}
