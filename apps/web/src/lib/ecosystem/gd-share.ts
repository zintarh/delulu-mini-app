// G$ ecosystem share: how much of the G$ moving on Celo each GoodBuilders
// project handled, per Lagos day. Server only.
//
// computeDay reads every G$ Transfer on Celo for the day (public RPC, 5,000
// blocks per call, about a minute), then for each project sums the G$ that
// came into its contracts from outside and went out of them to outside —
// moves between a project's own contracts don't count — plus the
// transactions and the wallets on the other side. Results go to
// gd_share_days / gd_share_network (docs/migrations/20261124_gd_share.sql).

import { createPublicClient, formatUnits, http, parseAbiItem } from "viem";
import { celo } from "viem/chains";
import type { getSupabaseAdmin } from "@/lib/push/supabase";

type Admin = NonNullable<ReturnType<typeof getSupabaseAdmin>>;

const G_DOLLAR = "0x62B8B11039FcfE5aB0C56E502b1C372A3d2a9c7A" as const;
const TRANSFER = parseAbiItem("event Transfer(address indexed from, address indexed to, uint256 value)");
const STEP = 5_000n;
const DAY_S = 86_400n;

export type ShareProject = { name: string; addresses: string[]; isUs: boolean; active: boolean; sort: number };
export type ProjectDay = { project: string; gIn: number; gOut: number; volume: number; txs: number; wallets: number };
export type NetworkDay = { day: string; totalG: number; transfers: number; fromBlock: number; toBlock: number; complete: boolean; computedAt: string };

const client = () =>
  createPublicClient({ chain: celo, transport: http(process.env.GD_SHARE_RPC || "https://forno.celo.org", { retryCount: 5, retryDelay: 800 }) });

