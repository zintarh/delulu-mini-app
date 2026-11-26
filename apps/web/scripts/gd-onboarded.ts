/**
 * Delulu's users the way GoodDollar counts them, straight from Celo.
 *
 * GoodDollar's onboarding rule: "user interacted with a builder contract within
 * 24h after getting whitelisted". So for every wallet that SIGNED a transaction
 * that touched one of Delulu's contracts this season (our server wallet excluded —
 * GoodDollar credits the signer), we read its GoodDollar Identity record:
 *   - onboarded = whitelisted (dateAdded) during the season AND signed a Delulu
 *     transaction within 24h after that
 *   - active    = signed at least one Delulu transaction (verified or not)
 *
 * Run (from apps/web):  npx tsx scripts/gd-onboarded.ts [--from 2026-11-17] [--out file.json]
 */
import { writeFileSync } from "fs";
import { createPublicClient, http, parseAbi, type Address } from "viem";
import { celo } from "viem/chains";

const arg = (k: string) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : undefined; };
const SEASON_START = Date.parse(`${arg("--from") ?? "2026-11-17"}T00:00:00Z`) / 1000;
const OUT = arg("--out");

const CONTRACTS = {
  Delulu: "0x7692199630F3865160fB1Fa496961251fA15aFEa",
  CommunityMarket: "0xE652E0cA7DACb6489928C6801D83356a016DcfE1",
  RewardVault: "0xFE5a411b47F88198038EcE3177C19Ea043398c02",
  ForfeitMarket: "0x5548eC3Aa02dCbcE85Cdc6Ad37d61613019D92f8",
} as const;
const SERVER = "0x9d8a7a866af0eee89b45abbb4f1bc9c3698b33e4";
const IDENTITY = "0xC361A6E67822a0EDc17D899227dd9FC50BD62F42" as const;
const IDENTITY_ABI = parseAbi([
  "function identities(address) view returns (uint256 dateAuthenticated, uint256 dateAdded, string did, uint256 whitelistedOnChainId, uint8 status, uint32 authCount)",
]);

const client = createPublicClient({ chain: celo, transport: http("https://forno.celo.org", { retryCount: 8, retryDelay: 1200, batch: { batchSize: 40 } }) });
const lagosDay = (sec: number) => new Date(sec * 1000 + 3_600_000).toISOString().slice(0, 10);

async function pool<T>(items: T[], n: number, fn: (t: T) => Promise<void>) {
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) await fn(items[i++]); }));
}

(async () => {
  const latest = await client.getBlock();
  const now = Number(latest.timestamp);
  // Celo L2 makes one block a second, so block -> time is exact enough for a 24h window.
  const timeOf = (b: bigint) => now - Number(latest.number - b);
  const fromBlock = latest.number - BigInt(now - SEASON_START);

  // 1. Every transaction that made one of our contracts emit an event.
  const txBlock = new Map<`0x${string}`, bigint>();
  const ranges: [bigint, bigint][] = [];
  for (let f = fromBlock; f <= latest.number; f += 5000n) ranges.push([f, f + 4999n > latest.number ? latest.number : f + 4999n]);
  let done = 0;
  await pool(ranges, 4, async ([f, t]) => {
    const logs = await client.getLogs({ address: Object.values(CONTRACTS) as Address[], fromBlock: f, toBlock: t });
    for (const l of logs) txBlock.set(l.transactionHash!, l.blockNumber!);
    if (++done % 20 === 0) console.error(`logs ${done}/${ranges.length}`);
  });
  console.error(`${txBlock.size} transactions; reading signers…`);

  // 2. Who signed each one.
  const byWallet = new Map<string, number[]>();
  let serverTx = 0;
  done = 0;
  await pool([...txBlock], 10, async ([hash, block]) => {
    const tx = await client.getTransaction({ hash });
    const from = tx.from.toLowerCase();
    if (from === SERVER) serverTx++;
    else (byWallet.get(from) ?? byWallet.set(from, []).get(from)!).push(timeOf(block));
    if (++done % 1000 === 0) console.error(`txs ${done}/${txBlock.size}`);
  });

  // 3. GoodDollar Identity record of every signer.
  const wallets = [...byWallet.keys()];
  const ident = new Map<string, { added: number; auth: number }>();
  for (let i = 0; i < wallets.length; i += 150) {
    const slice = wallets.slice(i, i + 150);
    const rows = await client.multicall({
      contracts: slice.map((w) => ({ address: IDENTITY, abi: IDENTITY_ABI, functionName: "identities" as const, args: [w as Address] })),
      allowFailure: true,
    });
    rows.forEach((r, k) => {
      if (r.status === "success") ident.set(slice[k], { auth: Number(r.result[0]), added: Number(r.result[1]) });
    });
  }

  // 4. Apply the rule.
  const onboarded: { wallet: string; whitelisted: string; firstTxAfter: string }[] = [];
  const onboardedByDay: Record<string, number> = {};
  const activeByDay: Record<string, Set<string>> = {};
  let verifiedActive = 0, whitelistedInSeason = 0, lateFirstTx = 0;
  for (const [w, times] of byWallet) {
    for (const t of times) (activeByDay[lagosDay(t)] ??= new Set()).add(w);
    const id = ident.get(w);
    if (!id || id.added === 0) continue;
    verifiedActive++;
    if (id.added < SEASON_START) continue;
    whitelistedInSeason++;
    const hit = times.filter((t) => t >= id.added && t <= id.added + 86_400).sort((a, b) => a - b)[0];
    if (hit === undefined) { lateFirstTx++; continue; }
    onboarded.push({ wallet: w, whitelisted: new Date(id.added * 1000).toISOString(), firstTxAfter: new Date(hit * 1000).toISOString() });
    const d = lagosDay(id.added);
    onboardedByDay[d] = (onboardedByDay[d] ?? 0) + 1;
  }

  const result = {
    season: { from: new Date(SEASON_START * 1000).toISOString(), to: new Date(now * 1000).toISOString() },
    deluluTransactions: txBlock.size,
    signedByServer: serverTx,
    signedByPlayers: txBlock.size - serverTx,
    activeWallets: byWallet.size,
    activeAndEverVerified: verifiedActive,
    whitelistedThisSeason: whitelistedInSeason,
    onboarded: onboarded.length,
    whitelistedButNoTxWithin24h: lateFirstTx,
    onboardedByWhitelistDay: Object.fromEntries(Object.entries(onboardedByDay).sort()),
    activeWalletsByDay: Object.fromEntries(Object.entries(activeByDay).sort().map(([d, s]) => [d, s.size])),
  };
  console.log(JSON.stringify(result, null, 2));
  if (OUT) writeFileSync(OUT, JSON.stringify({ ...result, onboardedWallets: onboarded }, null, 2));
})();
