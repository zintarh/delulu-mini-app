/**
 * Deploy RewardVault with UUPS proxy (implementation + ERC1967Proxy).
 *
 * Usage:
 *   REWARDER_ADDRESS=0x... PRIVATE_KEY=0x... npx hardhat run scripts/deploy-reward-vault.cjs --network celo
 *   PRIVATE_KEY=0x... npx hardhat run scripts/deploy-reward-vault.cjs --network sepolia
 *
 * REWARDER_ADDRESS should be a dedicated hot wallet used only by the admin
 * dashboard backend to call depositReward — NOT the owner/deployer key.
 * Required on --network celo; optional elsewhere (defaults to the deployer,
 * which is fine for local/testnet only).
 *
 * After deployment:
 *   1. Set NEXT_PUBLIC_REWARD_VAULT_MAINNET (or SEPOLIA) to the PROXY address
 *   2. Fund/approve the rewarder wallet for whichever tokens it will deposit
 *   3. Optionally call setMaxDepositPerToken(token, cap) per token — cap is in
 *      that token's own base units (e.g. 6 decimals for USDT, 18 for G$/cUSD)
 *
 * Upgrades (same proxy address, new logic): mirror upgrade-community-market-v1.cjs.
 */

const fs = require("fs");
const path = require("path");
const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = hre.network.name;
  console.log(`\nDeploying RewardVault (UUPS) on ${network}`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Balance:  ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} CELO`);

  if (network === "celo" && !process.env.REWARDER_ADDRESS) {
    throw new Error(
      "REWARDER_ADDRESS is required on --network celo. Use a dedicated hot wallet — not the deployer/owner key.",
    );
  }
  const rewarderAddress = process.env.REWARDER_ADDRESS || deployer.address;
  if (!process.env.REWARDER_ADDRESS) {
    console.log("REWARDER_ADDRESS not set — defaulting to deployer address (local/testnet only).");
  }

  const Factory = await ethers.getContractFactory("RewardVault");
  const implementation = await Factory.deploy();
  await implementation.waitForDeployment();
  const implAddress = await implementation.getAddress();
  console.log(`Implementation: ${implAddress}`);

  const initData = implementation.interface.encodeFunctionData("initialize", [rewarderAddress]);

  const ERC1967Proxy = await ethers.getContractFactory(
    "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol:ERC1967Proxy",
  );
  const proxy = await ERC1967Proxy.deploy(implAddress, initData);
  await proxy.waitForDeployment();
  const proxyAddress = await proxy.getAddress();
  const receipt = await proxy.deploymentTransaction().wait();

  const vault = Factory.attach(proxyAddress);
  const owner = await vault.owner();
  const rewarder = await vault.rewarder();

  console.log(`\nRewardVault UUPS deployed!`);
  console.log(`  Proxy:           ${proxyAddress}`);
  console.log(`  Implementation:  ${implAddress}`);
  console.log(`  Block:           ${receipt.blockNumber}`);
  console.log(`  Owner:           ${owner}`);
  console.log(`  Rewarder:        ${rewarder}`);

  const deploymentRecord = {
    network: network === "celo" ? "celo" : network,
    chainId: network === "celo" ? 42220 : null,
    contract: "RewardVault",
    proxy: proxyAddress,
    implementation: implAddress,
    address: proxyAddress,
    startBlock: receipt.blockNumber,
    owner: deployer.address,
    rewarder: rewarderAddress,
    deployedAt: new Date().toISOString().slice(0, 10),
    upgradeable: "uups",
  };

  const outPath = path.join(
    __dirname,
    "..",
    "deployments",
    `reward-vault-${network === "celo" ? "celo" : network}.json`,
  );
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(deploymentRecord, null, 2)}\n`);

  console.log(`\nWrote ${outPath}`);
  console.log(`\nNext steps:`);
  console.log(`  1. apps/web/.env.local:`);
  console.log(
    `       NEXT_PUBLIC_REWARD_VAULT_${network === "celo" ? "MAINNET" : "SEPOLIA"}=${proxyAddress}`,
  );
  console.log(`  2. Fund the rewarder wallet (${rewarderAddress}) with the tokens it will grant as rewards.`);
  console.log(`  3. Approve the vault from the rewarder wallet for each token before calling depositReward.`);
  console.log(`  4. (Optional) call setMaxDepositPerToken(token, cap) per token to bound single-grant size.`);

  return { proxyAddress, implAddress, blockNumber: receipt.blockNumber };
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
