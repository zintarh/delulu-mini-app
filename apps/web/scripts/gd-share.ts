/**
 * Which contract had the biggest share of GoodDollar (G$) on Celo in a day?
 *
 * For one Lagos calendar day (midnight to midnight, WAT), it reads every G$
 * Transfer on Celo and, for each contract you list, adds up:
 *   - G$ in, G$ out and volume (in + out)
 *   - share of listed = its volume / the listed contracts' combined volume
 *   - share of all G$ = its volume / all G$ moved on Celo that day
 *   - transactions touching it, and unique wallets on the other side
 * then ranks the contracts by volume. Contracts left out of the list still
 * count in the day's total, so the shares are of the whole network.
 *
 * Usage (from apps/web):
 *   npx tsx scripts/gd-share.ts                                   # yesterday, Delulu's contracts
 *   npx tsx scripts/gd-share.ts --day 2026-11-23
 *   npx tsx scripts/gd-share.ts --day 2026-11-23 GoodDrops=0xabc… Other=0xdef…
 *   npx tsx scripts/gd-share.ts --file scripts/gd-share.contracts.json --days 7
 *   npx tsx scripts/gd-share.ts --json                            # machine-readable output
 *
 * --file is a JSON object of { "Label": "0xaddress" }. Listing several
 * contracts under one app? Name them "App: part" (e.g. "Delulu: vault") and a
 * per-app total is printed too.
 *
 * RPC: forno.celo.org by default (public, 5,000-block log ranges), or
 * GD_SHARE_RPC=<url>. Read-only: it never signs or sends anything.
 */
import { readFileSync } from "fs";
import { createPublicClient, formatUnits, http, parseAbiItem, type Address } from "viem";
import { celo } from "viem/chains";

const G_DOLLAR = "0x62B8B11039FcfE5aB0C56E502b1C372A3d2a9c7A" as const;
const TRANSFER = parseAbiItem("event Transfer(address indexed from, address indexed to, uint256 value)");
const STEP = 5_000n;

const DELULU: Record<string, Address> = {
  "Delulu: Delulu": "0x7692199630F3865160fB1Fa496961251fA15aFEa",
  "Delulu: Forfeit market": "0x5548eC3Aa02dCbcE85Cdc6Ad37d61613019D92f8",
  "Delulu: Reward vault": "0xFE5a411b47F88198038EcE3177C19Ea043398c02",
  "Delulu: Campaigns/Bingo": "0xE652E0cA7DACb6489928C6801D83356a016DcfE1",
};

