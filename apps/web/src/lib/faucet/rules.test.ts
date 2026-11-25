import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_FAUCET_CONFIG,
  celoToWei,
  sentSponsoredGasOut,
  applyComfortFloor,
  COMFORT_BALANCE_CELO,
  computeTopUp,
  faucetConfigIssues,
  ipSubnet,
  resolveFaucetConfig,
  weiToCelo,
} from "./rules";

const GWEI = 10n ** 9n;

test("top-up is priced from live fees and only fills the gap", () => {
  // 400k gas × 50 gwei × 1.5 = 0.03 CELO.
  const empty = computeTopUp({ gasUnits: 400_000, maxFeePerGasWei: 50n * GWEI, margin: 1.5, balanceWei: 0n });
  assert.equal(weiToCelo(empty.targetWei), 0.03);
  assert.equal(weiToCelo(empty.needWei), 0.03);

  // Already holds 0.01 → send 0.02.
  const partial = computeTopUp({ gasUnits: 400_000, maxFeePerGasWei: 50n * GWEI, margin: 1.5, balanceWei: celoToWei(0.01) });
  assert.equal(weiToCelo(partial.needWei), 0.02);

  // Holds more than enough → nothing.
  const full = computeTopUp({ gasUnits: 400_000, maxFeePerGasWei: 50n * GWEI, margin: 1.5, balanceWei: celoToWei(1) });
  assert.equal(full.needWei, 0n);

  // Fees double → the drip doubles too.
  const spike = computeTopUp({ gasUnits: 400_000, maxFeePerGasWei: 100n * GWEI, margin: 1.5, balanceWei: 0n });
  assert.equal(weiToCelo(spike.needWei), 0.06);
});

test("comfort floor tops a player up to 0.6 CELO", () => {
  assert.equal(COMFORT_BALANCE_CELO, 0.6);
  const empty = applyComfortFloor(celoToWei(0.06), 0n, COMFORT_BALANCE_CELO);
  assert.equal(weiToCelo(empty), 0.6);
  const partial = applyComfortFloor(0n, celoToWei(0.2), COMFORT_BALANCE_CELO);
  assert.equal(weiToCelo(partial), 0.4);
  const already = applyComfortFloor(0n, celoToWei(0.6), COMFORT_BALANCE_CELO);
  assert.equal(already, 0n);
  const feeBigger = applyComfortFloor(celoToWei(0.74), 0n, COMFORT_BALANCE_CELO);
  assert.equal(weiToCelo(feeBigger), 0.74);
});

test("sending sponsored CELO to another wallet blocks another claim; spending it as a fee does not", () => {
  const me = "0xabc";
  assert.equal(sentSponsoredGasOut([{ to: "0xdef", valueWei: celoToWei(0.6) }], me), true);
  assert.equal(sentSponsoredGasOut([{ to: "0xdef", valueWei: 0n }], me), false);
  assert.equal(sentSponsoredGasOut([{ to: "0xdef", valueWei: celoToWei(0.0001) }], me), false);
  assert.equal(sentSponsoredGasOut([{ to: me, valueWei: celoToWei(0.6) }], me), false);
  assert.equal(sentSponsoredGasOut([{ to: null, valueWei: celoToWei(0.6) }], me), false);
});

test("drips round up to whole micro-CELO, never down", () => {
  const t = computeTopUp({ gasUnits: 21_000, maxFeePerGasWei: 1n, margin: 1, balanceWei: 0n });
  assert.equal(t.needWei, 10n ** 12n);
  assert.equal(weiToCelo(10n ** 12n + 1n), 0.000002);
});

test("subnets: IPv4 /24, IPv6 /48, mapped and junk input", () => {
  assert.equal(ipSubnet("102.89.34.7"), "102.89.34.0/24");
  assert.equal(ipSubnet("::ffff:102.89.34.7"), "102.89.34.0/24");
  assert.equal(ipSubnet("2a01:4f8:c17:1234::1"), "2a01:4f8:c17::/48");
  assert.equal(ipSubnet("2a01:04f8:0c17:9999:0:0:0:1"), "2a01:4f8:c17::/48");
  assert.equal(ipSubnet("::1"), "0:0:0::/48");
  assert.equal(ipSubnet("999.1.1.1"), null);
  assert.equal(ipSubnet("unknown"), null);
  assert.equal(ipSubnet(""), null);
});

test("config: bad fields fall back one by one, issues are caught", () => {
  const c = resolveFaucetConfig({
    gasMargin: 0.5, // below 1 → default
    stages: { signup: { maxPerDripCelo: 0.02, gasUnits: "lots" } },
    limits: { dailyBudgetCelo: 1 },
  });
  assert.equal(c.gasMargin, DEFAULT_FAUCET_CONFIG.gasMargin);
  assert.equal(c.stages.signup.maxPerDripCelo, 0.02);
  assert.equal(c.stages.signup.gasUnits, DEFAULT_FAUCET_CONFIG.stages.signup.gasUnits);
  assert.equal(c.limits.dailyBudgetCelo, 1);
  assert.deepEqual(faucetConfigIssues(DEFAULT_FAUCET_CONFIG), []);

  const bad = resolveFaucetConfig({ stages: { starter: { maxPerDripCelo: 1, capCelo: 0.5 } } });
  assert.equal(faucetConfigIssues(bad).length, 1);
});
