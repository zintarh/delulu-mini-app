/**
 * Upgrade the ForfeitMarket UUPS proxy to a new implementation.
 * Uses hre.viem (this repo's hardhat.config.cjs loads hardhat-toolbox-viem,
 * not hardhat-ethers, so hre.ethers isn't available here).
 *
 * Usage:
 *   PRIVATE_KEY=0x... npx hardhat run scripts/upgrade-forfeit-market.cjs --network celo
 *
 * Reuse an already-deployed implementation (e.g. deploy tx succeeded but the
 * upgrade tx failed):
 *   NEW_IMPLEMENTATION_ADDRESS=0x... PRIVATE_KEY=0x... npx hardhat run scripts/upgrade-forfeit-market.cjs --network celo
 */

const fs = require("fs");
const path = require("path");
const hre = require("hardhat");
const { formatEther } = require("viem");

function loadDeploymentRecord(network) {
  const file = path.join(
    __dirname,
    "..",
    "deployments",
    `forfeit-market-${network === "celo" ? "celo" : network}.json`,
  );
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
    throw new Error(
      "No proxy address found. Set PROXY_ADDRESS or deploy first with deploy-forfeit-market.cjs.",
    );
  }

  console.log("=== ForfeitMarket Upgrade ===");
  console.log("Network:  ", network);
  console.log("Deployer: ", deployer.account.address);
  console.log("Proxy:    ", proxyAddress);

  const balance = await publicClient.getBalance({ address: deployer.account.address });
  console.log("Balance:  ", formatEther(balance), "CELO");

  const proxyCode = await publicClient.getBytecode({ address: proxyAddress });
  if (!proxyCode || proxyCode === "0x") {
    throw new Error(`No bytecode at proxy ${proxyAddress} on ${network}.`);
  }

  const market = await hre.viem.getContractAt("ForfeitMarket", proxyAddress);

  // Snapshot a few state reads pre-upgrade so we can confirm nothing was lost.
  const ownerBefore = await market.read.owner();
  const platformFeeBefore = await market.read.platformFeeAddress();
  const nextIdBefore = await market.read.nextCommitmentId();
  console.log("\nPre-upgrade state:");
  console.log("  owner:            ", ownerBefore);
  console.log("  platformFeeAddress:", platformFeeBefore);
  console.log("  nextCommitmentId: ", nextIdBefore.toString());

  let newImplAddress = process.env.NEW_IMPLEMENTATION_ADDRESS?.trim();
  if (newImplAddress) {
    console.log("\nUsing existing implementation (skip deploy):", newImplAddress);
    const code = await publicClient.getBytecode({ address: newImplAddress });
    if (!code || code === "0x") {
      throw new Error(`No bytecode at NEW_IMPLEMENTATION_ADDRESS ${newImplAddress}`);
    }
  } else {
    console.log("\nDeploying new implementation...");
    const newImpl = await hre.viem.deployContract("ForfeitMarket", []);
    newImplAddress = newImpl.address;
    console.log("New implementation:", newImplAddress);
  }

  console.log("\nUpgrading proxy...");
  const upgradeTx = await market.write.upgradeToAndCall([newImplAddress, "0x"]);
  console.log("Upgrade tx:", upgradeTx);
  await publicClient.waitForTransactionReceipt({ hash: upgradeTx });
  console.log("Upgrade confirmed.");

  const ownerAfter = await market.read.owner();
  const platformFeeAfter = await market.read.platformFeeAddress();
  const nextIdAfter = await market.read.nextCommitmentId();
  console.log("\nPost-upgrade state:");
  console.log("  owner:            ", ownerAfter);
  console.log("  platformFeeAddress:", platformFeeAfter);
  console.log("  nextCommitmentId: ", nextIdAfter.toString());

  if (
    ownerAfter.toLowerCase() !== ownerBefore.toLowerCase() ||
    platformFeeAfter.toLowerCase() !== platformFeeBefore.toLowerCase() ||
    nextIdAfter !== nextIdBefore
  ) {
    throw new Error("State mismatch after upgrade — investigate before proceeding further.");
  }
  console.log("\nState preserved across upgrade.");

  if (record) {
    record.implementation = newImplAddress;
    record.upgradedAt = new Date().toISOString().slice(0, 10);
    fs.writeFileSync(recordFile, `${JSON.stringify(record, null, 2)}\n`);
    console.log(`\nUpdated ${recordFile}`);
  }

  console.log("\n=== UPGRADE COMPLETE ===");
  console.log("Proxy (unchanged):", proxyAddress);
  console.log("New implementation:", newImplAddress);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
