/**
 * Upgrade the Delulu UUPS proxy to a new implementation.
 *
 * Usage (Celo mainnet — proxy defaults to app constant; override with PROXY_ADDRESS):
 *   PRIVATE_KEY=0x... npx hardhat run scripts/upgrade-delulu-v3.cjs --config hardhat.config.cjs --network celo
 *
 * Celo Sepolia:
 *   PRIVATE_KEY=0x... npx hardhat run scripts/upgrade-delulu-v3.cjs --config hardhat.config.cjs --network sepolia
 *
 * After upgrade, update `DELULU_IMPLEMENTATION_ADDRESS` in apps/web/src/lib/constant.ts with the printed impl.
 *
 * If deployment succeeded but upgrade tx failed (e.g. Celo sequencer nonce), reuse the impl:
 *   NEW_IMPLEMENTATION_ADDRESS=0x... npx hardhat run scripts/upgrade-delulu-v3.cjs ...
 */

const { ethers } = require("hardhat");

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function upgradeWithRetry(proxy, newImplAddress, label = "upgrade") {
  const maxAttempts = 6;
  let lastErr;
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const tx = await proxy.upgradeToAndCall(newImplAddress, "0x");
      console.log(`${label} tx:`, tx.hash);
      await tx.wait();
      return tx;
    } catch (e) {
      lastErr = e;
      const msg = String(e?.shortMessage || e?.message || e);
      const retryable =
        /nonce|sequencer|replacement|underpriced|timeout/i.test(msg);
      if (retryable && i < maxAttempts - 1) {
        const waitMs = 2500 * (i + 1);
        console.warn(`Retry ${i + 1}/${maxAttempts - 1} after error (${msg.slice(0, 120)})… waiting ${waitMs}ms`);
        await sleep(waitMs);
        continue;
      }
      throw e;
    }
  }
  throw lastErr;
}

/** Must match apps/web/src/lib/constant.ts DELULU_CONTRACT_ADDRESSES (proxy = user-facing address). */
const DEFAULT_PROXY_BY_NETWORK = {
  celo: "0x7692199630F3865160fB1Fa496961251fA15aFEa",
  sepolia: "0xba562cf9aC1Cb180EcE06dd9C86800B3F1EE51B8",
};

async function main() {
  const signers = await ethers.getSigners();
  const deployer = signers[0];
  if (!deployer) {
    throw new Error(
      "No deployer account. Set PRIVATE_KEY in the environment (or hardhat.config accounts) for celo/sepolia.",
    );
  }
  const network = hre.network.name;

  const proxyAddress =
    process.env.PROXY_ADDRESS || DEFAULT_PROXY_BY_NETWORK[network];
  if (!proxyAddress) {
    throw new Error(
      `Set PROXY_ADDRESS or run with network celo|sepolia. Current network: ${network}`,
    );
  }

  const proxyCode = await ethers.provider.getCode(proxyAddress);
  if (!proxyCode || proxyCode === "0x") {
    throw new Error(
      `No contract bytecode at ${proxyAddress}. Wrong network, wrong address, or (for hardhat) deploy in the same process — see scripts/simulate-uups-upgrade-hardhat.cjs`,
    );
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

  const Delulu = await ethers.getContractFactory("contracts/Delulu-v3.sol:Delulu");

  let newImplAddress = process.env.NEW_IMPLEMENTATION_ADDRESS?.trim();
  if (newImplAddress) {
    console.log("\nUsing existing implementation (skip deploy):", newImplAddress);
    const code = await ethers.provider.getCode(newImplAddress);
    if (!code || code === "0x") {
      throw new Error(`No bytecode at NEW_IMPLEMENTATION_ADDRESS ${newImplAddress}`);
    }
  } else {
    console.log("\nDeploying new implementation...");
    const newImpl = await Delulu.deploy();
    await newImpl.waitForDeployment();
    newImplAddress = await newImpl.getAddress();
    console.log("New implementation:", newImplAddress);
  }

  // Call upgradeToAndCall on the proxy (owner-only, no re-init needed)
  console.log("\nUpgrading proxy...");
  const proxy = Delulu.attach(proxyAddress);
  await upgradeWithRetry(proxy, newImplAddress);
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
