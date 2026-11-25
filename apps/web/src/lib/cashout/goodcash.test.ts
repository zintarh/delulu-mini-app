import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "crypto";
import { encodeFunctionData, parseUnits, type Hex } from "viem";
import {
  G_TOKEN, GOODCASH_ROUTER, TRANSFER_AND_CALL_ABI, checkCashOutTx, encodeOrderData, formatNaira,
  isNigeria, nairaFor, nairaPerGFromQuote, RATE_QUOTE_G, type CashOutOrder,
} from "@/lib/cashout/goodcash";
import { verifySignature } from "@/lib/cashout/goodcash-server";

const PAY_TO = "0x1111111111111111111111111111111111111111" as Hex;
const ATTACKER = "0x2222222222222222222222222222222222222222" as Hex;
const NOW = Date.parse("2026-11-24T12:00:00Z");
const amountWei = parseUnits("5000", 18);

function build(over: { router?: Hex; amount?: bigint; payTo?: Hex; payAmount?: bigint; minOut?: bigint; deadline?: bigint; tail?: string; to?: string; value?: string; chainId?: number } = {}) {
  const minOut = over.minOut ?? 3_000_000n;
  const payAmount = over.payAmount ?? 2_900_000n;
  const deadline = over.deadline ?? BigInt(Math.floor(NOW / 1000) + 600);
  const inner = encodeOrderData({ route: 0, minOut, deadline, payTo: over.payTo ?? PAY_TO, payAmount, ref: `0x${"ab".repeat(32)}` });
  const data = encodeFunctionData({ abi: TRANSFER_AND_CALL_ABI, functionName: "transferAndCall", args: [over.router ?? GOODCASH_ROUTER, over.amount ?? amountWei, inner] });
  const tx = { chainId: over.chainId ?? 42220, to: over.to ?? G_TOKEN, data: data + (over.tail ?? ""), value: over.value ?? "0x0" };
  const order: CashOutOrder = {
    router: GOODCASH_ROUTER, payTo: PAY_TO, payAmount: "2900000", amountWei: amountWei.toString(), minOut: "3000000",
    validUntil: new Date(NOW + 700_000).toISOString(),
  };
  return { tx, order };
}

test("cash out check: accepts the exact cash out and returns the call to send", () => {
  const { tx, order } = build();
  const r = checkCashOutTx(tx, order, amountWei, { nowMs: NOW });
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.call.amountWei, amountWei);
});

test("cash out check: refuses anything that isn't exactly what the player asked for", () => {
  const cases: Array<[string, ReturnType<typeof build>, Partial<CashOutOrder>?]> = [
    ["wrong_router", build({ router: ATTACKER })],
    ["wrong_router", build(), { router: ATTACKER }],
    ["wrong_amount", build({ amount: amountWei * 2n }), { amountWei: (amountWei * 2n).toString() }],
    ["wrong_pay_to", build({ payTo: ATTACKER })],
    ["bad_minimum", build({ payAmount: 3_100_000n }), { payAmount: "3100000" }],
    ["wrong_token", build({ to: ATTACKER })],
    ["sends_celo", build({ value: "0x1" })],
    ["wrong_chain", build({ chainId: 1 })],
    ["extra_data", build({ tail: "00" })],
  ];
  for (const [reason, { tx, order }, patch] of cases) {
    assert.deepEqual(checkCashOutTx(tx, { ...order, ...patch }, amountWei, { nowMs: NOW }), { ok: false, reason }, reason);
  }
});

test("cash out check: refuses a closed order, except in test mode", () => {
  const { tx, order } = build({ deadline: 1n });
  assert.deepEqual(checkCashOutTx(tx, order, amountWei, { nowMs: NOW }), { ok: false, reason: "expired" });
  assert.equal(checkCashOutTx(tx, order, amountWei, { nowMs: NOW, testMode: true }).ok, true);
});

test("cash out check: refuses a deadline past the order's close", () => {
  const { tx, order } = build({ deadline: BigInt(Math.floor(NOW / 1000) + 10_000) });
  assert.deepEqual(checkCashOutTx(tx, order, amountWei, { nowMs: NOW }), { ok: false, reason: "deadline_after_order" });
});

test("webhook signature: only a fresh HMAC of the raw body with our secret passes", () => {
  const secret = "whsec_test";
  const raw = JSON.stringify({ id: "evt_1", type: "cashout.paid" });
  const t = Math.floor(NOW / 1000);
  const sig = createHmac("sha256", secret).update(`${t}.${raw}`).digest("hex");
  assert.equal(verifySignature(raw, `t=${t},v1=${sig}`, secret, t), true);
  assert.equal(verifySignature(raw + " ", `t=${t},v1=${sig}`, secret, t), false, "body changed");
  assert.equal(verifySignature(raw, `t=${t},v1=${sig}`, "other", t), false, "wrong secret");
  assert.equal(verifySignature(raw, `t=${t},v1=${sig}`, secret, t + 301), false, "too old");
  assert.equal(verifySignature(raw, null, secret, t), false, "no header");
});

test("naira: rate from a quote, rounded down, Nigeria detection", () => {
  assert.equal(nairaPerGFromQuote({ receive: { naira: 15_000 } }), 15_000 / RATE_QUOTE_G);
  assert.equal(nairaPerGFromQuote({ receive: { naira: 0 } }), null);
  assert.equal(nairaPerGFromQuote(null), null);
  assert.equal(nairaFor(1000, 0.1499), 149);
  assert.equal(formatNaira(12345.99), "₦12,345");
  assert.equal(isNigeria("NG", "Europe/London"), true);
  assert.equal(isNigeria(null, "Africa/Lagos"), true);
  assert.equal(isNigeria("GH", "Africa/Accra"), false);
});
