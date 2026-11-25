// The partner page's "straight from the blockchain" numbers. Server only.
//
// Everything here except sign-ups is read from Celo itself, so the partner can
// check it: transaction counts (has the wallet ever sent a transaction), G$
// transfers between their friends and Delulu's contracts (who staked, who used
// Delulu on-chain), GoodDollar's Identity contract (face-verified), and proof
// points from Delulu's subgraph (an index of Delulu's own contract events).
// Sign-ups come from Delulu's database: a sign-up is an account, not a transaction.

import { createPublicClient, formatUnits, http, parseAbiItem } from "viem";
import { celo } from "viem/chains";
import type { getSupabaseAdmin } from "@/lib/push/supabase";
import { everVerifiedWallets } from "@/lib/referral/verify-identity";
import { totalProofPointsBulk } from "@/lib/community/campaign-subgraph";
import type { Partner } from "@/lib/referral/partners";

type Admin = NonNullable<ReturnType<typeof getSupabaseAdmin>>;

const G = "0x62B8B11039FcfE5aB0C56E502b1C372A3d2a9c7A" as const;
const TRANSFER = parseAbiItem("event Transfer(address indexed from, address indexed to, uint256 value)");
/** Delulu's contracts on Celo. Stakes go into the two markets; rewards are claimed from the vault. */
export const DELULU_CONTRACTS = {
  delulu: "0x7692199630F3865160fB1Fa496961251fA15aFEa",
  campaigns: "0xE652E0cA7DACb6489928C6801D83356a016DcfE1",
  rewardVault: "0xFE5a411b47F88198038EcE3177C19Ea043398c02",
  forfeitMarket: "0x5548eC3Aa02dCbcE85Cdc6Ad37d61613019D92f8",
} as const;
const STAKE_CONTRACTS = new Set([DELULU_CONTRACTS.campaigns, DELULU_CONTRACTS.forfeitMarket].map((a) => a.toLowerCase()));
const ALL = Object.values(DELULU_CONTRACTS) as `0x${string}`[];
const ALL_LOWER = new Set(ALL.map((a) => a.toLowerCase()));
/** At most this far back for the transfer scan (keeps the page fast). */
const MAX_SCAN_DAYS = 14;

export type OnchainFunnel = {
  signedUp: number;
  onChain: number;
  verified: number;
  usedContracts: number;
  staked: number;
  stakedG: number;
  earnedPoints: number;
};

export type PartnerOnchain = {
  today: OnchainFunnel;
  allTime: OnchainFunnel;
  todayLabel: string;
  scannedFrom: string;
  contracts: typeof DELULU_CONTRACTS;
  generatedAt: string;
};

const lagosDay = (ms: number) => new Date(ms + 3_600_000).toISOString().slice(0, 10);
const cache = new Map<string, { at: number; data: PartnerOnchain }>();

export async function buildPartnerOnchain(admin: Admin, partner: Partner): Promise<PartnerOnchain> {
  const hit = cache.get(partner.code);
  if (hit && Date.now() - hit.at < 5 * 60_000) return hit.data;

  const today = lagosDay(Date.now());
  const empty: OnchainFunnel = { signedUp: 0, onChain: 0, verified: 0, usedContracts: 0, staked: 0, stakedG: 0, earnedPoints: 0 };
  const base: PartnerOnchain = { today: { ...empty }, allTime: { ...empty }, todayLabel: today, scannedFrom: new Date().toISOString(), contracts: DELULU_CONTRACTS, generatedAt: new Date().toISOString() };
  if (!partner.ownerWallet) return base;

  const { data: profiles, error } = await admin
    .from("profiles")
    .select("address, created_at")
    .eq("referred_by", partner.ownerWallet.toLowerCase())
    .limit(5_000);
  if (error) throw new Error(error.message);
  const people = (profiles ?? []).map((p) => ({ wallet: String(p.address).toLowerCase(), day: lagosDay(Date.parse(String(p.created_at))), at: Date.parse(String(p.created_at)) }));
  if (people.length === 0) return base;
  const wallets = people.map((p) => p.wallet);
  const friendSet = new Set(wallets);

  const client = createPublicClient({ chain: celo, transport: http("https://forno.celo.org", { retryCount: 5, retryDelay: 800, batch: { batchSize: 50 } }) });

  // 1. Has the wallet ever sent a transaction on Celo (its nonce)?
  const nonces = new Map<string, number>();
  let i = 0;
  await Promise.all(Array.from({ length: 6 }, async () => {
    while (i < wallets.length) {
      const w = wallets[i++];
      nonces.set(w, await client.getTransactionCount({ address: w as `0x${string}` }).catch(() => 0));
    }
  }));

  // 2. G$ moving between these friends and Delulu's contracts, since the first sign-up (max 14 days back).
  const latest = await client.getBlock();
  const sinceMs = Math.max(Math.min(...people.map((p) => p.at)), Date.now() - MAX_SCAN_DAYS * 86_400_000);
  const fromBlock = latest.number - (latest.timestamp - BigInt(Math.floor(sinceMs / 1000))) - 600n; // Celo: ~1 block a second; a 10-minute margin
  const used = new Set<string>();
  const stakedG = new Map<string, bigint>();
  for (let f = fromBlock; f <= latest.number; f += 5000n) {
    const t = f + 4999n > latest.number ? latest.number : f + 4999n;
    const [into, outOf] = await Promise.all([
      client.getLogs({ address: G, event: TRANSFER, args: { to: ALL }, fromBlock: f, toBlock: t }),
      client.getLogs({ address: G, event: TRANSFER, args: { from: ALL }, fromBlock: f, toBlock: t }),
    ]);
    for (const l of into) {
      const from = l.args.from!.toLowerCase();
      if (!friendSet.has(from)) continue;
      used.add(from);
      if (STAKE_CONTRACTS.has(l.args.to!.toLowerCase())) stakedG.set(from, (stakedG.get(from) ?? 0n) + l.args.value!);
    }
    for (const l of outOf) {
      const to = l.args.to!.toLowerCase();
      if (friendSet.has(to) && !ALL_LOWER.has(to)) used.add(to);
    }
  }

  // 3. Face-verified (GoodDollar Identity contract) and 4. proof points (Delulu's subgraph).
  const [verified, points] = await Promise.all([everVerifiedWallets(wallets), totalProofPointsBulk(wallets).catch(() => new Map<string, number>())]);

  const funnel = (list: typeof people): OnchainFunnel => ({
    signedUp: list.length,
    onChain: list.filter((p) => (nonces.get(p.wallet) ?? 0) > 0).length,
    verified: list.filter((p) => verified.has(p.wallet)).length,
    usedContracts: list.filter((p) => used.has(p.wallet)).length,
    staked: list.filter((p) => (stakedG.get(p.wallet) ?? 0n) > 0n).length,
    stakedG: Math.round(list.reduce((n, p) => n + Number(formatUnits(stakedG.get(p.wallet) ?? 0n, 18)), 0)),
    earnedPoints: list.filter((p) => (points.get(p.wallet) ?? 0) > 0).length,
  });

  const data: PartnerOnchain = {
    today: funnel(people.filter((p) => p.day === today)),
    allTime: funnel(people),
    todayLabel: today,
    scannedFrom: new Date(sinceMs).toISOString(),
    contracts: DELULU_CONTRACTS,
    generatedAt: new Date().toISOString(),
  };
  cache.set(partner.code, { at: Date.now(), data });
  return data;
}
