/**
 * Gas sponsorship — pure rules (no I/O), unit-tested in rules.test.ts.
 *
 * New users get gas without the GoodDollar face check, in small drips tied to
 * real progress so a bot that never uses the app gets almost nothing:
 *
 *   signup   no profile on-chain yet → enough for the profile transaction
 *   starter  profile exists on-chain → enough for a first goal and proofs
 *   active   recent approved proofs  → a top-up, limited per rolling window
 *
 * Every drip is priced live: the step's gas units × the network's current
 * max fee × a safety margin, minus what the wallet already holds. Celo fees
 * move, so fixed amounts would either strand users or overpay bots.
 */

export type FaucetStage = "signup" | "starter" | "active";

export type StageConfig = {
  /** Gas the step's transactions need in total (generous; wallets add their own buffer). */
  gasUnits: number;
  /** Most one drip may send. If live fees need more, nothing is sent (a spike shouldn't drain the faucet). */
  maxPerDripCelo: number;
  /** Most this step may send one wallet, summed over all its drips (lifetime; `active`: per window). */
  capCelo: number;
};

export type FaucetConfig = {
  /** Kill switch. */
  enabled: boolean;
  /** Multiplies the live gas cost, so a fee rise between our send and the user's tx still fits. */
  gasMargin: number;
  stages: {
    signup: StageConfig;
    starter: StageConfig;
    active: StageConfig & {
      /** `capCelo` applies per this many days. */
      windowDays: number;
      /** Approved proofs needed within `proofWindowDays` to qualify. */
      minProofs: number;
      proofWindowDays: number;
    };
  };
  limits: {
    /** All drips together, rolling 24h. */
    dailyBudgetCelo: number;
    /** Different wallets funded at signup from one IP / network range, rolling 24h. */
    signupsPerIpPerDay: number;
    signupsPerSubnetPerDay: number;
    /** Faucet keeps at least this much, so it can still pay its own gas. */
    minReserveCelo: number;
  };
  /** Require a Turnstile captcha for signup drips (only enforced when TURNSTILE_SECRET_KEY is set). */
  requireCaptcha: boolean;
};

/**
 * Calibrated on Celo mainnet (Nov 2026): base fee 200 gwei, so a wallet sets
 * max fee ≈ 240–400 gwei. Measured gas: setProfile ≈ 76k, createCommitment
 * (word pledge) ≈ 167k; staking adds an approve (~50k), proofs and resolves
 * ~50–80k each. Units below are ~1.5× those so wallet padding still fits, and
 * the 2× margin covers wallets that set max fee to 2× base fee. At today's
 * fees: signup ≈ 0.06 CELO, starter/active ≈ 0.29 CELO per empty wallet.
 * "Most per drip" leaves ~2.5× headroom for fee spikes before refusing.
 */
export const DEFAULT_FAUCET_CONFIG: FaucetConfig = {
  enabled: true,
  gasMargin: 2,
  stages: {
    // Profile tx only.
    signup: { gasUnits: 120_000, maxPerDripCelo: 0.15, capCelo: 0.25 },
    // First goal: approve + create + a couple of days of proof/resolve.
    starter: { gasUnits: 600_000, maxPerDripCelo: 0.75, capCelo: 1 },
    active: {
      gasUnits: 600_000,
      maxPerDripCelo: 0.75,
      capCelo: 1,
      windowDays: 30,
      minProofs: 3,
      proofWindowDays: 14,
    },
  },
  limits: { dailyBudgetCelo: 10, signupsPerIpPerDay: 3, signupsPerSubnetPerDay: 10, minReserveCelo: 0.5 },
  requireCaptcha: true,
};

// ── Config parsing ──────────────────────────────────────────────────────────

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

function num(v: unknown, fallback: number, min: number, max: number, integer = false): number {
  if (typeof v !== "number" || !Number.isFinite(v) || v < min || v > max) return fallback;
  if (integer && !Number.isInteger(v)) return fallback;
  return v;
}

