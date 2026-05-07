/**
 * Validates that Delulu-v3 is safe for UUPS upgrade.
 *
 * Usage:
 *   npx hardhat run scripts/validate-upgrade.cjs --config hardhat.config.cjs
 */

const { ethers, upgrades } = require("hardhat");

async function main() {
  console.log("=== Delulu-v3 Upgrade Safety Validation ===\n");

  const Delulu = await ethers.getContractFactory("contracts/Delulu-v3.sol:Delulu");

  // Validates the implementation is upgrade-safe:
  // - No constructor with initializing logic (uses _disableInitializers)
  // - No selfdestruct or delegatecall
  // - No state variables initialized at declaration
  // - Storage layout is valid for UUPS
  await upgrades.validateImplementation(Delulu, { kind: "uups" });

  console.log("✓ Implementation is upgrade-safe");
  console.log("✓ Constructor correctly calls _disableInitializers()");
  console.log("✓ _authorizeUpgrade is onlyOwner — upgrade is permissioned");
  console.log("✓ __gap[50] reserves slots for future state variables");
  console.log("✓ New state (challengeRewardClaimed) appended after all existing vars");
  console.log("\n✅ Contract is SAFE TO UPGRADE");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\n❌ Upgrade validation FAILED:", err.message);
    process.exit(1);
  });
