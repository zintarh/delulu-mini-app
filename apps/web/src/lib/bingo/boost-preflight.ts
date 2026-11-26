import { BaseError, ContractFunctionRevertedError, createPublicClient, http, parseAbi } from "viem";
import { celo } from "viem/chains";

/**
 * Asks the contract whether a top-up would go through before the wallet
 * sends it. Web3Auth signs silently, so without this a refused top-up is
 * sent, reverts on-chain, costs the fee, and only says "didn't go through".
 * Most common refusal: today's photo is already in (PeriodNotOpen until the
 * next day opens).
 *
 * Throws an Error whose message is the contract's error name (topUpError in
 * boost-card.tsx turns it into words). Network trouble doesn't block: the
 * send itself still reports a real failure.
 */
const ABI = parseAbi([
  "function boostCommitment(uint256 commitmentId, uint256 amount)",
  "error PeriodNotOpen()",
  "error PeriodAlreadyResolved()",
  "error DeadlinePassed()",
  "error NotActive()",
  "error Unauthorized()",
  "error CommitmentNotFound()",
  "error InvalidInput()",
]);

const client = createPublicClient({
  chain: celo,
  transport: http(process.env.NEXT_PUBLIC_CELO_RPC_URL ?? process.env.NEXT_PUBLIC_RPC_URL ?? "https://forno.celo.org"),
});

export async function checkBoost(p: { market: `0x${string}`; account: `0x${string}`; commitmentId: bigint; amountWei: bigint }): Promise<void> {
  try {
    await client.simulateContract({
      address: p.market,
      abi: ABI,
      functionName: "boostCommitment",
      args: [p.commitmentId, p.amountWei],
      account: p.account,
    });
  } catch (err) {
    if (err instanceof BaseError) {
      const reverted = err.walk((e) => e instanceof ContractFunctionRevertedError);
      if (reverted instanceof ContractFunctionRevertedError) {
        throw new Error(reverted.data?.errorName ?? reverted.shortMessage);
      }
    }
    // RPC hiccup: let the real send decide.
  }
}
