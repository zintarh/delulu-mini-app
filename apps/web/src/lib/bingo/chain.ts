import { createPublicClient, createWalletClient, formatEther, http, parseEventLogs, parseUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { celo } from "viem/chains";
import { COMMUNITY_CAMPAIGN_ABI } from "@/lib/abi/community-campaign";
import { DELULU_CHAIN_ID, GOODDOLLAR_ADDRESSES, getCommunityMarketV1Address } from "@/lib/constant";
import { DAY_MS } from "@/lib/bingo/types";

/**
 * The Bingo signer: a dedicated server key that is NOT the owner of any
 * contract. createCommunityChallenge is permissionless, and the creator of a
 * campaign may only configure that campaign (economics, milestones, end,
 * payout root ≤ its funded pool) — so a leaked key can't touch other
 * campaigns, withdraw pools or forfeits, or upgrade anything. It only needs
 * a little CELO for gas.
 */
function signer() {
  const raw = process.env.BINGO_SIGNER_PRIVATE_KEY;
  if (!raw) throw new Error("BINGO_SIGNER_PRIVATE_KEY is not configured");
  return privateKeyToAccount((raw.startsWith("0x") ? raw : `0x${raw}`) as `0x${string}`);
}

const rpc = () => process.env.NEXT_PUBLIC_CELO_RPC_URL ?? process.env.NEXT_PUBLIC_RPC_URL ?? "https://forno.celo.org";
const market = () => getCommunityMarketV1Address(DELULU_CHAIN_ID);

function clients() {
  const account = signer();
  const transport = http(rpc());
  return {
    account,
    pub: createPublicClient({ chain: celo, transport }),
    wallet: createWalletClient({ account, chain: celo, transport }),
  };
}

export async function bingoSignerStatus(): Promise<{ address: string; celo: string } | { error: string }> {
  try {
    const { account, pub } = clients();
    return { address: account.address, celo: formatEther(await pub.getBalance({ address: account.address })) };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

async function mined(hash: `0x${string}`) {
  const { pub } = clients();
  const receipt = await pub.waitForTransactionReceipt({ hash, confirmations: 1, timeout: 90_000 });
  if (receipt.status !== "success") throw new Error(`Transaction ${hash} reverted`);
  return receipt;
}

/** Sends createCommunityChallenge; `onSent` persists the hash before we wait, so a crash can't double-create. */
export async function sendCreateChallenge(
  contentHash: string,
  durationSeconds: number,
  onSent: (hash: `0x${string}`) => Promise<void>,
): Promise<{ hash: `0x${string}`; challengeId: number }> {
  const { wallet } = clients();
  const hash = await wallet.writeContract({
    address: market(),
    abi: COMMUNITY_CAMPAIGN_ABI,
    functionName: "createCommunityChallenge",
    args: [contentHash, BigInt(durationSeconds), BigInt(DAY_MS / 1000)],
  });
  await onSent(hash);
  return { hash, challengeId: await challengeIdFromCreateTx(hash) };
}

export async function challengeIdFromCreateTx(hash: `0x${string}`): Promise<number> {
  const receipt = await mined(hash);
  const log = parseEventLogs({ abi: COMMUNITY_CAMPAIGN_ABI, eventName: "CommunityChallengeCreated", logs: receipt.logs }).find(
    (l) => l.address.toLowerCase() === market().toLowerCase(),
  );
  const id = (log?.args as { campaignId?: bigint } | undefined)?.campaignId;
  if (id == null) throw new Error(`No CommunityChallengeCreated event in ${hash}`);
  return Number(id);
}

/** Read-only — no signer needed. */
function reader() {
  return createPublicClient({ chain: celo, transport: http(rpc()) });
}

export async function readMilestoneCompleted(challengeId: number, milestoneId: number, wallet: string): Promise<boolean> {
  return (await reader().readContract({
    address: market(),
    abi: COMMUNITY_CAMPAIGN_ABI,
    functionName: "milestoneCompleted",
    args: [BigInt(challengeId), BigInt(milestoneId), wallet as `0x${string}`],
  })) as boolean;
}

export async function readChallenge(challengeId: number) {
  const pub = reader();
  const [c, isPaid, milestoneCount] = await Promise.all([
    pub.readContract({ address: market(), abi: COMMUNITY_CAMPAIGN_ABI, functionName: "campaigns", args: [BigInt(challengeId)] }),
    pub.readContract({ address: market(), abi: COMMUNITY_CAMPAIGN_ABI, functionName: "campaignIsPaid", args: [BigInt(challengeId)] }),
    pub.readContract({ address: market(), abi: COMMUNITY_CAMPAIGN_ABI, functionName: "campaignMilestoneCount", args: [BigInt(challengeId)] }),
  ]);
  // campaigns(id) → (contentHash, poolAmount, startTime, duration, proofIntervalSeconds, active, ended, creator)
  const row = c as readonly [string, bigint, bigint, bigint, bigint, boolean, boolean, `0x${string}`];
  return {
    poolAmount: row[1],
    startTime: Number(row[2]),
    ended: row[6],
    creator: row[7].toLowerCase(),
    isPaid: isPaid as boolean,
    milestoneCount: Number(milestoneCount as bigint),
  };
}

export async function sendSetEconomics(challengeId: number, stake: number, forfeitPct: number) {
  const { wallet } = clients();
  const hash = await wallet.writeContract({
    address: market(),
    abi: COMMUNITY_CAMPAIGN_ABI,
    functionName: "setCommunityCampaignEconomics",
    args: [BigInt(challengeId), true, GOODDOLLAR_ADDRESSES.mainnet as `0x${string}`, parseUnits(String(stake), 18), forfeitPct],
  });
  await mined(hash);
  return hash;
}

/**
 * One milestone per day, with deadlines on the cycle's exact day boundaries
 * (midnight Lagos) however late the setup ran: the contract starts the first
 * window at the creation block, so day 1 is sized to end at `firstDayEndMs`.
 */
export async function sendAddDailyMilestones(challengeId: number, days: number, firstDayEndMs: number) {
  const { startTime } = await readChallenge(challengeId);
  const first = Math.floor(firstDayEndMs / 1000) - startTime;
  if (first <= 0) throw new Error("Day 1 already ended before the on-chain mission was created");
  const durations = Array.from({ length: days }, (_, i) => BigInt(i === 0 ? first : DAY_MS / 1000));
  const uris = Array.from({ length: days }, (_, i) => `Day ${i + 1}`);
  const { wallet } = clients();
  const hash = await wallet.writeContract({
    address: market(),
    abi: COMMUNITY_CAMPAIGN_ABI,
    functionName: "addCommunityCampaignMilestones",
    args: [BigInt(challengeId), uris, durations],
  });
  await mined(hash);
  return hash;
}

/** Milestones ending at the given absolute times (ms) — e.g. one window spanning a whole cycle. */
export async function sendAddWindowMilestones(challengeId: number, deadlinesMs: number[], labels: string[]) {
  const { startTime } = await readChallenge(challengeId);
  let prev = startTime;
  const durations = deadlinesMs.map((d) => {
    const end = Math.floor(d / 1000);
    if (end <= prev) throw new Error("Milestone window ends before it starts");
    const dur = BigInt(end - prev);
    prev = end;
    return dur;
  });
  const { wallet } = clients();
  const hash = await wallet.writeContract({
    address: market(),
    abi: COMMUNITY_CAMPAIGN_ABI,
    functionName: "addCommunityCampaignMilestones",
    args: [BigInt(challengeId), labels, durations],
  });
  await mined(hash);
  return hash;
}

export async function readJoined(challengeId: number, wallet: string): Promise<boolean> {
  return (await reader().readContract({
    address: market(),
    abi: COMMUNITY_CAMPAIGN_ABI,
    functionName: "campaignJoined",
    args: [BigInt(challengeId), wallet as `0x${string}`],
  })) as boolean;
}

export async function sendEndChallenge(challengeId: number) {
  const { wallet } = clients();
  const hash = await wallet.writeContract({
    address: market(),
    abi: COMMUNITY_CAMPAIGN_ABI,
    functionName: "endCommunityChallenge",
    args: [BigInt(challengeId)],
  });
  await mined(hash);
  return hash;
}
