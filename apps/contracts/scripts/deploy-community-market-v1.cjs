/**
 * Deploy CommunityMarketV1 with UUPS proxy (implementation + ERC1967Proxy).
 *
 * Usage:
 *   PRIVATE_KEY=0x... npx hardhat run scripts/deploy-community-market-v1.cjs --network celo
 *   PRIVATE_KEY=0x... npx hardhat run scripts/deploy-community-market-v1.cjs --network sepolia
 *
 * After deployment:
 *   1. Use PROXY address in subgraph.yaml (CommunityMarketV1.source.address)
 *   2. Set startBlock to proxy deployment block
 *   3. Set NEXT_PUBLIC_COMMUNITY_MARKET_V1_MAINNET (or SEPOLIA) to the PROXY address
 *   4. Redeploy subgraph to Goldsky
 *
 * Upgrades (same proxy address, new logic):
 *   PRIVATE_KEY=0x... npx hardhat run scripts/upgrade-community-market-v1.cjs --network celo
 */

const fs = require("fs");
const path = require("path");
const { ethers } = require("hardhat");

const CURRENCY = {
  celo: "0x62B8B11039FcfE5aB0C56E502b1C372A3d2a9c7A", // G$ on Celo mainnet
  sepolia: "0x62B8B11039FcfE5aB0C56E502b1C372A3d2a9c7A",
  localhost: null,
};

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = hre.network.name;
  console.log(`\nDeploying CommunityMarketV1 (UUPS) on ${network}`);
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
  const implementation = await Factory.deploy();
  await implementation.waitForDeployment();
  const implAddress = await implementation.getAddress();
  console.log(`Implementation: ${implAddress}`);

  const initData = implementation.interface.encodeFunctionData("initialize", [
    currencyAddress,
    deployer.address,
  ]);

  const ERC1967Proxy = await ethers.getContractFactory(
    "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol:ERC1967Proxy",
  );
  const proxy = await ERC1967Proxy.deploy(implAddress, initData);
  await proxy.waitForDeployment();
  const proxyAddress = await proxy.getAddress();
  const receipt = await proxy.deploymentTransaction().wait();

  const market = Factory.attach(proxyAddress);
  const owner = await market.owner();

  console.log(`\nCommunityMarketV1 UUPS deployed!`);
  console.log(`  Proxy:           ${proxyAddress}`);
  console.log(`  Implementation:  ${implAddress}`);
  console.log(`  Block:           ${receipt.blockNumber}`);
  console.log(`  Currency:        ${currencyAddress}`);
  console.log(`  Owner:           ${owner}`);

  const deploymentRecord = {
    network: network === "celo" ? "celo" : network,
    chainId: network === "celo" ? 42220 : null,
    contract: "CommunityMarketV1",
    proxy: proxyAddress,
    implementation: implAddress,
    address: proxyAddress,
    startBlock: receipt.blockNumber,
    currency: currencyAddress,
    owner: deployer.address,
    deployedAt: new Date().toISOString().slice(0, 10),
    upgradeable: "uups",
  };

  const outPath = path.join(
    __dirname,
    "..",
    "deployments",
    `community-market-v1-${network === "celo" ? "celo" : network}.json`,
  );
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(deploymentRecord, null, 2)}\n`);

  console.log(`\nWrote ${outPath}`);
  console.log(`\nNext steps:`);
  console.log(`  1. subgraph.yaml address (proxy): "${proxyAddress}"`);
  console.log(`       startBlock: ${receipt.blockNumber}`);
  console.log(`  2. apps/web/.env.local:`);
  console.log(
    `       NEXT_PUBLIC_COMMUNITY_MARKET_V1_${network === "celo" ? "MAINNET" : "SEPOLIA"}=${proxyAddress}`,
  );
  console.log(`  3. Redeploy subgraph to Goldsky`);
  console.log(`  4. Future upgrades: scripts/upgrade-community-market-v1.cjs`);

  return { proxyAddress, implAddress, blockNumber: receipt.blockNumber };
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
