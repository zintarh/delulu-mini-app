// Cash out: G$ to a Nigerian bank account, through GoodCash (pay.goodcash.xyz).
// Ported from GoodDrops, which runs the same flow in production.
//
// The player's wallet signs ONE transaction: G$.transferAndCall(router, amount,
// data). GoodCash's router (verified, not upgradeable, owner can only pause)
// swaps the G$ to dollars, pays the bank partner (Paycrest) exactly what the
// order needs and sends any surplus straight back to the player. Nothing is
// approved for later, so nothing else in the wallet is ever exposed.
//
// GoodCash's server decides the order details, so before any wallet is asked
// to sign we check the transaction ourselves (checkCashOutTx): right token,
// right router, exactly the amount the person typed, no CELO, an order that
// is still open. We never load GoodCash's widget script.
//
// Shared by the browser and the server. No secrets in here.

import { decodeAbiParameters, decodeFunctionData, encodeAbiParameters, encodeFunctionData, parseAbi, type Hex } from "viem";
import { CELO_MAINNET_ID, GOODDOLLAR_ADDRESSES } from "@/lib/constant";

/** GoodCashRouterV2 on Celo. Fixed here on purpose: never taken from the API. */
export const GOODCASH_ROUTER = "0x546698368a246539Df5e641EdC2b79c5782ea359" as const;
export const G_TOKEN = GOODDOLLAR_ADDRESSES.mainnet;

/** The most one withdrawal may take (no daily limit). GoodCash's own maximum still applies. */
export const MAX_WITHDRAW_G = 200_000;

export const TRANSFER_AND_CALL_ABI = parseAbi([
  "function transferAndCall(address to, uint256 value, bytes data) returns (bool)",
]);

/** abi.encode(uint8 route, uint256 minOut, uint256 deadline, address payTo, uint256 payAmount, bytes32 ref) */
const ORDER_PARAMS = [
  { type: "uint8", name: "route" },
  { type: "uint256", name: "minOut" },
  { type: "uint256", name: "deadline" },
  { type: "address", name: "payTo" },
  { type: "uint256", name: "payAmount" },
  { type: "bytes32", name: "ref" },
] as const;

export interface CashOutTx { chainId: number; to: string; data: string; value: string }
export interface CashOutOrder {
  router: string;
  payTo: string;
  payAmount: string;
  amountWei: string;
  minOut: string;
  validUntil: string;
}

/** What the wallet will actually be asked to send, once checked. */
export interface CheckedCall { amountWei: bigint; data: Hex }

export type CheckResult = { ok: true; call: CheckedCall } | { ok: false; reason: string };

/**
 * The check before any wallet signs. Returns the exact call to send, rebuilt
 * from the decoded values, so what we sign is byte for byte what we checked.
 *
 * `amountWei` is what the PERSON asked for, computed on our side, never the
 * API's figure. Test-mode orders carry a 1970 deadline on purpose; pass
 * `testMode` to skip only the time checks.
 */
export function checkCashOutTx(
  tx: CashOutTx,
  order: CashOutOrder,
  amountWei: bigint,
  opts: { testMode?: boolean; nowMs?: number } = {},
): CheckResult {
  const now = opts.nowMs ?? Date.now();
  try {
    if (tx.chainId !== CELO_MAINNET_ID) return { ok: false, reason: "wrong_chain" };
    if (tx.to.toLowerCase() !== G_TOKEN.toLowerCase()) return { ok: false, reason: "wrong_token" };
    if (BigInt(tx.value || "0x0") !== 0n) return { ok: false, reason: "sends_celo" };
    if (order.router.toLowerCase() !== GOODCASH_ROUTER.toLowerCase()) return { ok: false, reason: "wrong_router" };

    const outer = decodeFunctionData({ abi: TRANSFER_AND_CALL_ABI, data: tx.data as Hex });
    if (outer.functionName !== "transferAndCall") return { ok: false, reason: "wrong_function" };
    const [to, value, inner] = outer.args;
    if (to.toLowerCase() !== GOODCASH_ROUTER.toLowerCase()) return { ok: false, reason: "wrong_router" };
    if (value !== amountWei || BigInt(order.amountWei) !== amountWei) return { ok: false, reason: "wrong_amount" };

    const [route, minOut, deadline, payTo, payAmount] = decodeAbiParameters(ORDER_PARAMS, inner);
    if (route !== 0 && route !== 1) return { ok: false, reason: "unknown_route" };
    if (payTo.toLowerCase() !== order.payTo.toLowerCase()) return { ok: false, reason: "wrong_pay_to" };
    if (payAmount !== BigInt(order.payAmount)) return { ok: false, reason: "wrong_pay_amount" };
    if (payAmount <= 0n || payAmount > minOut) return { ok: false, reason: "bad_minimum" };
    if (BigInt(order.minOut) !== minOut) return { ok: false, reason: "bad_minimum" };
    if (!opts.testMode) {
      const deadlineMs = Number(deadline) * 1000;
      const closesMs = Date.parse(order.validUntil);
      if (!(deadlineMs > now)) return { ok: false, reason: "expired" };
      if (Number.isFinite(closesMs) && deadlineMs > closesMs + 1000) return { ok: false, reason: "deadline_after_order" };
    }

    // Rebuild and compare: no trailing bytes, nothing we didn't read.
    const rebuilt = encodeFunctionData({ abi: TRANSFER_AND_CALL_ABI, functionName: "transferAndCall", args: [to, value, inner] });
    if (rebuilt.toLowerCase() !== tx.data.toLowerCase()) return { ok: false, reason: "extra_data" };
    return { ok: true, call: { amountWei: value, data: inner } };
  } catch {
    return { ok: false, reason: "unreadable" };
  }
}