/** Today as a Lagos (WAT, UTC+1) calendar date. */
export const lagosToday = (ms = Date.now()) => new Date(ms + 3_600_000).toISOString().slice(0, 10);
export const addDays = (day: string, n: number) => new Date(Date.parse(`${day}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const dayStart = (day: string) => BigInt(Date.parse(`${day}T00:00:00+01:00`) / 1000);

/** First block at or after `unix`. Celo makes about a block a second, so start from a guess and narrow. */
async function blockAt(c: ReturnType<typeof client>, unix: bigint, latest: bigint, latestTs: bigint): Promise<bigint> {
  if (unix >= latestTs) return latest + 1n;
  const guess = latest - (latestTs - unix);
  let lo = guess > 20_000n ? guess - 20_000n : 0n;
  let hi = guess + 20_000n > latest ? latest : guess + 20_000n;
  // Widen if the guess window doesn't hold it.
  if ((await c.getBlock({ blockNumber: lo })).timestamp > unix) lo = 0n;
  if ((await c.getBlock({ blockNumber: hi })).timestamp < unix) hi = latest;
  while (lo < hi) {
    const mid = (lo + hi) / 2n;
    if ((await c.getBlock({ blockNumber: mid })).timestamp < unix) lo = mid + 1n;
    else hi = mid;
  }
  return lo;
}

/** One Lagos day, every project. Throws if the day hasn't started. */
export async function computeDay(day: string, projects: ShareProject[]): Promise<{ network: NetworkDay; rows: ProjectDay[] }> {
  const c = client();
  const latestBlock = await c.getBlock();
  const latest = latestBlock.number;
  const start = dayStart(day);
  const end = start + DAY_S;
  if (start > latestBlock.timestamp) throw new Error(`${day} hasn't started yet`);
  const [from, to] = await Promise.all([blockAt(c, start, latest, latestBlock.timestamp), blockAt(c, end, latest, latestBlock.timestamp)]);
  const complete = to <= latest;
  const toBlock = (complete ? to : latest + 1n) - 1n;

  const owner = new Map<string, string>();
  for (const p of projects) for (const a of p.addresses) owner.set(a.toLowerCase(), p.name);
  const acc = new Map(projects.map((p) => [p.name, { inW: 0n, outW: 0n, txs: new Set<string>(), wallets: new Set<string>() }]));
  let total = 0n;
  let transfers = 0;

  for (let f = from; f <= toBlock; f += STEP) {
    const t = f + STEP - 1n > toBlock ? toBlock : f + STEP - 1n;
    const logs = await c.getLogs({ address: G_DOLLAR, event: TRANSFER, fromBlock: f, toBlock: t });
    for (const l of logs) {
      const a = l.args.from!.toLowerCase();
      const b = l.args.to!.toLowerCase();
      const v = l.args.value!;
      total += v;
      transfers++;
      const pa = owner.get(a);
      const pb = owner.get(b);
      if (pa && pa === pb) continue; // inside one project: not G$ moving through it
      if (pa) { const x = acc.get(pa)!; x.outW += v; x.txs.add(l.transactionHash!); x.wallets.add(b); }
      if (pb) { const x = acc.get(pb)!; x.inW += v; x.txs.add(l.transactionHash!); x.wallets.add(a); }
    }
  }

  const g = (w: bigint) => Number(formatUnits(w, 18));
  return {
    network: { day, totalG: g(total), transfers, fromBlock: Number(from), toBlock: Number(toBlock), complete, computedAt: new Date().toISOString() },
    rows: projects.map((p) => {
      const x = acc.get(p.name)!;
      return { project: p.name, gIn: g(x.inW), gOut: g(x.outW), volume: g(x.inW + x.outW), txs: x.txs.size, wallets: x.wallets.size };
    }),
  };
}

// ── Storage ─────────────────────────────────────────────────────────────────

export async function loadProjects(admin: Admin): Promise<ShareProject[]> {
  const { data, error } = await admin.from("gd_share_projects").select("name, addresses, is_us, active, sort").order("sort");
  if (error) throw new Error(/gd_share/.test(error.message) ? `${error.message} — run docs/migrations/20261124_gd_share.sql` : error.message);
  return (data ?? []).map((p) => ({ name: p.name, addresses: p.addresses ?? [], isUs: !!p.is_us, active: !!p.active, sort: Number(p.sort) }));
}

export async function saveDay(admin: Admin, result: Awaited<ReturnType<typeof computeDay>>) {
  const { network: n, rows } = result;
  const { error: e1 } = await admin.from("gd_share_network").upsert({
    day: n.day, total_g: n.totalG, transfers: n.transfers, from_block: n.fromBlock, to_block: n.toBlock, complete: n.complete, computed_at: n.computedAt,
  }, { onConflict: "day" });
  if (e1) throw new Error(e1.message);
  // Replace the day's rows, so a project removed from the list drops out too.
  const { error: e2 } = await admin.from("gd_share_days").delete().eq("day", n.day);
  if (e2) throw new Error(e2.message);
  if (rows.length) {
    const { error: e3 } = await admin.from("gd_share_days").insert(rows.map((r) => ({
      day: n.day, project: r.project, g_in: r.gIn, g_out: r.gOut, volume: r.volume, txs: r.txs, wallets: r.wallets,
    })));
    if (e3) throw new Error(e3.message);
  }
}

/** Compute and store one day for the active projects. */
export async function refreshDay(admin: Admin, day: string) {
  const projects = (await loadProjects(admin)).filter((p) => p.active && p.addresses.length > 0);
  const result = await computeDay(day, projects);
  await saveDay(admin, result);
  return result.network;
}

export type EcosystemReport = {
  projects: ShareProject[];
  days: Array<NetworkDay & { rows: ProjectDay[] }>;
  missing: string[];
  from: string;
  to: string;
};

/** Stored days from `from` to `to` (inclusive), plus which of them are missing or still partial. */
export async function loadReport(admin: Admin, from: string, to: string): Promise<EcosystemReport> {
  const [projects, net, rows] = await Promise.all([
    loadProjects(admin),
    admin.from("gd_share_network").select("*").gte("day", from).lte("day", to).order("day"),
    admin.from("gd_share_days").select("*").gte("day", from).lte("day", to).limit(20_000),
  ]);
  if (net.error) throw new Error(net.error.message);
  const byDay = new Map<string, ProjectDay[]>();
  for (const r of rows.data ?? []) {
    const list = byDay.get(String(r.day)) ?? [];
    list.push({ project: r.project, gIn: Number(r.g_in), gOut: Number(r.g_out), volume: Number(r.volume), txs: Number(r.txs), wallets: Number(r.wallets) });
    byDay.set(String(r.day), list);
  }
  const days = (net.data ?? []).map((n) => ({
    day: String(n.day), totalG: Number(n.total_g), transfers: Number(n.transfers), fromBlock: Number(n.from_block), toBlock: Number(n.to_block),
    complete: !!n.complete, computedAt: String(n.computed_at), rows: byDay.get(String(n.day)) ?? [],
  }));
  const have = new Set(days.filter((d) => d.complete).map((d) => d.day));
  const missing: string[] = [];
  for (let d = from; d <= to && d <= lagosToday(); d = addDays(d, 1)) if (!have.has(d)) missing.push(d);
  return { projects, days, missing, from, to };
}
