import { test } from "node:test";
import assert from "node:assert/strict";
import { TRANSFER_TOPIC, matchTransfer, type RawLog } from "./transfer-match";

const TOKEN = "0x62B8B11039FcfE5aB0C56E502b1C372A3d2a9c7A";
const FROM = "0x1111111111111111111111111111111111111111";
const TO = "0x2222222222222222222222222222222222222222";
const pad = (a: string) => `0x${"0".repeat(24)}${a.slice(2).toLowerCase()}`;
const val = (v: bigint) => `0x${v.toString(16).padStart(64, "0")}`;
const E18 = 10n ** 18n;

function log(over: Partial<RawLog> & { value?: bigint; from?: string; to?: string } = {}): RawLog {
  return {
    address: over.address ?? TOKEN.toLowerCase(),
    topics: over.topics ?? [TRANSFER_TOPIC, pad(over.from ?? FROM), pad(over.to ?? TO)],
    data: over.data ?? val(over.value ?? 5000n * E18),
    transactionHash: "0xabc",
    blockNumber: 10n,
  };
}
const expected = { token: TOKEN, from: FROM, to: TO, amountWei: 5000n * E18 };

test("matches the exact transfer", () => {
  assert.deepEqual(matchTransfer([log()], expected), { valueWei: 5000n * E18, txHash: "0xabc", blockNumber: 10n });
});

test("case-insensitive addresses", () => {
  assert.ok(matchTransfer([log()], { ...expected, token: TOKEN.toUpperCase().replace("0X", "0x"), from: FROM.toUpperCase().replace("0X", "0x") }));
});

test("rejects wrong token, parties, or amount", () => {
  assert.equal(matchTransfer([log({ address: "0x765de816845861e75a25fca122bb6898b8b1282a" })], expected), null);
  assert.equal(matchTransfer([log({ from: TO })], expected), null);
  assert.equal(matchTransfer([log({ to: FROM })], expected), null);
  assert.equal(matchTransfer([log({ value: 5001n * E18 })], expected), null); // more than asked
  assert.equal(matchTransfer([log({ value: 4900n * E18 })], expected), null); // >1% short
  assert.equal(matchTransfer([log({ value: 0n })], { ...expected, amountWei: 0n }), null);
  assert.equal(matchTransfer([log({ topics: ["0xdead", pad(FROM), pad(TO)] })], expected), null);
  assert.equal(matchTransfer([], expected), null);
});

test("tolerates a small token fee and reports the received value", () => {
  const m = matchTransfer([log({ value: 4990n * E18 })], expected);
  assert.equal(m?.valueWei, 4990n * E18);
});

test("finds the right log among others in the receipt", () => {
  const other = log({ to: "0x3333333333333333333333333333333333333333" });
  assert.ok(matchTransfer([other, log()], expected));
});
