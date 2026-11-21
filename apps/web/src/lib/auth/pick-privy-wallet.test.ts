import { test } from "node:test";
import assert from "node:assert/strict";
import { pickPrivyWallet } from "@/lib/auth/pick-privy-wallet";

const injected = { address: "0xbrowser", walletClientType: "metamask", linked: false };
const embedded = { address: "0xaccount", walletClientType: "privy", linked: true };
const external = { address: "0xlinked", walletClientType: "metamask", linked: true };

test("the account's Privy wallet wins over a browser wallet listed first", () => {
  assert.equal(pickPrivyWallet([injected, embedded])?.address, "0xaccount");
  assert.equal(pickPrivyWallet([injected, { ...embedded, walletClientType: "privy-v2" }])?.address, "0xaccount");
});

test("wallet-login players keep their linked wallet", () => {
  assert.equal(pickPrivyWallet([injected, external])?.address, "0xlinked");
});

test("falls back to the first wallet, or nothing", () => {
  assert.equal(pickPrivyWallet([injected])?.address, "0xbrowser");
  assert.equal(pickPrivyWallet([]), undefined);
});
