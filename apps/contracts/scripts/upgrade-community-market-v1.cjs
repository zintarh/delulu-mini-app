/**
 * Upgrade the CommunityMarketV1 UUPS proxy to a new implementation.
 *
 * Usage:
 *   PRIVATE_KEY=0x... PROXY_ADDRESS=0x... npx hardhat run scripts/upgrade-community-market-v1.cjs --network celo
 *
 * Reuse an already-deployed implementation:
 *   NEW_IMPLEMENTATION_ADDRESS=0x... PROXY_ADDRESS=0x... npx hardhat run scripts/upgrade-community-market-v1.cjs --network celo
 */

const fs = require("fs");
const path = require("path");
const { ethers } = require("hardhat");

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function upgradeWithRetry(proxy, newImplAddress) {
  const maxAttempts = 6;
  let lastErr;
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const tx = await proxy.upgradeToAndCall(newImplAddress, "0x");
      console.log("Upgrade tx:", tx.hash);
      await tx.wait();
      return tx;
    } catch (e) {
      lastErr = e;
      const msg = String(e?.shortMessage || e?.message || e);
      const retryable = /nonce|sequencer|replacement|underpriced|timeout/i.test(msg);
      if (retryable && i < maxAttempts - 1) {
        const waitMs = 2500 * (i + 1);
        console.warn(`Retry ${i + 1}… waiting ${waitMs}ms`);
        await sleep(waitMs);
        continue;
      }
      throw e;
    }
  }
  throw lastErr;
}

function loadDefaultProxy(network) {
  const file = path.join(
    __dirname,
    "..",
    "deployments",
    `community-market-v1-${network === "celo" ? "celo" : network}.json`,
  );
  if (!fs.existsSync(file)) return null;
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  return data.proxy || data.address || null;
}

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = hre.network.name;
  const proxyAddress = process.env.PROXY_ADDRESS || loadDefaultProxy(network);

  if (!proxyAddress) {
    throw new Error("Set PROXY_ADDRESS or deploy first with deploy-community-market-v1.cjs");
  }

  console.log("=== CommunityMarketV1 Upgrade ===");
  console.log("Network:", network);
  console.log("Deployer:", deployer.address);
  console.log("Proxy:", proxyAddress);

  const code = await ethers.provider.getCode(proxyAddress);
  if (!code || code === "0x") {
    throw new Error(`No bytecode at proxy ${proxyAddress}`);
  }

  const Factory = await ethers.getContractFactory("CommunityMarketV1");

  let newImplAddress = process.env.NEW_IMPLEMENTATION_ADDRESS?.trim();
  if (newImplAddress) {
    console.log("\nUsing existing implementation:", newImplAddress);
  } else {
    console.log("\nDeploying new implementation...");
    const newImpl = await Factory.deploy();
    await newImpl.waitForDeployment();
    newImplAddress = await newImpl.getAddress();
    console.log("New implementation:", newImplAddress);
  }

  const proxy = Factory.attach(proxyAddress);
  await upgradeWithRetry(proxy, newImplAddress);

  const owner = await proxy.owner();
  console.log("\nPost-upgrade owner:", owner);
  console.log("\n=== UPGRADE COMPLETE ===");
  console.log("Proxy (unchanged):", proxyAddress);
  console.log("New implementation: ", newImplAddress);

  const outPath = path.join(
    __dirname,
    "..",
    "deployments",
    `community-market-v1-${network === "celo" ? "celo" : network}.json`,
  );
  if (fs.existsSync(outPath)) {
    const data = JSON.parse(fs.readFileSync(outPath, "utf8"));
    data.implementation = newImplAddress;
    data.upgradedAt = new Date().toISOString().slice(0, 10);
    fs.writeFileSync(outPath, `${JSON.stringify(data, null, 2)}\n`);
    console.log(`Updated ${outPath}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
