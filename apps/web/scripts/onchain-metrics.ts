/**
 * Pulls three figures live from Celo mainnet:
 *
 *  1. Total new users since Jul 1 2026 — Delulu users (subgraph `User` entities,
 *     which are indexed straight off the Delulu contract's own events) whose
 *     earliest on-chain activity (delulu created, claim, campaign join, forfeit
 *     resolution, community proof) falls on/after Jul 1 2026. The subgraph's
 *     `User` entity doesn't store a signup timestamp directly, so earliest
 *     activity is the closest available proxy.
 *  2. Unique "activated" users — of those Delulu users, how many had a G$ transfer
 *     (in or out, anywhere) within 24h of their GoodDollar face verification
 *     (`identities(address).dateAuthenticated`), with that verification itself
 *     on/after Jul 1 2026.
 *  3. G$ in circulation since Jul 1 2026 — total G$ that moved IN or OUT of the
 *     app's four contracts (Delulu, CommunityMarketV1, ForfeitMarket, RewardVault).
 *
 * Data sources:
 *  - User enumeration + activity timestamps: the app's own Goldsky subgraph
 *    (NEXT_PUBLIC_SUBGRAPH_URL_MAINNET) — indexes the Delulu/CommunityMarketV1/
 *    ForfeitMarket contracts' events directly. (Raw `eth_getLogs` on the app's
 *    Alchemy RPC is hard-capped at 10 blocks/call, making a multi-million-block
 *    historical sweep for this impossible on that endpoint directly.)
 *  - GoodDollar verification status: the app's own RPC (NEXT_PUBLIC_RPC_URL),
 *    plain `eth_call` to `identities(address)` — no range restriction.
 *  - G$ movement (circulation + per-user activation check): `alchemy_getAssetTransfers`
 *    on the same RPC — an indexed Alchemy endpoint, not subject to the getLogs cap.
 *    Covers RewardVault too, which the subgraph doesn't index.
 *
 * Usage (from apps/web):
 *   pnpm tsx scripts/onchain-metrics.ts
 */
import { config } from "dotenv";
import { resolve } from "path";
import { createPublicClient, http, formatUnits, parseAbi } from "viem";
import { celo } from "viem/chains";

config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL;
const SUBGRAPH_URL = process.env.NEXT_PUBLIC_SUBGRAPH_URL_MAINNET || process.env.NEXT_PUBLIC_SUBGRAPH_URL;
const DELULU = (
  process.env.NEXT_PUBLIC_DELULU_CONTRACT_MAINNET || "0x7692199630F3865160fB1Fa496961251fA15aFEa"
).toLowerCase() as `0x${string}`;
const COMMUNITY_MARKET = (process.env.NEXT_PUBLIC_COMMUNITY_MARKET_V1_MAINNET || "").toLowerCase() as `0x${string}`;
const FORFEIT_MARKET = (process.env.NEXT_PUBLIC_FORFEIT_MARKET_MAINNET || "").toLowerCase() as `0x${string}`;
const REWARD_VAULT = (process.env.NEXT_PUBLIC_REWARD_VAULT_MAINNET || "").toLowerCase() as `0x${string}`;
const GOODDOLLAR = "0x62b8b11039fcfe5ab0c56e502b1c372a3d2a9c7a" as `0x${string}`;
const IDENTITY = "0xc361a6e67822a0edc17d899227dd9fc50bd62f42" as `0x${string}`;

if (!RPC_URL || !SUBGRAPH_URL || !COMMUNITY_MARKET || !FORFEIT_MARKET || !REWARD_VAULT) {
  console.error("Missing NEXT_PUBLIC_RPC_URL / NEXT_PUBLIC_SUBGRAPH_URL_MAINNET / contract addresses in .env.local");
  process.exit(1);
}

const APP_CONTRACTS = [DELULU, COMMUNITY_MARKET, FORFEIT_MARKET, REWARD_VAULT];
const client = createPublicClient({
  chain: celo,
  transport: http(RPC_URL, { retryCount: 8, retryDelay: 1500 }),
});

const JUL_1_2026_UTC = Math.floor(Date.UTC(2026, 6, 1, 0, 0, 0) / 1000);
const DAY = 24 * 60 * 60;