function stage(v: unknown, base: StageConfig): StageConfig {
  const o = isObj(v) ? v : {};
  return {
    gasUnits: num(o.gasUnits, base.gasUnits, 21_000, 30_000_000, true),
    maxPerDripCelo: num(o.maxPerDripCelo, base.maxPerDripCelo, 0, 10),
    capCelo: num(o.capCelo, base.capCelo, 0, 100),
  };
}

/** Code defaults overlaid with the stored partial override; each bad field falls back on its own. */
export function resolveFaucetConfig(override: unknown, base: FaucetConfig = DEFAULT_FAUCET_CONFIG): FaucetConfig {
  if (!isObj(override)) return base;
  const stages = isObj(override.stages) ? override.stages : {};
  const active = isObj(stages.active) ? stages.active : {};
  const limits = isObj(override.limits) ? override.limits : {};
  return {
    enabled: typeof override.enabled === "boolean" ? override.enabled : base.enabled,
    gasMargin: num(override.gasMargin, base.gasMargin, 1, 5),
    stages: {
      signup: stage(stages.signup, base.stages.signup),
      starter: stage(stages.starter, base.stages.starter),
      active: {
        ...stage(stages.active, base.stages.active),
        windowDays: num(active.windowDays, base.stages.active.windowDays, 1, 365, true),
        minProofs: num(active.minProofs, base.stages.active.minProofs, 0, 100, true),
        proofWindowDays: num(active.proofWindowDays, base.stages.active.proofWindowDays, 1, 90, true),
      },
    },
    limits: {
      dailyBudgetCelo: num(limits.dailyBudgetCelo, base.limits.dailyBudgetCelo, 0, 10_000),
      signupsPerIpPerDay: num(limits.signupsPerIpPerDay, base.limits.signupsPerIpPerDay, 0, 1_000, true),
      signupsPerSubnetPerDay: num(limits.signupsPerSubnetPerDay, base.limits.signupsPerSubnetPerDay, 0, 10_000, true),
      minReserveCelo: num(limits.minReserveCelo, base.limits.minReserveCelo, 0, 1_000),
    },
    requireCaptcha: typeof override.requireCaptcha === "boolean" ? override.requireCaptcha : base.requireCaptcha,
  };
}

/** Problems that make a config unsafe or unusable; empty = OK. */
export function faucetConfigIssues(c: FaucetConfig): string[] {
  const issues: string[] = [];
  for (const key of ["signup", "starter", "active"] as const) {
    const s = c.stages[key];
    if (s.maxPerDripCelo > s.capCelo) issues.push(`${key}: one drip can't be more than the step's total limit`);
  }
  if (c.limits.signupsPerSubnetPerDay > 0 && c.limits.signupsPerSubnetPerDay < c.limits.signupsPerIpPerDay) {
    issues.push("Per network range can't be lower than per IP");
  }
  return issues;
}

// ── Money ───────────────────────────────────────────────────────────────────

const WEI_PER_CELO = 10n ** 18n;

export function celoToWei(celo: number): bigint {
  // Through micro-CELO to dodge float noise; drips are never finer than that.
  return (BigInt(Math.round(celo * 1_000_000)) * WEI_PER_CELO) / 1_000_000n;
}

/** Wei → CELO with 6 decimals, rounded up (never under-reports what was sent). */
export function weiToCelo(wei: bigint): number {
  const micro = (wei * 1_000_000n + WEI_PER_CELO - 1n) / WEI_PER_CELO;
  return Number(micro) / 1_000_000;
}

export type TopUp = {
  /** Balance the wallet should hold for the step: gasUnits × maxFee × margin. */
  targetWei: bigint;
  /** What to send: target − current balance, rounded up to a whole micro-CELO; 0 when it already has enough. */
  needWei: bigint;
};

