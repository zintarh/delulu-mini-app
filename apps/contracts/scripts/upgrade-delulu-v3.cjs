/**
 * Upgrade the Delulu UUPS proxy to a new implementation.
 *
 * Usage:
 *   PRIVATE_KEY=0x... \
 *   PROXY_ADDRESS=0x7692199630F3865160fB1Fa496961251fA15aFEa \
 *   npx hardhat run scripts/upgrade-delulu-v3.cjs --config hardhat.config.cjs --network celo
 *
 * For Celo Sepolia testnet:
 *   PRIVATE_KEY=0x... \
 *   PROXY_ADDRESS=0xba562cf9aC1Cb180EcE06dd9C86800B3F1EE51B8 \
 *   npx hardhat run scripts/upgrade-delulu-v3.cjs --config hardhat.config.cjs --network sepolia
 */

const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = hre.network.name;

  const proxyAddress = process.env.PROXY_ADDRESS;
  if (!proxyAddress) {
    throw new Error("Set PROXY_ADDRESS env var to the existing proxy address.");
  }

  console.log("=== Delulu-v3 Upgrade ===");
  console.log("Network:      ", network);
  console.log("Deployer:     ", deployer.address);
  console.log("Proxy address:", proxyAddress);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Deployer balance:", ethers.formatEther(balance), "CELO");
  if (balance === 0n) {
    throw new Error("Deployer has no CELO for gas.");
  }

  // 1. Deploy the new implementation
  console.log("\nDeploying new implementation...");
  const Delulu = await ethers.getContractFactory("contracts/Delulu-v3.sol:Delulu");
  const newImpl = await Delulu.deploy();
  await newImpl.waitForDeployment();
  const newImplAddress = await newImpl.getAddress();
  console.log("New implementation:", newImplAddress);

  // 2. Call upgradeToAndCall on the proxy (owner-only, no re-init needed)
  console.log("\nUpgrading proxy...");
  const proxy = Delulu.attach(proxyAddress);
  const tx = await proxy.upgradeToAndCall(newImplAddress, "0x");
  console.log("Upgrade tx:", tx.hash);
  await tx.wait();
  console.log("Upgrade confirmed.");

  // 3. Smoke-check: read owner from upgraded proxy
  const owner = await proxy.owner();
  console.log("\nPost-upgrade owner:", owner);
  console.log("Matches deployer:", owner.toLowerCase() === deployer.address.toLowerCase());

  console.log("\n=== UPGRADE COMPLETE ===");
  console.log("Proxy (unchanged):", proxyAddress);
  console.log("New impl:         ", newImplAddress);
  console.log("\nNext steps:");
  console.log("  1. Verify the new implementation on Celoscan (see verify script).");
  console.log("  2. Redeploy the subgraph so uniqueBuyerCount is indexed.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