const IDENTITY_ABI = parseAbi([
  "function identities(address) view returns (uint256 dateAuthenticated, uint256 dateAdded, string did, uint256 whitelistedOnChainId, uint8 status, uint32 authCount)",
]);
const DELULU_ABI = parseAbi(["function addressToUsername(address) view returns (string)"]);

function fmt(n: number): string {
  return n.toLocaleString("en-US");
}

async function gql<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const res = await fetch(SUBGRAPH_URL!, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors) throw new Error(`Subgraph error: ${JSON.stringify(json.errors)}`);
  return json.data as T;
}

/** Cursor-paginate any subgraph list field ordered by id, collecting all rows. */
async function paginateAll<T extends { id: string }>(
  entityField: string,
  selection: string,
): Promise<T[]> {
  const all: T[] = [];
  let cursor = "";
  for (;;) {
    const data = await gql<Record<string, T[]>>(
      `query($cursor: String!) {
        ${entityField}(first: 1000, orderBy: id, orderDirection: asc, where: { id_gt: $cursor }) {
          ${selection}
        }
      }`,
      { cursor },
    );
    const rows = data[entityField];
    if (!rows.length) break;
    all.push(...rows);
    cursor = rows[rows.length - 1].id;
    if (rows.length < 1000) break;
  }
  return all;
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    for (;;) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

/** All G$ ERC20 transfers touching `address` (either direction), paginated, since fromBlock. */
async function gdTransfers(
  address: `0x${string}`,
  fromBlock: bigint,
): Promise<{ ts: number; hash: string; from: string; to: string; value: bigint }[]> {
  const out: { ts: number; hash: string; from: string; to: string; value: bigint }[] = [];
  for (const dir of ["fromAddress", "toAddress"] as const) {
    let pageKey: string | undefined;
    do {
      const params: Record<string, unknown> = {
        fromBlock: `0x${fromBlock.toString(16)}`,
        toBlock: "latest",
        [dir]: address,
        contractAddresses: [GOODDOLLAR],
        category: ["erc20"],
        withMetadata: true,
        maxCount: "0x3e8",
      };
      if (pageKey) params.pageKey = pageKey;
      const result: any = await client.request({
        method: "alchemy_getAssetTransfers" as any,
        params: [params] as any,
      });
      for (const t of result.transfers) {
        out.push({
          ts: Math.floor(new Date(t.metadata.blockTimestamp).getTime() / 1000),
          hash: t.hash,
          from: (t.from as string).toLowerCase(),
          to: (t.to as string).toLowerCase(),
          value: BigInt(t.rawContract.value),
        });
      }
      pageKey = result.pageKey;
    } while (pageKey);
  }
  return out;
}

async function blockForTimestamp(targetTs: number): Promise<bigint> {
  let lo = 0n;
  let hi = await client.getBlockNumber();
  const hiBlock = await client.getBlock({ blockNumber: hi });
  if (Number(hiBlock.timestamp) <= targetTs) return hi;
  while (lo < hi) {
    const mid = (lo + hi + 1n) / 2n;
    const b = await client.getBlock({ blockNumber: mid });
    if (Number(b.timestamp) <= targetTs) lo = mid;
    else hi = mid - 1n;
  }
  return lo;
}

async function main() {
  console.log("Resolving block range...");
  const latest = await client.getBlockNumber();
  const jul1Block = await blockForTimestamp(JUL_1_2026_UTC);
  console.log(`  Jul 1 2026 00:00 UTC -> block ${jul1Block}, latest -> block ${latest}\n`);

  // ---- 1: enumerate Delulu users via subgraph ----
  console.log("Fetching all Delulu users from subgraph...");
  const rawUsers = await paginateAll<{ id: string; username: string | null }>("users", "id username");
  const allDeluluUsers = rawUsers.filter((u) => u.username && u.username.trim().length > 0).map((u) => u.id.toLowerCase());
  console.log(`  Total unique Delulu users (all-time, username set): ${fmt(allDeluluUsers.length)}\n`);

  // ---- exact signup check per user: was addressToUsername already set AT jul1Block? ----
  // This reads the actual on-chain state at the exact historical block (plain eth_call,
  // no range restriction) — precise, not a proxy off other activity.
  console.log(`Checking exact signup timing (addressToUsername @ block ${jul1Block}) for ${fmt(allDeluluUsers.length)} users...`);
  const newUsersSinceJul1: string[] = [];
  let dateChecked = 0;
  await mapLimit(allDeluluUsers, 20, async (user) => {
    const nameAtJul1 = await client.readContract({
      address: DELULU,
      abi: DELULU_ABI,
      functionName: "addressToUsername",
      args: [user as `0x${string}`],
      blockNumber: jul1Block,
    });
    if (!nameAtJul1 || nameAtJul1.trim().length === 0) newUsersSinceJul1.push(user);
    dateChecked++;
    if (dateChecked % 100 === 0 || dateChecked === allDeluluUsers.length) {
      process.stdout.write(`\r  ${dateChecked}/${allDeluluUsers.length} users checked`);
    }
  });
  console.log(`\n  New users since Jul 1 2026 (exact, on-chain): ${fmt(newUsersSinceJul1.length)}\n`);

  // ---- 2: face verification since Jul 1, per known Delulu user (plain eth_call) ----
  console.log(`Reading GoodDollar verification status for ${fmt(allDeluluUsers.length)} known Delulu users...`);
  const verifiedSinceJul1 = new Map<string, number>();
  let checked = 0;
  await mapLimit(allDeluluUsers, 5, async (user) => {
    const id = await client.readContract({
      address: IDENTITY,
      abi: IDENTITY_ABI,
      functionName: "identities",
      args: [user as `0x${string}`],
    });
    const dateAuthenticated = Number(id[0]);
    if (dateAuthenticated >= JUL_1_2026_UTC) verifiedSinceJul1.set(user, dateAuthenticated);
    checked++;
    if (checked % 100 === 0 || checked === allDeluluUsers.length) {
      process.stdout.write(`\r  ${checked}/${allDeluluUsers.length} users checked`);
    }
  });
  console.log(`\n  Delulu users verified since Jul 1: ${fmt(verifiedSinceJul1.size)}\n`);

  // ---- activation: G$ transfer within 24h of verification, for verified users ----
  console.log(`Checking G$ activity around verification for ${fmt(verifiedSinceJul1.size)} verified users...`);
  const verifiedUsers = [...verifiedSinceJul1.keys()];
  let activatedUsers = 0;
  let vChecked = 0;
  await mapLimit(verifiedUsers, 5, async (user) => {
    const authTs = verifiedSinceJul1.get(user)!;
    const txs = await gdTransfers(user as `0x${string}`, jul1Block);
    const activated = txs.some((tx) => Math.abs(tx.ts - authTs) <= DAY);
    if (activated) activatedUsers++;
    vChecked++;
    if (vChecked % 20 === 0 || vChecked === verifiedUsers.length) {
      process.stdout.write(`\r  ${vChecked}/${verifiedUsers.length} verified users checked`);
    }
  });
  console.log(`\n  Unique activated users (verified + G$ move within 24h): ${fmt(activatedUsers)}\n`);

  // ---- 3: G$ circulation through app contracts since Jul 1 ----
  console.log("Fetching G$ transfers touching each app contract since Jul 1...");
  const seen = new Set<string>();
  let circulationRaw = 0n;
  let totalTransfers = 0;
  for (const contract of APP_CONTRACTS) {
    const txs = await gdTransfers(contract, jul1Block);
    for (const tx of txs) {
      const key = `${tx.hash}:${tx.from}:${tx.to}:${tx.value.toString()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      circulationRaw += tx.value;
      totalTransfers++;
    }
  }
  const circulation = parseFloat(formatUnits(circulationRaw, 18));
  console.log(`  G$ moved in+out of app contracts since Jul 1 2026: ${fmt(Math.round(circulation))} G$ (${fmt(totalTransfers)} transfers)\n`);

  console.log("========== SUMMARY (Jul 1 2026 -> now, pulled live from Celo mainnet) ==========");
  console.log(`New users since Jul 1:               ${fmt(newUsersSinceJul1.length)}`);
  console.log(`Unique activated users:               ${fmt(activatedUsers)}`);
  console.log(`G$ in circulation (app contracts):    ${fmt(Math.round(circulation))} G$`);
  console.log("==================================================================================");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
