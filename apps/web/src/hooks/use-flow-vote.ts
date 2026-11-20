"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePublicClient } from "wagmi";
import { encodeFunctionData, zeroAddress, type Address, type Hash } from "viem";
import { useAuth } from "@/hooks/use-auth";
import { useUnifiedSignMessage } from "@/hooks/use-unified-sign-message";
import { useUnifiedWriteContract } from "@/hooks/use-unified-write-contract";
import { useNoGas } from "@/contexts/no-gas-context";
import {
  FLOW_ABI,
  FLOW_CHAIN,
  FLOW_COUNCIL,
  IDENTITY_ABI,
  IDENTITY_CONTRACT,
  PROJECT_RECIPIENT,
  buildFlowVote,
  flowAllocation,
  flowClaimMessage,
  matchesFlowVoteTransaction,
  type FlowSnapshot,
} from "@/lib/flow-state";

type ErrLike = { code?: unknown; name?: unknown; message?: unknown; shortMessage?: unknown; cause?: unknown };
const isUserRejected = (err: unknown): boolean => {
  if (!err || typeof err !== "object") return false;
  const e = err as ErrLike;
  if (e.code === 4001 || e.name === "UserRejectedRequestError") return true;
  if (typeof e.message === "string" && /user rejected|rejected the request|user denied|user cancel|request rejected/i.test(e.message)) return true;
  return isUserRejected(e.cause);
};
const isNoGas = (err: unknown): boolean => {
  if (!err || typeof err !== "object") return false;
  const e = err as ErrLike;
  const text = [e.message, e.shortMessage, e.name].filter((v) => typeof v === "string").join(" ");
  return /insufficient funds|insufficient balance|exceeds balance|gas required exceeds|InsufficientFunds/i.test(text) || isNoGas(e.cause);
};

type Pending = { hash: Hash; amount: string };
const pendingKey = (address: Address) => `flow-vote:${FLOW_CHAIN}:${FLOW_COUNCIL}:${address.toLowerCase()}`;
const sleep = (ms: number) => new Promise((r) => window.setTimeout(r, ms));

/** Where the player stands: what the one button does next. */
export type FlowVoteStatus = "loading" | "verify" | "vote" | "voted" | "full" | "closed";

/**
 * Vote for Delulu on Flow State from inside the app, in one tap:
 * claim votes if needed (a signed message, no fee) → give Delulu every vote
 * not already on another project → wait for the receipt and check that the
 * transaction really cast it. A pending hash is kept, so a reload never sends
 * a second vote. Adapted from Calebux/flowstate-vote-kit's useFlowVote, routed
 * through our own wallet hooks (Web3Auth / Privy / wagmi).
 */
