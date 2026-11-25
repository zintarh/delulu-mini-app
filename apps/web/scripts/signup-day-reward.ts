/**
 * Send a sign-up reward from Delulu's RewardVault to everyone who signed up on a day.
 *
 * Each person gets `--amount` G$ (default 10) credited from the vault's own
 * pre-funded pool (RewardVault.creditReward) — it comes from our contract, not
 * a wallet, and shows in their app as a reward to claim. One reward per person
 * per day: the on-chain rewardId is keccak256("signup-reward:<day>:<wallet>"),
 * so running this twice never pays anyone twice.
 *
 * Usage (from apps/web):
 *   npx tsx --env-file=.env.local scripts/signup-day-reward.ts                 # dry run: today (Lagos), 10 G$
 *   npx tsx --env-file=.env.local scripts/signup-day-reward.ts --send          # actually send
 *   npx tsx --env-file=.env.local scripts/signup-day-reward.ts --day 2026-11-24 --amount 10 --send
 *
 * Signs with CELO_FAUCET_PRIVATE_KEY (the vault's rewarder; it only pays gas).
 */
import { createPublicClient, createWalletClient, formatUnits, http, keccak256, parseUnits, toHex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { celo } from "viem/chains";
import { getSupabaseAdmin } from "@/lib/push/supabase";
import { REWARD_VAULT_ABI } from "@/lib/abi/reward-vault";
import { CELO_MAINNET_ID, GOODDOLLAR_ADDRESSES, getRewardVaultAddress, isLeaderboardBlacklisted } from "@/lib/constant";

const argv = process.argv.slice(2);
const flag = (n: string) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
const send = argv.includes("--send");
const day = flag("--day") ?? new Date(Date.now() + 3_600_000).toISOString().slice(0, 10); // Lagos today
const amount = Number(flag("--amount") ?? 10);
if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error(`--day must be YYYY-MM-DD, got ${day}`);
if (!(amount > 0 && amount <= 10_000)) throw new Error("--amount must be between 0 and 10,000 G$");

const G = GOODDOLLAR_ADDRESSES.mainnet as `0x${string}`;
const VAULT = getRewardVaultAddress(CELO_MAINNET_ID);
const rpc = process.env.SIGNUP_REWARD_RPC || "https://forno.celo.org";
const rewardIdFor = (wallet: string) => keccak256(toHex(`signup-reward:${day}:${wallet.toLowerCase()}`));

(async () => {
  const admin = getSupabaseAdmin();
  if (!admin) throw new Error("Supabase isn't configured (.env.local)");
  const pub = createPublicClient({ chain: celo, transport: http(rpc, { retryCount: 5, retryDelay: 800 }) });

  // Everyone whose account was created on that Lagos day (midnight to midnight, WAT).
  const from = new Date(`${day}T00:00:00+01:00`).toISOString();
  const to = new Date(Date.parse(`${day}T00:00:00+01:00`) + 86_400_000).toISOString();
  const { data, error } = await admin.from("profiles").select("address, username, created_at").gte("created_at", from).lt("created_at", to).order("created_at");
  if (error) throw new Error(error.message);
  const people = (data ?? [])
    .map((p) => ({ wallet: String(p.address).toLowerCase() as `0x${string}`, username: p.username as string | null }))
    .filter((p) => /^0x[0-9a-f]{40}$/.test(p.wallet) && !isLeaderboardBlacklisted(p.wallet));

  const amountWei = parseUnits(String(amount), 18);
  const available = (await pub.readContract({ address: VAULT, abi: REWARD_VAULT_ABI, functionName: "availableBalance", args: [G] })) as bigint;
  const todo: typeof people = [];
  for (const p of people) {
    const used = (await pub.readContract({ address: VAULT, abi: REWARD_VAULT_ABI, functionName: "usedRewardId", args: [rewardIdFor(p.wallet)] })) as boolean;
    if (!used) todo.push(p);
  }
  const total = amountWei * BigInt(todo.length);

  console.log(`Sign-ups on ${day} (Lagos): ${people.length} · already rewarded: ${people.length - todo.length} · to reward now: ${todo.length}`);
  console.log(`${amount} G$ each = ${formatUnits(total, 18)} G$ from the RewardVault pool (available: ${Number(formatUnits(available, 18)).toLocaleString()} G$)`);
  for (const p of todo) console.log(`  ${p.wallet}  ${p.username ? "@" + p.username : ""}`);
  if (total > available) throw new Error("The vault pool doesn't hold enough G$ for this. Top it up or lower --amount.");

  if (!send) {
    console.log("\nDry run: nothing sent. Add --send to credit these rewards.");
    return;
  }

  const raw = process.env.CELO_FAUCET_PRIVATE_KEY;
  if (!raw) throw new Error("CELO_FAUCET_PRIVATE_KEY isn't set");
  const account = privateKeyToAccount((raw.startsWith("0x") ? raw : `0x${raw}`) as `0x${string}`);
  const wallet = createWalletClient({ account, chain: celo, transport: http(rpc) });
  let ok = 0;
  let failed = 0;
  for (const p of todo) {
    try {
      const hash = await wallet.writeContract({ address: VAULT, abi: REWARD_VAULT_ABI, functionName: "creditReward", args: [p.wallet, G, amountWei, rewardIdFor(p.wallet)] });
      const r = await pub.waitForTransactionReceipt({ hash, timeout: 90_000 });
      if (r.status !== "success") throw new Error(`reverted ${hash}`);
      ok++;
      console.log(`  ✓ ${p.wallet} ${hash}`);
    } catch (e) {
      failed++;
      console.log(`  ✗ ${p.wallet} ${e instanceof Error ? e.message.split("\n")[0] : e}`);
    }
  }
  console.log(`\nDone: ${ok} rewarded, ${failed} failed. Rerun to retry failures; it never pays anyone twice.`);
})().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
