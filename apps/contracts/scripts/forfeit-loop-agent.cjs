/**
 * Forfeit-loop test agent — repeatedly stakes G$ on a short self-verified
 * ForfeitMarket commitment, submits proof, and resolves it successful (stake
 * returned in full), then does it again. Runs until MAX_CYCLES is reached or
 * you press Ctrl+C.
 *
 * This talks to Celo MAINNET with REAL G$ and REAL CELO gas — there is no
 * ForfeitMarket testnet deployment. It calls the contract directly and
 * bypasses Delulu's Next.js API/Supabase layer entirely, so these test
 * commitments will NOT show up in the Delulu app's UI/feed.
 *
 * Usage:
 *   PRIVATE_KEY=0x... npx hardhat run scripts/forfeit-loop-agent.cjs --network celo
 *
 * Env vars:
 *   PRIVATE_KEY       required — wallet holding G$ + CELO for gas
 *   STAKE_AMOUNT      G$ per cycle, decimal string (default "1")
 *   DURATION_MINUTES  deadline window per cycle (default 2)
 *   MAX_CYCLES        safety cap on cycles; 0 = unlimited (default 50)
 *   PROOF_LINK        placeholder proof string — contract never inspects it
 *                     (default "forfeit-loop-agent-test")
 */

const hre = require("hardhat");
const { getContract, parseUnits, formatUnits, formatEther, decodeEventLog } = require("viem");

const FORFEIT_MARKET_ADDRESS =
  process.env.FORFEIT_MARKET_ADDRESS || "0x5548eC3Aa02dCbcE85Cdc6Ad37d61613019D92f8";
const GOOD_DOLLAR_ADDRESS =
  process.env.GOOD_DOLLAR_ADDRESS || "0x62B8B11039FcfE5aB0C56E502b1C372A3d2a9c7A";
const GOOD_DOLLAR_DECIMALS = 18;

const STAKE_AMOUNT = process.env.STAKE_AMOUNT || "1";
const DURATION_MINUTES = Number(process.env.DURATION_MINUTES || "2");
const MAX_CYCLES = Number(process.env.MAX_CYCLES || "50");
const PROOF_LINK = process.env.PROOF_LINK || "forfeit-loop-agent-test";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const ZERO_BYTES32 = `0x${"0".repeat(64)}`;

// DestinationType.SelfReturn = 0, Cadence.Once = 0 (see ForfeitMarket.sol enums)
const DESTINATION_SELF_RETURN = 0;
const CADENCE_ONCE = 0;

const ERC20_ABI = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
];

