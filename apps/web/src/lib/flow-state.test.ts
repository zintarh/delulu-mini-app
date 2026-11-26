import { test } from "node:test";
import assert from "node:assert/strict";
import { PAST_RECIPIENTS, PROJECT_RECIPIENT, buildFlowVote, flowAllocation, flowClaimMessage, votedForDelulu, type FlowSnapshot } from "@/lib/flow-state";

const other = "0xb2914810724fe2fb871960eb200dea427854b1c7" as const;
const snap = (over: Partial<FlowSnapshot> = {}): FlowSnapshot => ({ votingPower: 10n, votes: [], maxSpread: 0, verified: true, recipientActive: true, ...over });

test("claim message is Flow State's, byte for byte (lowercase wallet, whole seconds)", () => {
  const msg = flowClaimMessage("0xAbCdEf0000000000000000000000000000000001", Date.parse("2026-11-20T10:37:02.789Z"));
  assert.equal(
    msg,
    [
      "Claim voting rights in this Flow Council.",
      "",
      "Council: 0x889e0aadaa3f8b28a794ef70da147827c620a590",
      "Chain: 42220",
      "Wallet: 0xabcdef0000000000000000000000000000000001",
      "Issued at: 2026-11-20T10:37:02Z",
    ].join("\n"),
  );
});

test("the ballot only touches Delulu, with every vote not on another project", () => {
  // Fresh voter: all 10 to Delulu.
  assert.deepEqual(buildFlowVote(snap(), flowAllocation(snap()).maximum), [{ recipient: PROJECT_RECIPIENT, amount: 10n }]);
  // 4 on another project stay there; Delulu gets the other 6.
  const split = snap({ votes: [{ recipient: other, amount: 4n }] });
  assert.equal(flowAllocation(split).maximum, 6n);
  assert.deepEqual(buildFlowVote(split, 6n), [{ recipient: PROJECT_RECIPIENT, amount: 6n }]);
  // Already voted: nothing to send.
  const done = snap({ votes: [{ recipient: PROJECT_RECIPIENT, amount: 10n }] });
  assert.throws(() => buildFlowVote(done, flowAllocation(done).maximum), /already/);
  // Everything elsewhere, unverified, not claimed, project limit reached: refused.
  assert.throws(() => buildFlowVote(snap({ votes: [{ recipient: other, amount: 10n }] }), 0n), /other projects/);
  assert.throws(() => buildFlowVote(snap({ verified: false }), 10n), /Verify/);
  assert.throws(() => buildFlowVote(snap({ votingPower: 0n }), 0n), /Claim/);
  assert.throws(() => buildFlowVote(snap({ maxSpread: 1, votes: [{ recipient: other, amount: 4n }] }), 6n), /most projects/);
});

test("votes on Delulu's earlier address count as voted, so nobody is asked again", () => {
  const old = "0x3B3E5eFe7A6e26bd97C3Aa5498056b39889B361D"; // checksummed, as the chain returns it
  const a = flowAllocation(snap({ votes: [{ recipient: old as `0x${string}`, amount: 10n }] }));
  assert.equal(a.voted, true);
  assert.equal(a.past, 10n);
  assert.equal(a.current, 0n);
  assert.equal(votedForDelulu([{ recipient: old, amount: 3n }]), true);
  assert.equal(votedForDelulu([{ recipient: PROJECT_RECIPIENT.toUpperCase().replace("0X", "0x"), amount: 1n }]), true);
  assert.equal(votedForDelulu([{ recipient: old, amount: 0n }]), false);
  assert.equal(votedForDelulu([{ recipient: other, amount: 5n }]), false);
  assert.equal(flowAllocation(snap()).voted, false);
});

test("recipient addresses are stored lowercase (every check lowercases the chain's value)", () => {
  assert.equal(PROJECT_RECIPIENT, PROJECT_RECIPIENT.toLowerCase());
  for (const r of PAST_RECIPIENTS) assert.equal(r, r.toLowerCase());
  assert.equal(PROJECT_RECIPIENT, "0x5f3dd795ad9d626f5c0621b339a243220bcbd025");
  // Voters for the other addresses are still "voted"; the active one is never also "past" (no double count).
  assert.equal(votedForDelulu([{ recipient: "0x2C9e818d1C0EeeA201AF0864Cc58C82081cF5627", amount: 2n }]), true);
  assert.ok(!PAST_RECIPIENTS.includes(PROJECT_RECIPIENT));
});