/** Exposed for tests: builds the inner order data the router decodes. */
export function encodeOrderData(o: { route: number; minOut: bigint; deadline: bigint; payTo: Hex; payAmount: bigint; ref: Hex }): Hex {
  return encodeAbiParameters(ORDER_PARAMS, [o.route, o.minOut, o.deadline, o.payTo, o.payAmount, o.ref]);
}

// ── Shapes our API returns to the app ─────────────────────────────────────────

export type CashOutStatus = "awaiting_signature" | "sent" | "processing" | "paid" | "failed" | "refunded" | "expired";
export const CASHOUT_STATUSES: CashOutStatus[] = ["awaiting_signature", "sent", "processing", "paid", "failed", "refunded", "expired"];

export interface FeeLine { type: string; label: string; percent?: number; amountG?: string; naira?: number }

export interface Quote {
  amountG: string;
  receive: { naira: number; minimumNaira: number };
  feePercent: number;
  fees: FeeLine[];
  minimumG: number;
  enough: boolean;
  nairaPerDollar: number;
  expiresAt: string;
}

export interface Bank { code: string; name: string; popular?: boolean }

export interface CashOutView {
  id: string;
  status: CashOutStatus;
  amountG: string;
  naira: number;
  txHash: string | null;
  createdAt: string;
  paidAt: string | null;
  accountName?: string;
  bankName?: string;
  accountLast4?: string;
}

export const isFinal = (s: CashOutStatus) => s === "paid" || s === "failed" || s === "refunded" || s === "expired";

/** "₦4,990" style, whole naira (no kobo), rounded down: never promise more than the bank pays. */
export const formatNaira = (n: number) =>
  `₦${Math.floor(n).toLocaleString("en-NG", { maximumFractionDigits: 0 })}`;

export const CASH_OUT_PAID_EVENT = parseAbi([
  "event CashOutPaid(address indexed user, address indexed payTo, uint256 gIn, uint256 usdtOut, uint256 usdtPaid, uint256 usdtReturned, uint8 route, bytes32 ref)",
])[0];

// ── Naira per G$ (for the "≈ ₦…" line) ────────────────────────────────────────

/** The quote amount used to read the rate: large enough that rounding doesn't matter. */
export const RATE_QUOTE_G = 100_000;

/** Naira per G$ after every GoodCash fee, from a quote for RATE_QUOTE_G. Null if unusable. */
export function nairaPerGFromQuote(quote: unknown): number | null {
  const naira = (quote as { receive?: { naira?: unknown } } | null)?.receive?.naira;
  if (typeof naira !== "number" || !Number.isFinite(naira) || naira <= 0) return null;
  return naira / RATE_QUOTE_G;
}

/** Whole naira for an amount of G$, rounded down. */
export function nairaFor(g: number, nairaPerG: number): number {
  return Math.floor(g * nairaPerG);
}

/** True for a Nigerian connection (Vercel's country header) or a device on Lagos time. */
export function isNigeria(country: string | null | undefined, timeZone: string): boolean {
  return country === "NG" || timeZone === "Africa/Lagos";
}
