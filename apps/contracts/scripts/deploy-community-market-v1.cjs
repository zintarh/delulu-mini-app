/**
 * Deploy CommunityMarketV1 — standalone community campaign contract.
 * Usage:
 *   PRIVATE_KEY=0x... npx hardhat run scripts/deploy-community-market-v1.cjs --network celo
 *   PRIVATE_KEY=0x... npx hardhat run scripts/deploy-community-market-v1.cjs --network sepolia
 *
 * After deployment:
 *   1. Copy the deployed address into apps/delulu-subgraph/subgraph.yaml (CommunityMarketV1.source.address)
 *   2. Set the startBlock to the deployment block number
 *   3. Set NEXT_PUBLIC_COMMUNITY_MARKET_V1_MAINNET (or SEPOLIA) in apps/web/.env.local
 *   4. Run: goldsky subgraph deploy delulu-market/<version> --path .
 */

const { ethers } = require("hardhat");

const CURRENCY = {
  celo:      "0x62B8B11039FcfE5aB0C56E502b1C372A3d2a9c7A", // G$ on Celo mainnet
  sepolia:   "0x62B8B11039FcfE5aB0C56E502b1C372A3d2a9c7A", // placeholder — update for testnet
  localhost: null,
};

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = hre.network.name;
  console.log(`\nDeploying CommunityMarketV1 on ${network}`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Balance:  ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} CELO`);

  let currencyAddress = CURRENCY[network];

  if (!currencyAddress) {
    console.log("No currency address for this network — deploying MockERC20...");
    const Mock = await ethers.getContractFactory("MockERC20");
    const mock = await Mock.deploy("Mock G$", "mG$", 18);
    await mock.waitForDeployment();
    currencyAddress = await mock.getAddress();
    console.log(`MockERC20 deployed at: ${currencyAddress}`);
  }

  const Factory = await ethers.getContractFactory("CommunityMarketV1");
  const contract = await Factory.deploy(currencyAddress, deployer.address);
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  const receipt = await contract.deploymentTransaction().wait();

  console.log(`\nCommunityMarketV1 deployed!`);
  console.log(`  Address:     ${address}`);
  console.log(`  Block:       ${receipt.blockNumber}`);
  console.log(`  Currency:    ${currencyAddress}`);
  console.log(`  Owner:       ${deployer.address}`);

  console.log(`\nNext steps:`);
  console.log(`  1. Update subgraph.yaml:`);
  console.log(`       address: "${address}"`);
  console.log(`       startBlock: ${receipt.blockNumber}`);
  console.log(`  2. Set env var (apps/web/.env.local):`);
  console.log(`       NEXT_PUBLIC_COMMUNITY_MARKET_V1_${network === "celo" ? "MAINNET" : "SEPOLIA"}=${address}`);
  console.log(`  3. Redeploy subgraph to Goldsky`);

  return { address, blockNumber: receipt.blockNumber };
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
