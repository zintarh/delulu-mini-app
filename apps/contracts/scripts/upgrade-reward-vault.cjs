/**
 * Upgrade the RewardVault UUPS proxy to a new implementation (adds the
 * pre-funded reward pool: fundPool / creditReward / availableBalance).
 * Uses hre.viem (this repo's hardhat.config.cjs loads hardhat-toolbox-viem).
 *
 * Usage:
 *   PRIVATE_KEY=0x... npx hardhat run scripts/upgrade-reward-vault.cjs --config hardhat.config.cjs --network celo
 *
 * Optionally set a per-day G$ ceiling on pool credits in the same run:
 *   MAX_DAILY_CREDIT_GDOLLARS=5000 PRIVATE_KEY=0x... npx hardhat run ...
 *
 * Reuse an already-deployed implementation (deploy succeeded, upgrade tx failed):
 *   NEW_IMPLEMENTATION_ADDRESS=0x... PRIVATE_KEY=0x... npx hardhat run ...
 */

const fs = require("fs");
const path = require("path");
const hre = require("hardhat");
const { formatEther, parseEther } = require("viem");

const GDOLLAR = "0x62B8B11039FcfE5aB0C56E502b1C372A3d2a9c7A";

function loadDeploymentRecord(network) {
  const file = path.join(__dirname, "..", "deployments", `reward-vault-${network}.json`);
  if (!fs.existsSync(file)) return { file, data: null };
  return { file, data: JSON.parse(fs.readFileSync(file, "utf8")) };
}

async function main() {
  const [deployer] = await hre.viem.getWalletClients();
  const publicClient = await hre.viem.getPublicClient();
  const network = hre.network.name;

  const { file: recordFile, data: record } = loadDeploymentRecord(network);
  const proxyAddress = process.env.PROXY_ADDRESS || record?.proxy || record?.address;
  if (!proxyAddress) {
    throw new Error("No proxy address found. Set PROXY_ADDRESS or deploy first with deploy-reward-vault.cjs.");
  }

  console.log("=== RewardVault Upgrade ===");
  console.log("Network:  ", network);
  console.log("Deployer: ", deployer.account.address);
  console.log("Proxy:    ", proxyAddress);
  console.log("Balance:  ", formatEther(await publicClient.getBalance({ address: deployer.account.address })), "CELO");

  const vault = await hre.viem.getContractAt("RewardVault", proxyAddress);

  const ownerBefore = await vault.read.owner();
  if (ownerBefore.toLowerCase() !== deployer.account.address.toLowerCase()) {
    throw new Error(`Deployer is not the vault owner (${ownerBefore}).`);
  }
  // Snapshot state pre-upgrade so we can confirm nothing was lost.
  const rewarderBefore = await vault.read.rewarder();
  const pendingBefore = await vault.read.totalPendingByToken([GDOLLAR]);
  const maxDepositBefore = await vault.read.maxDepositPerToken([GDOLLAR]);
  console.log("\nPre-upgrade state:");
  console.log("  owner:              ", ownerBefore);
  console.log("  rewarder:           ", rewarderBefore);
  console.log("  totalPending (G$):  ", formatEther(pendingBefore));
  console.log("  maxDeposit (G$):    ", formatEther(maxDepositBefore));

  let newImplAddress = process.env.NEW_IMPLEMENTATION_ADDRESS?.trim();
  if (newImplAddress) {
    console.log("\nUsing existing implementation (skip deploy):", newImplAddress);
    const code = await publicClient.getBytecode({ address: newImplAddress });
    if (!code || code === "0x") throw new Error(`No bytecode at NEW_IMPLEMENTATION_ADDRESS ${newImplAddress}`);
  } else {
    console.log("\nDeploying new implementation...");
    const newImpl = await hre.viem.deployContract("RewardVault", []);
    newImplAddress = newImpl.address;
    console.log("New implementation:", newImplAddress);
  }

  console.log("\nUpgrading proxy...");
  const upgradeTx = await vault.write.upgradeToAndCall([newImplAddress, "0x"]);
  console.log("Upgrade tx:", upgradeTx);
  await publicClient.waitForTransactionReceipt({ hash: upgradeTx });
  console.log("Upgrade confirmed.");

  const ownerAfter = await vault.read.owner();
  const rewarderAfter = await vault.read.rewarder();
  const pendingAfter = await vault.read.totalPendingByToken([GDOLLAR]);
  const maxDepositAfter = await vault.read.maxDepositPerToken([GDOLLAR]);
  const available = await vault.read.availableBalance([GDOLLAR]);
  console.log("\nPost-upgrade state:");
  console.log("  owner:              ", ownerAfter);
  console.log("  rewarder:           ", rewarderAfter);
  console.log("  totalPending (G$):  ", formatEther(pendingAfter));
  console.log("  maxDeposit (G$):    ", formatEther(maxDepositAfter));
  console.log("  pool available (G$):", formatEther(available));

  if (
    ownerAfter.toLowerCase() !== ownerBefore.toLowerCase() ||
    rewarderAfter.toLowerCase() !== rewarderBefore.toLowerCase() ||
    pendingAfter !== pendingBefore ||
    maxDepositAfter !== maxDepositBefore
  ) {
    throw new Error("State mismatch after upgrade — investigate before proceeding further.");
  }
  console.log("\nState preserved across upgrade.");

  const dailyCap = process.env.MAX_DAILY_CREDIT_GDOLLARS?.trim();
  if (dailyCap) {
    const tx = await vault.write.setMaxDailyCreditPerToken([GDOLLAR, parseEther(dailyCap)]);
    await publicClient.waitForTransactionReceipt({ hash: tx });
    console.log(`\nDaily pool credit limit set to ${dailyCap} G$ (tx ${tx})`);
  }

  if (record) {
    record.implementation = newImplAddress;
    record.upgradedAt = new Date().toISOString().slice(0, 10);
    fs.writeFileSync(recordFile, `${JSON.stringify(record, null, 2)}\n`);
    console.log(`\nUpdated ${recordFile}`);
  }

  console.log("\n=== UPGRADE COMPLETE ===");
  console.log("Proxy (unchanged):", proxyAddress);
  console.log("New implementation:", newImplAddress);
  console.log("\nNext: fund the pool — G$.approve(vault, amount) then vault.fundPool(G$, amount),");
  console.log("or just transfer G$ to the vault address.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