// ── Arguments ───────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const flag = (name: string) => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
};
const asJson = argv.includes("--json");
const lagosToday = new Date(Date.now() + 3_600_000).toISOString().slice(0, 10);
const yesterday = new Date(Date.parse(`${lagosToday}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
const firstDay = flag("--day") ?? yesterday;
const dayCount = Math.max(1, Math.min(31, Number(flag("--days") ?? 1) || 1));
if (!/^\d{4}-\d{2}-\d{2}$/.test(firstDay)) throw new Error(`--day must be YYYY-MM-DD, got ${firstDay}`);

let contracts: Record<string, Address> = {};
const file = flag("--file");
if (file) contracts = JSON.parse(readFileSync(file, "utf8"));
for (const a of argv) {
  const m = /^(.+)=(0x[0-9a-fA-F]{40})$/.exec(a);
  if (m) contracts[m[1]] = m[2] as Address;
}
if (Object.keys(contracts).length === 0) contracts = DELULU;
for (const [k, v] of Object.entries(contracts)) {
  if (!/^0x[0-9a-fA-F]{40}$/.test(v)) throw new Error(`Not an address for "${k}": ${v}`);
}

const client = createPublicClient({ chain: celo, transport: http(process.env.GD_SHARE_RPC || "https://forno.celo.org", { retryCount: 5, retryDelay: 800 }) });

// ── Helpers ─────────────────────────────────────────────────────────────────
/** First block at or after a unix time (binary search on timestamps). */
async function blockAt(unix: bigint, latest: bigint): Promise<bigint> {
  let lo = 0n;
  let hi = latest;
  while (lo < hi) {
    const mid = (lo + hi) / 2n;
    const b = await client.getBlock({ blockNumber: mid });
    if (b.timestamp < unix) lo = mid + 1n;
    else hi = mid;
  }
  return lo;
}

const g = (wei: bigint) => Number(formatUnits(wei, 18));
const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 0 });
const pct = (n: number) => `${(n * 100).toFixed(2)}%`;

type Row = { label: string; address: string; txs: number; wallets: number; gIn: number; gOut: number; volume: number; share: number; shareOfListed: number };

async function day(dayIso: string, latest: bigint) {
  const start = BigInt(Date.parse(`${dayIso}T00:00:00+01:00`) / 1000);
  const end = start + 86_400n;
  const [from, to] = await Promise.all([blockAt(start, latest), blockAt(end, latest)]);
  if (from >= latest) throw new Error(`${dayIso} hasn't happened yet`);
  const toBlock = (to > latest ? latest : to) - 1n;

  const watch = new Map(Object.entries(contracts).map(([label, a]) => [a.toLowerCase(), label]));
  const acc = new Map<string, { inW: bigint; outW: bigint; txs: Set<string>; wallets: Set<string> }>();
  for (const a of watch.keys()) acc.set(a, { inW: 0n, outW: 0n, txs: new Set(), wallets: new Set() });
  let total = 0n;
  let transfers = 0;

  for (let f = from; f <= toBlock; f += STEP) {
    const t = f + STEP - 1n > toBlock ? toBlock : f + STEP - 1n;
    const logs = await client.getLogs({ address: G_DOLLAR, event: TRANSFER, fromBlock: f, toBlock: t });
    for (const l of logs) {
      const fromA = l.args.from!.toLowerCase();
      const toA = l.args.to!.toLowerCase();
      const v = l.args.value!;
      total += v;
      transfers++;
      const out = acc.get(fromA);
      if (out) { out.outW += v; out.txs.add(l.transactionHash!); out.wallets.add(toA); }
      const inn = acc.get(toA);
      if (inn) { inn.inW += v; inn.txs.add(l.transactionHash!); inn.wallets.add(fromA); }
    }
    if (!asJson) process.stderr.write(`\r  ${dayIso}: block ${t - from + 1n}/${toBlock - from + 1n}`);
  }
  if (!asJson) process.stderr.write("\n");

  const totalG = g(total);
  const rows: Row[] = [...acc.entries()].map(([address, a]) => {
    const gIn = g(a.inW);
    const gOut = g(a.outW);
    return { label: watch.get(address)!, address, txs: a.txs.size, wallets: a.wallets.size, gIn, gOut, volume: gIn + gOut, share: totalG > 0 ? (gIn + gOut) / totalG : 0, shareOfListed: 0 };
  }).sort((x, y) => y.volume - x.volume);
  const listed = rows.reduce((n, r) => n + r.volume, 0);
  for (const r of rows) r.shareOfListed = listed > 0 ? r.volume / listed : 0;

  // Per app ("App: part" labels), summed.
  const apps = new Map<string, { volume: number; txs: number }>();
  for (const r of rows) {
    const app = r.label.includes(":") ? r.label.split(":")[0].trim() : r.label;
    const cur = apps.get(app) ?? { volume: 0, txs: 0 };
    apps.set(app, { volume: cur.volume + r.volume, txs: cur.txs + r.txs });
  }
  const appRows = [...apps.entries()]
    .map(([app, v]) => ({ app, ...v, share: totalG > 0 ? v.volume / totalG : 0, shareOfListed: listed > 0 ? v.volume / listed : 0 }))
    .sort((x, y) => y.volume - x.volume);

  return { day: dayIso, fromBlock: Number(from), toBlock: Number(toBlock), transfers, totalG, rows, apps: appRows };
}

function print(r: Awaited<ReturnType<typeof day>>) {
  console.log(`\n${r.day} (Lagos)  ·  ${fmt(r.totalG)} G$ moved on Celo in ${fmt(r.transfers)} transfers  ·  blocks ${r.fromBlock}–${r.toBlock}`);
  console.table(r.rows.map((x, i) => ({
    "#": i + 1, contract: x.label, "G$ in": fmt(x.gIn), "G$ out": fmt(x.gOut), volume: fmt(x.volume), "of listed": pct(x.shareOfListed), "of all G$": pct(x.share), txs: x.txs, wallets: x.wallets,
  })));
  if (r.apps.length < r.rows.length) {
    console.log("By app:");
    console.table(r.apps.map((a, i) => ({ "#": i + 1, app: a.app, volume: fmt(a.volume), "of listed": pct(a.shareOfListed), "of all G$": pct(a.share), txs: a.txs })));
  }
  const top = r.rows[0];
  if (top) console.log(`Top: ${top.label} · ${pct(top.shareOfListed)} of the listed contracts' G$ · ${pct(top.share)} of all G$ moved that day.`);
}

(async () => {
  const latest = await client.getBlockNumber();
  const results = [];
  for (let i = 0; i < dayCount; i++) {
    const d = new Date(Date.parse(`${firstDay}T00:00:00Z`) + i * 86_400_000).toISOString().slice(0, 10);
    if (d > lagosToday) break;
    const r = await day(d, latest);
    results.push(r);
    if (!asJson) print(r);
  }
  if (asJson) console.log(JSON.stringify(results, null, 2));
})().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
