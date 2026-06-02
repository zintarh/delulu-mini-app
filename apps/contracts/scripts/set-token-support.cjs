/**
 * Enable or disable an ERC-20 for createDelulu / tips (owner only).
 *
 * Usage (Celo mainnet):
 *   TOKEN_ADDRESS=0x... TOKEN_ENABLED=true \
 *   PRIVATE_KEY=0x... npx hardhat run scripts/set-token-support.cjs --config hardhat.config.cjs --network celo
 *
 * Optional: PROXY_ADDRESS (defaults to production proxy on celo/sepolia)
 */
const { ethers } = require("hardhat");

const DEFAULT_PROXY_BY_NETWORK = {
  celo: "0x7692199630F3865160fB1Fa496961251fA15aFEa",
  sepolia: "0xba562cf9aC1Cb180EcE06dd9C86800B3F1EE51B8",
};

async function main() {
  const token = process.env.TOKEN_ADDRESS;
  if (!token || !ethers.isAddress(token)) {
    throw new Error("Set TOKEN_ADDRESS to a valid checksummed address");
  }

  const enabled =
    process.env.TOKEN_ENABLED === undefined
      ? true
      : /^(1|true|yes)$/i.test(String(process.env.TOKEN_ENABLED));

  const [signer] = await ethers.getSigners();
  if (!signer) {
    throw new Error(
      "No deployer account. Set PRIVATE_KEY (or CELO_FAUCET_PRIVATE_KEY / CELO_DEPLOYER_PRIVATE_KEY).",
    );
  }

  const network = hre.network.name;
  const proxyAddress =
    process.env.PROXY_ADDRESS || DEFAULT_PROXY_BY_NETWORK[network];
  if (!proxyAddress) {
    throw new Error(`Unknown network ${network}. Set PROXY_ADDRESS.`);
  }

  const delulu = await ethers.getContractAt(
    "contracts/Delulu-v3.sol:Delulu",
    proxyAddress,
    signer,
  );

  const owner = await delulu.owner();
  console.log("Network:     ", network);
  console.log("Proxy:       ", proxyAddress);
  console.log("Signer:      ", signer.address);
  console.log("Owner:       ", owner);
  if (owner.toLowerCase() !== signer.address.toLowerCase()) {
    throw new Error("Signer is not contract owner — cannot call setTokenSupport");
  }

  const before = await delulu.isSupportedToken(token);
  console.log("Token:       ", token);
  console.log("Before:      ", before);

  if (before === enabled) {
    console.log(`Already ${enabled ? "enabled" : "disabled"}. No tx sent.`);
    return;
  }

  const tx = await delulu.setTokenSupport(token, enabled);
  console.log("Tx:          ", tx.hash);
  const receipt = await tx.wait();
  if (!receipt || receipt.status !== 1) {
    throw new Error("setTokenSupport transaction failed");
  }

  // Some RPC nodes lag on eth_call immediately after a block.
  await new Promise((r) => setTimeout(r, 2000));
  const after = await delulu.isSupportedToken(token);
  console.log("After:       ", after);
  if (after !== enabled) {
    throw new Error(
      `State mismatch after setTokenSupport: expected ${enabled}, got ${after}`,
    );
  }
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
