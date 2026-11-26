import { decodeFunctionData, parseAbi, zeroAddress, type Address, type Hex } from "viem";


export const FLOW_STATE = {
  active: true,
  endsOn: null as string | null,
};
let live = FLOW_STATE.active;

export const flowStateLive = () => live;
export function setFlowStateLive(on: boolean) {
  live = on;
}


// Pinned, lowercase: every check lowercases the chain's value.
export const PROJECT_RECIPIENT = "0x5f3dd795ad9d626f5c0621b339a243220bcbd025" as Address;
export const PAST_RECIPIENTS: readonly Address[] = [
  "0x5f3dd795ad9d626f5c0621b339a243220bcbd025" as Address, // Delulu's first Flow State address (2026-11-18)
];
export const isDeluluRecipient = (recipient: string) => {
  const r = recipient.toLowerCase();
  return r === PROJECT_RECIPIENT || PAST_RECIPIENTS.includes(r as Address);
};

export const votedForDelulu = (votes: readonly { recipient: string; amount: bigint }[]) =>
votes.some((v) => v.amount > 0n && isDeluluRecipient(v.recipient));
export const PROJECT_NAME = "Delulu";
export const FLOW_COUNCIL = "0x889e0aadaa3f8b28a794ef70da147827c620a590" as Address;
export const FLOW_CHAIN = 42220;
export const FLOW_URL = `https://flowstate.network/flow-councils/${FLOW_CHAIN}/${FLOW_COUNCIL}`;
export const FLOW_QUERY = `chainId=${FLOW_CHAIN}&councilId=${FLOW_COUNCIL}`;


export const IDENTITY_CONTRACT = "0xC361A6E67822a0EDc17D899227dd9FC50BD62F42" as Address;
export const IDENTITY_ABI = parseAbi(["function getWhitelistedRoot(address account) view returns (address)"]);
export const normalizeName = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, "");

export const FLOW_ABI = parseAbi([
  "function getVoter(address) view returns ((address account, uint96 votingPower, (uint160 recipientId, uint96 amount)[] votes) voter)",
  "function getVotes(address) view returns ((address recipient, uint96 amount)[])",
  "function getRecipient(address) view returns ((address account, uint96 votes) recipient)",
  "function maxVotingSpread() view returns (uint8)",
  "function vote((address recipient, uint96 amount)[] votes)",
]);
export type FlowVote = { recipient: Address; amount: bigint };
export type FlowSnapshot = { votingPower: bigint; votes: readonly FlowVote[]; maxSpread: number; verified: boolean; recipientActive: boolean };

/** Flow State's claim message, byte for byte (platform: flow-councils/lib/claimMessage.ts). Grants nothing by itself. */
export function flowClaimMessage(address: Address, issuedAt: number) {
  const timestamp = new Date(Math.floor(issuedAt / 1000) * 1000).toISOString().replace(/\.\d+Z$/, "Z");
  return ["Claim voting rights in this Flow Council.", "", `Council: ${FLOW_COUNCIL}`, `Chain: ${FLOW_CHAIN}`, `Wallet: ${address.toLowerCase()}`, `Issued at: ${timestamp}`].join("\n");
}

/** Delulu's votes now, and the most it can get: everything not given to another project. */
export function flowAllocation(snapshot: FlowSnapshot) {
  const current = snapshot.votes.find((v) => v.recipient.toLowerCase() === PROJECT_RECIPIENT)?.amount ?? 0n;
  /** Votes on Delulu at an earlier address. They count as voted; they aren't free to move. */
  const past = snapshot.votes.filter((v) => PAST_RECIPIENTS.includes(v.recipient.toLowerCase() as Address)).reduce((sum, v) => sum + v.amount, 0n);
  const other = snapshot.votes.filter((v) => v.recipient.toLowerCase() !== PROJECT_RECIPIENT && v.recipient !== zeroAddress);
  const otherTotal = other.reduce((sum, vote) => sum + vote.amount, 0n);
  const maximum = snapshot.votingPower > otherTotal ? snapshot.votingPower - otherTotal : 0n;
  return { current, past, voted: current + past > 0n, other, otherTotal, maximum };
}

export function buildFlowVote(snapshot: FlowSnapshot, amount: bigint): FlowVote[] {
  if (!snapshot.verified) throw new Error("Verify your face first — it's what gives you votes.");
  if (!snapshot.recipientActive) throw new Error(`${PROJECT_NAME} isn't taking votes in this round right now.`);
  if (snapshot.votingPower <= 0n) throw new Error("Claim your votes first.");
  const { current, other, maximum } = flowAllocation(snapshot);
  if (amount <= 0n || amount > maximum) throw new Error("All your votes are on other projects. Change them on Flow State first.");
  if (amount === current) throw new Error(`You've already given ${PROJECT_NAME} these votes.`);
  if (snapshot.maxSpread > 0 && other.filter((v) => v.amount > 0n).length + 1 > snapshot.maxSpread) {
    throw new Error("Your ballot already backs the most projects allowed. Change it on Flow State first.");
  }
  return [{ recipient: PROJECT_RECIPIENT, amount }];
}

export function flowSnapshotKey(snapshot: FlowSnapshot) {
  return [snapshot.votingPower, snapshot.maxSpread, snapshot.verified, snapshot.recipientActive, ...snapshot.votes.map((v) => `${v.recipient.toLowerCase()}:${v.amount}`).sort()].join("|");
}

export function matchesFlowVoteTransaction(address: Address, amount: string, tx: { from: Address; to: Address | null; input: Hex; value: bigint }) {
  try {
    const decoded = decodeFunctionData({ abi: FLOW_ABI, data: tx.input });
    const entries = decoded.functionName === "vote" ? decoded.args[0] : [];
    return (
      tx.from.toLowerCase() === address.toLowerCase() &&
      tx.to?.toLowerCase() === FLOW_COUNCIL &&
      tx.value === 0n &&
      entries.length === 1 &&
      entries[0].recipient.toLowerCase() === PROJECT_RECIPIENT &&
      entries[0].amount.toString() === amount
    );
  } catch {
    return false;
  }
}