export function computeTopUp(params: {
  gasUnits: number;
  maxFeePerGasWei: bigint;
  margin: number;
  balanceWei: bigint;
}): TopUp {
  const marginBps = BigInt(Math.round(params.margin * 10_000));
  const targetWei = (BigInt(params.gasUnits) * params.maxFeePerGasWei * marginBps) / 10_000n;
  const raw = targetWei > params.balanceWei ? targetWei - params.balanceWei : 0n;
  const micro = WEI_PER_CELO / 1_000_000n;
  const needWei = raw === 0n ? 0n : ((raw + micro - 1n) / micro) * micro;
  return { targetWei, needWei };
}

// ── Network identity ────────────────────────────────────────────────────────

/**
 * The network range an IP belongs to: IPv4 /24, IPv6 /48 — roughly "one
 * household or one cloud box". Bots rotating through a block of addresses
 * share it. null for anything unparseable.
 */
export function ipSubnet(ip: string | null | undefined): string | null {
  const raw = (ip ?? "").trim().replace(/^\[|\]$/g, "");
  if (!raw || raw === "unknown") return null;
  const v4 = raw.replace(/^::ffff:/i, "");
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(v4)) {
    const parts = v4.split(".").map(Number);
    if (parts.some((p) => p > 255)) return null;
    return `${parts[0]}.${parts[1]}.${parts[2]}.0/24`;
  }
  if (!raw.includes(":")) return null;
  const [head, tail = ""] = raw.split("::");
  const h = head ? head.split(":") : [];
  const t = tail ? tail.split(":") : [];
  if (raw.includes("::")) {
    const fill = 8 - h.length - t.length;
    if (fill < 0) return null;
    h.push(...Array(fill).fill("0"), ...t);
  }
  if (h.length !== 8 || h.some((g) => !/^[0-9a-f]{1,4}$/i.test(g))) return null;
  return `${h.slice(0, 3).map((g) => parseInt(g, 16).toString(16)).join(":")}::/48`;
}

/** The client IP as Vercel reports it (it overwrites x-forwarded-for, so the first entry is the caller). */
export function clientIp(headers: { get(_name: string): string | null }): string | null {
  const raw = headers.get("x-real-ip")?.trim() || headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "";
  // Only IP characters — this value is stored and compared, never trusted as-is.
  return /^[0-9a-fA-F:.]{2,45}$/.test(raw) ? raw.toLowerCase() : null;
}

// ── Outcomes ────────────────────────────────────────────────────────────────

export type GasRequestReason =
  | "has_enough"
  | "paused"
  | "blocked"
  | "captcha_required"
  | "captcha_failed"
  | "not_eligible"
  | "stage_cap"
  | "ip_limit"
  | "subnet_limit"
  | "daily_budget"
  | "faucet_empty"
  | "gas_too_high"
  | "in_flight"
  | "send_failed"
  | "unavailable";

/** One short line for the user. Kept generic for anything a bot could probe. */
export function gasReasonMessage(reason: GasRequestReason): string {
  switch (reason) {
    case "has_enough":
      return "You already have enough for this step.";
    case "gas_too_high":
      return "Network fees are unusually high right now. Try again in a few minutes.";
    case "in_flight":
      return "Your gas is on its way. Give it a moment.";
    case "captcha_required":
    case "captcha_failed":
      return "Please complete the check and try again.";
    case "ip_limit":
    case "subnet_limit":
    case "blocked":
      return "Free gas isn't available on this device. Verify your face to continue.";
    case "daily_budget":
    case "faucet_empty":
    case "paused":
      return "Free gas is out for today. Verify your face to continue, or try again tomorrow.";
    case "send_failed":
    case "unavailable":
      return "Couldn't send gas right now. Try again.";
    case "stage_cap":
    case "not_eligible":
      return "You've used your free gas for now. Keep proving your goals to unlock more.";
  }
}
