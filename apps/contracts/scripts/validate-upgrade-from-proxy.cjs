/**
 * Validates Delulu-v3 upgrade compatibility against an existing UUPS proxy.
 *
 * Usage:
 *   PROXY_ADDRESS=0x... \
 *   npx hardhat run scripts/validate-upgrade-from-proxy.cjs --config hardhat.config.cjs --network celo
 */

const { ethers, upgrades } = require("hardhat");

async function main() {
  const proxyAddress = process.env.PROXY_ADDRESS;
  if (!proxyAddress) {
    throw new Error("Set PROXY_ADDRESS env var to the existing proxy address.");
  }

  console.log("=== Delulu-v3 Proxy Upgrade Compatibility Validation ===\n");
  console.log("Proxy address:", proxyAddress);

  const Delulu = await ethers.getContractFactory("contracts/Delulu-v3.sol:Delulu");

  try {
    await upgrades.validateUpgrade(proxyAddress, Delulu, { kind: "uups" });
  } catch (err) {
    if (String(err.message).includes("is not registered")) {
      console.log("Proxy not in local upgrades manifest. Importing proxy metadata...");
      await upgrades.forceImport(proxyAddress, Delulu, { kind: "uups" });
      await upgrades.validateUpgrade(proxyAddress, Delulu, { kind: "uups" });
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
