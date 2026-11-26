// Admin overview user counts, read from the Delulu contract instead of the
// database. A user = a wallet that saved its profile on chain (setProfile →
// ProfileUpdated). Server only; cached for 5 minutes.
//
//  - total:   users in Delulu's subgraph with a username (the subgraph indexes
//             ProfileUpdated straight off the contract)
//  - newSince: wallets whose ProfileUpdated event landed since `since`, read
//             from Celo itself. Someone renaming this week counts too (rare).

import { createPublicClient, http, parseAbiItem } from "viem";
import { celo } from "viem/chains";
import { DELULU_CONTRACT_ADDRESS, getSubgraphUrlForChain } from "@/lib/constant";

const PROFILE_UPDATED = parseAbiItem("event ProfileUpdated(address indexed user, string username)");
const client = createPublicClient({ chain: celo, transport: http("https://forno.celo.org", { retryCount: 4, retryDelay: 800 }) });

let cache: { key: string; at: number; data: OnchainUsers } | null = null;

export type OnchainUsers = { total: number; newSince: number; source: "contract" };

async function profileTotal(): Promise<number> {
  const url = getSubgraphUrlForChain();
  if (!url) throw new Error("Subgraph URL isn't set");
  let last = "0x";
  let total = 0;
  for (;;) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: `{ users(first: 1000, orderBy: id, where: { id_gt: "${last}", username_not: null }) { id username } }` }),
      cache: "no-store",
    });
    const json = (await res.json()) as { data?: { users: { id: string; username: string | null }[] }; errors?: unknown };
    if (!json.data) throw new Error(`Subgraph: ${JSON.stringify(json.errors ?? res.status)}`);
    const users = json.data.users;
    total += users.filter((u) => u.username).length;
    if (users.length < 1000) return total;
    last = users[users.length - 1].id;
  }
}

async function profilesSince(since: Date): Promise<number> {
  const latest = await client.getBlock();
  const secondsBack = latest.timestamp - BigInt(Math.floor(since.getTime() / 1000));
  if (secondsBack <= 0n) return 0;
  const from = latest.number - secondsBack - 60n; // Celo makes one block a second
  const ranges: [bigint, bigint][] = [];
  for (let f = from; f <= latest.number; f += 5000n) ranges.push([f, f + 4999n > latest.number ? latest.number : f + 4999n]);
  const wallets = new Set<string>();
  let i = 0;
  await Promise.all(Array.from({ length: 6 }, async () => {
    while (i < ranges.length) {
      const [f, t] = ranges[i++];
      const logs = await client.getLogs({ address: DELULU_CONTRACT_ADDRESS, event: PROFILE_UPDATED, fromBlock: f, toBlock: t });
      for (const l of logs) wallets.add(l.args.user!.toLowerCase());
    }
  }));
  return wallets.size;
}

export async function onchainUsers(since: Date): Promise<OnchainUsers> {
  const key = since.toISOString();
  if (cache && cache.key === key && Date.now() - cache.at < 5 * 60_000) return cache.data;
  const [total, newSince] = await Promise.all([profileTotal(), profilesSince(since)]);
  const data: OnchainUsers = { total, newSince, source: "contract" };
  cache = { key, at: Date.now(), data };
  return data;
}