async function main() {
  const [wallet] = await hre.viem.getWalletClients();
  const publicClient = await hre.viem.getPublicClient();
  const account = wallet.account.address;

  const market = await hre.viem.getContractAt("ForfeitMarket", FORFEIT_MARKET_ADDRESS);
  const token = getContract({
    address: GOOD_DOLLAR_ADDRESS,
    abi: ERC20_ABI,
    client: { public: publicClient, wallet },
  });

  console.log(`Forfeit loop agent`);
  console.log(`Wallet:          ${account}`);
  console.log(`ForfeitMarket:   ${FORFEIT_MARKET_ADDRESS}`);
  console.log(`G$ token:        ${GOOD_DOLLAR_ADDRESS}`);
  console.log(`Stake/cycle:     ${STAKE_AMOUNT} G$`);
  console.log(`Duration/cycle:  ${DURATION_MINUTES} minute(s)`);
  console.log(`Max cycles:      ${MAX_CYCLES > 0 ? MAX_CYCLES : "unlimited"}\n`);

  // --- Startup checks ---
  const approved = await market.read.approvedTokens([GOOD_DOLLAR_ADDRESS]);
  if (!approved) {
    console.error("G$ is not an approved token on ForfeitMarket. Aborting.");
    process.exit(1);
  }

  const stakeAmountWei = parseUnits(STAKE_AMOUNT, GOOD_DOLLAR_DECIMALS);
  const minStake = await market.read.minStakeForToken([GOOD_DOLLAR_ADDRESS]);
  if (stakeAmountWei < minStake) {
    console.error(
      `STAKE_AMOUNT (${STAKE_AMOUNT} G$) is below the on-chain minimum of ` +
        `${formatUnits(minStake, GOOD_DOLLAR_DECIMALS)} G$. Aborting.`,
    );
    process.exit(1);
  }

  const celoBalance = await publicClient.getBalance({ address: account });
  const g$Balance = await token.read.balanceOf([account]);
  console.log(`CELO balance:    ${formatEther(celoBalance)}`);
  console.log(`G$ balance:      ${formatUnits(g$Balance, GOOD_DOLLAR_DECIMALS)}\n`);

  if (celoBalance === 0n) {
    console.error("Zero CELO balance — cannot pay gas. Aborting.");
    process.exit(1);
  }
  if (g$Balance < stakeAmountWei) {
    console.error("Insufficient G$ balance for even one cycle. Aborting.");
    process.exit(1);
  }

  const neededAllowance = stakeAmountWei * BigInt(MAX_CYCLES > 0 ? MAX_CYCLES : 1000);
  const currentAllowance = await token.read.allowance([account, FORFEIT_MARKET_ADDRESS]);
  if (currentAllowance < neededAllowance) {
    console.log(
      `Approving ForfeitMarket for ${formatUnits(neededAllowance, GOOD_DOLLAR_DECIMALS)} G$...`,
    );
    const approveHash = await token.write.approve([FORFEIT_MARKET_ADDRESS, neededAllowance]);
    await publicClient.waitForTransactionReceipt({ hash: approveHash });
    console.log(`Approved. tx: ${approveHash}\n`);
  }

  // --- Graceful stop on Ctrl+C: finish the in-flight cycle, don't abort mid-tx ---
  let stopRequested = false;
  process.on("SIGINT", () => {
    if (stopRequested) {
      console.log("\nForce exiting.");
      process.exit(1);
    }
    console.log("\nStop requested — finishing current cycle, then exiting...");
    stopRequested = true;
  });

  let cycle = 0;
  let totalGasWei = 0n;

  while (!stopRequested && (MAX_CYCLES <= 0 || cycle < MAX_CYCLES)) {
    cycle += 1;
    console.log(`── Cycle ${cycle} ──`);
    try {
      const latestBlock = await publicClient.getBlock();
      const firstDeadline = latestBlock.timestamp + BigInt(DURATION_MINUTES * 60);

      const createHash = await market.write.createCommitment([
        GOOD_DOLLAR_ADDRESS,
        stakeAmountWei,
        DESTINATION_SELF_RETURN,
        ZERO_ADDRESS,
        CADENCE_ONCE,
        1,
        0,
        firstDeadline,
        ZERO_ADDRESS,
        ZERO_BYTES32,
      ]);
      const createReceipt = await publicClient.waitForTransactionReceipt({ hash: createHash });
      totalGasWei += createReceipt.gasUsed * createReceipt.effectiveGasPrice;

      const createdEvent = createReceipt.logs
        .filter((log) => log.address.toLowerCase() === FORFEIT_MARKET_ADDRESS.toLowerCase())
        .map((log) => {
          try {
            return decodeEventLog({ abi: market.abi, data: log.data, topics: log.topics });
          } catch {
            return null;
          }
        })
        .find((decoded) => decoded && decoded.eventName === "CommitmentCreated");
      if (!createdEvent) throw new Error("CommitmentCreated event not found in receipt");
      const commitmentId = createdEvent.args.commitmentId;
      console.log(`Created commitment #${commitmentId} (deadline in ${DURATION_MINUTES}m). tx: ${createHash}`);

      const proofHash = await market.write.submitProof([commitmentId, PROOF_LINK]);
      const proofReceipt = await publicClient.waitForTransactionReceipt({ hash: proofHash });
      totalGasWei += proofReceipt.gasUsed * proofReceipt.effectiveGasPrice;
      console.log(`Submitted proof. tx: ${proofHash}`);

      const resolveHash = await market.write.resolveCommitmentSuccess([commitmentId]);
      const resolveReceipt = await publicClient.waitForTransactionReceipt({ hash: resolveHash });
      totalGasWei += resolveReceipt.gasUsed * resolveReceipt.effectiveGasPrice;
      console.log(`Resolved success — stake returned. tx: ${resolveHash}\n`);
    } catch (err) {
      console.error(`Cycle ${cycle} failed:`, err.shortMessage || err.message || err);
      console.error("Stopping loop.");
      break;
    }
  }

  console.log(`Done. Cycles completed: ${cycle}. Total gas spent: ${formatEther(totalGasWei)} CELO.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