export function useFlowVote() {
  const { address: authAddress } = useAuth();
  const address = (authAddress?.toLowerCase() ?? null) as Address | null;
  const client = usePublicClient({ chainId: FLOW_CHAIN });
  const sign = useUnifiedSignMessage();
  const { writeContractAsync } = useUnifiedWriteContract();
  const { trigger: triggerNoGas } = useNoGas();

  const [snapshot, setSnapshot] = useState<FlowSnapshot | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const running = useRef(false);
  const owner = useRef(address);
  owner.current = address;
  // Every step re-checks the signed-in wallet, so nothing carries across an account switch.
  const assertOwner = useCallback(
    (a: Address) => {
      if (owner.current !== a) throw new Error("Your wallet changed. Open this again with the account you want to use.");
    },
    [],
  );

  const readSnapshot = useCallback(
    async (a: Address): Promise<FlowSnapshot> => {
      if (!client) throw new Error("Can't reach Celo right now. Try again.");
      const [voter, votes, maxSpread, root, recipient] = await Promise.all([
        client.readContract({ address: FLOW_COUNCIL, abi: FLOW_ABI, functionName: "getVoter", args: [a] }),
        client.readContract({ address: FLOW_COUNCIL, abi: FLOW_ABI, functionName: "getVotes", args: [a] }),
        client.readContract({ address: FLOW_COUNCIL, abi: FLOW_ABI, functionName: "maxVotingSpread" }),
        client.readContract({ address: IDENTITY_CONTRACT, abi: IDENTITY_ABI, functionName: "getWhitelistedRoot", args: [a] }),
        client.readContract({ address: FLOW_COUNCIL, abi: FLOW_ABI, functionName: "getRecipient", args: [PROJECT_RECIPIENT] }),
      ]);
      return { votingPower: voter.votingPower, votes, maxSpread, verified: root !== zeroAddress, recipientActive: recipient.account.toLowerCase() === PROJECT_RECIPIENT };
    },
    [client],
  );

  // Load: the snapshot, plus any vote sent before a reload.
  useEffect(() => {
    setSnapshot(null);
    setPending(null);
    setError("");
    setNotice("");
    if (!address) return;
    try {
      const saved = JSON.parse(localStorage.getItem(pendingKey(address)) ?? "null");
      if (saved && /^0x[0-9a-f]{64}$/i.test(saved.hash) && /^\d{1,29}$/.test(saved.amount)) setPending(saved);
    } catch {
      /* storage blocked — the in-memory state still guards this visit */
    }
    let cancelled = false;
    readSnapshot(address)
      .then((s) => !cancelled && owner.current === address && setSnapshot(s))
      .catch(() => !cancelled && setError("Couldn't load your votes. Try again."));
    return () => {
      cancelled = true;
    };
  }, [address, readSnapshot]);

  const finishReceipt = useCallback(
    async (a: Address, record: Pending, wait: boolean) => {
      if (!client) throw new Error("Can't reach Celo right now.");
      let receipt;
      try {
        receipt = wait ? await client.waitForTransactionReceipt({ hash: record.hash, confirmations: 1, timeout: 45_000 }) : await client.getTransactionReceipt({ hash: record.hash });
      } catch {
        setNotice("Your vote is sent and still confirming — don't vote again.");
        return;
      }
      if (receipt.status === "success") {
        const tx = await client.getTransaction({ hash: receipt.transactionHash }).catch(() => null);
        if (!tx) {
          setNotice("Your vote is in — still checking it. Tap to check again.");
          return;
        }
        if (!matchesFlowVoteTransaction(a, record.amount, tx)) {
          try {
            localStorage.removeItem(pendingKey(a));
          } catch {
            /* optional */
          }
          setPending(null);
          throw new Error("That transaction wasn't your vote. Tap Vote to try again.");
        }
      }
      try {
        localStorage.removeItem(pendingKey(a));
      } catch {
        /* optional */
      }
      setPending(null);
      if (receipt.status !== "success") throw new Error("The vote didn't go through. Tap Vote to try again.");
      assertOwner(a);
      setNotice("");
      setSnapshot(await readSnapshot(a).catch(() => null));
    },
    [client, assertOwner, readSnapshot],
  );

  const run = useCallback(
    async (label: string, action: (a: Address) => Promise<void>) => {
      if (running.current || !address) return;
      running.current = true;
      setBusy(label);
      setError("");
      setNotice("");
      try {
        await action(address);
      } catch (err) {
        if (isUserRejected(err)) setNotice("Cancelled — no vote was sent.");
        else if (isNoGas(err)) {
          setError("Your wallet needs a little CELO for the network fee.");
          triggerNoGas({ force: true });
        } else setError(err instanceof Error && err.message.length < 200 ? err.message : "Something went wrong. Try again.");
      } finally {
        running.current = false;
        setBusy("");
      }
    },
    [address, triggerNoGas],
  );

  /** The one button: claim votes if needed, then give Delulu all the votes that aren't on another project. */
  const voteAll = useCallback(
    () =>
      run("Getting your votes…", async (a) => {
        if (!client) throw new Error("Can't reach Celo right now.");
        if (pending) {
          setBusy("Checking your vote…");
          await finishReceipt(a, pending, false);
          return;
        }
        let state = await readSnapshot(a);
        assertOwner(a);
        setSnapshot(state);
        if (!state.verified) throw new Error("Verify your face first — it's what gives you votes.");

        // 1. Claim: one signed message (no fee). Flow State's bot adds the wallet as a voter.
        if (state.votingPower === 0n) {
          const issuedAt = Date.now();
          const signature = await sign(flowClaimMessage(a, issuedAt));
          assertOwner(a);
          const res = await fetch("/api/flowstate", {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-flow-vote": "1" },
            body: JSON.stringify({ address: a, issuedAt, signature }),
            signal: AbortSignal.timeout(30_000),
          });
          const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
          if (!res.ok || !data?.ok) throw new Error(data?.error ?? "Flow State didn't answer. Try again in a moment.");
          // The voter lands on-chain within a few seconds.
          for (let i = 0; i < 6 && state.votingPower === 0n; i++) {
            await sleep(2500);
            state = await readSnapshot(a);
          }
          assertOwner(a);
          setSnapshot(state);
          if (state.votingPower === 0n) {
            setNotice("Your votes are on the way — tap Vote again in a minute.");
            return;
          }
        }

        // 2. Vote: everything not already on another project goes to Delulu.
        setBusy("Voting…");
        const { maximum } = flowAllocation(state);
        const votes = buildFlowVote(state, maximum);
        await client.simulateContract({ account: a, address: FLOW_COUNCIL, abi: FLOW_ABI, functionName: "vote", args: [votes] });
        const data = encodeFunctionData({ abi: FLOW_ABI, functionName: "vote", args: [votes] });
        const [gas, gasPrice, balance] = await Promise.all([client.estimateGas({ account: a, to: FLOW_COUNCIL, data }), client.getGasPrice(), client.getBalance({ address: a })]);
        if (balance < (gas * gasPrice * 12n) / 10n) {
          triggerNoGas({ force: true });
          throw new Error("Your wallet needs a little CELO for the network fee.");
        }
        assertOwner(a);
        const hash = await writeContractAsync({ address: FLOW_COUNCIL, abi: FLOW_ABI, functionName: "vote", args: [votes] });
        const record = { hash, amount: votes[0].amount.toString() };
        try {
          localStorage.setItem(pendingKey(a), JSON.stringify(record));
        } catch {
          /* the visible pending state still guards a resend */
        }
        setPending(record);
        setBusy("Confirming…");
        await finishReceipt(a, record, true);
      }),
    [run, client, pending, finishReceipt, readSnapshot, assertOwner, sign, writeContractAsync, triggerNoGas],
  );

  const allocation = snapshot ? flowAllocation(snapshot) : null;
  const status: FlowVoteStatus = !snapshot
    ? "loading"
    : !snapshot.recipientActive
      ? "closed"
      : !snapshot.verified
        ? "verify"
        : snapshot.votingPower > 0n && allocation!.maximum === 0n
          ? "full"
          : snapshot.votingPower > 0n && allocation!.current > 0n && allocation!.current === allocation!.maximum
            ? "voted"
            : "vote";

  return {
    status,
    /** Delulu's votes from this player, and how many they have in all (0 before claiming). */
    votes: allocation?.current ?? 0n,
    votingPower: snapshot?.votingPower ?? 0n,
    pending,
    busy,
    error,
    notice,
    voteAll,
  };
}
