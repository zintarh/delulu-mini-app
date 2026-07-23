/**
 * Validates CommunityMarketV1 upgrade compatibility against an existing UUPS proxy.
 *
 * Usage:
 *   PROXY_ADDRESS=0x... \
 *   npx hardhat run scripts/validate-upgrade-community-market-v1.cjs --config hardhat.config.cjs --network celo
 */

const { ethers, upgrades } = require("hardhat");

async function main() {
  const proxyAddress = process.env.PROXY_ADDRESS;
  if (!proxyAddress) {
    throw new Error("Set PROXY_ADDRESS env var to the existing proxy address.");
  }

  console.log("=== CommunityMarketV1 Proxy Upgrade Compatibility Validation ===\n");
  console.log("Proxy address:", proxyAddress);

  const Factory = await ethers.getContractFactory("CommunityMarketV1");

  try {
    await upgrades.validateUpgrade(proxyAddress, Factory, { kind: "uups" });
  } catch (err) {
    if (String(err.message).includes("is not registered")) {
      console.log("Proxy not in local upgrades manifest. Importing proxy metadata...");
      await upgrades.forceImport(proxyAddress, Factory, { kind: "uups" });
      await upgrades.validateUpgrade(proxyAddress, Factory, { kind: "uups" });
    } else {
      throw err;
    }
  }

  console.log("\n✅ Upgrade is storage-compatible with current proxy implementation");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\n❌ Proxy compatibility validation FAILED:", err.message);
    process.exit(1);
  });
