/**
 * Sets (or updates) RewardVault's per-deposit cap for the G$ token — a
 * circuit breaker bounding the blast radius of a bug or key compromise in
 * an automated depositReward caller (e.g. the referral payout flow, which
 * deposits 6,000 G$ per referral, sometimes several in one pass when a
 * wallet crosses the 5-referral unlock threshold).
 *
 * Must be run with the RewardVault OWNER key (see deployments/reward-vault-celo.json).
 *
 * Usage:
 *   CAP_WHOLE=60000 PRIVATE_KEY=0x... npx hardhat run scripts/set-reward-vault-gdollar-cap.cjs --network celo
 *
 * CAP_WHOLE is in whole G$ (18 decimals handled here). Defaults to 60000 —
 * 10x a single referral-unlock lump sum (5 x 6,000 G$) — if not set.
 */

const { ethers } = require("hardhat");

const GOODDOLLAR_MAINNET = "0x62B8B11039FcfE5aB0C56E502b1C372A3d2a9c7A";
const REWARD_VAULT_MAINNET = "0xFE5a411b47F88198038EcE3177C19Ea043398c02";

async function main() {
  const [signer] = await ethers.getSigners();
  const network = hre.network.name;
  const capWhole = process.env.CAP_WHOLE || "60000";
  const capWei = ethers.parseUnits(capWhole, 18);

  const vaultAddress = process.env.REWARD_VAULT_ADDRESS || REWARD_VAULT_MAINNET;
  const vault = await ethers.getContractAt("RewardVault", vaultAddress, signer);

  const owner = await vault.owner();
  if (owner.toLowerCase() !== signer.address.toLowerCase()) {
    throw new Error(
      `Signer ${signer.address} is not the RewardVault owner (${owner}) — use the owner key.`,
    );
  }

  console.log(`Network:       ${network}`);
  console.log(`RewardVault:   ${vaultAddress}`);
  console.log(`Token (G$):    ${GOODDOLLAR_MAINNET}`);
  console.log(`New cap:       ${capWhole} G$ per depositReward call`);

  const tx = await vault.setMaxDepositPerToken(GOODDOLLAR_MAINNET, capWei);
  console.log(`Tx submitted:  ${tx.hash}`);
  await tx.wait();
  console.log("Confirmed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
