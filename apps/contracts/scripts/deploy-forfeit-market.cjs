/**
 * Deploy ForfeitMarket with UUPS proxy (implementation + ERC1967Proxy).
 * Uses hre.viem (this repo's hardhat.config.cjs loads hardhat-toolbox-viem,
 * not hardhat-ethers, so hre.ethers isn't available here).
 *
 * Usage:
 *   PRIVATE_KEY=0x... npx hardhat run scripts/deploy-forfeit-market.cjs --network celo
 *
 * After deployment:
 *   1. Set NEXT_PUBLIC_FORFEIT_MARKET_MAINNET to the PROXY address
 *   2. Call setApprovedToken(G$, true) — createCommitment reverts for every token until approved
 *   3. Call setApprovedCharity(...) for any charity destination you want live
 *   4. Run apps/web/src/lib/migrations/add_forfeit_tables.sql against Supabase
 *
 * Upgrades (same proxy address, new logic): write scripts/upgrade-forfeit-market.cjs
 * following the same pattern as scripts/upgrade-community-market-v1.cjs.
 */

const fs = require("fs");
const path = require("path");
const hre = require("hardhat");
const { encodeFunctionData, formatEther } = require("viem");

async function main() {
  const [deployer] = await hre.viem.getWalletClients();
  const publicClient = await hre.viem.getPublicClient();
  const network = hre.network.name;

  console.log(`\nDeploying ForfeitMarket (UUPS) on ${network}`);
  console.log(`Deployer: ${deployer.account.address}`);
  const balance = await publicClient.getBalance({ address: deployer.account.address });
  console.log(`Balance:  ${formatEther(balance)} CELO`);

  // Captured before deploying — safe (at-or-before) as a subgraph startBlock even
  // though it isn't the exact proxy-creation block.
  const startBlock = await publicClient.getBlockNumber();

  const implementation = await hre.viem.deployContract("ForfeitMarket", []);
  console.log(`Implementation: ${implementation.address}`);

  const artifact = await hre.artifacts.readArtifact("ForfeitMarket");
  // Owner and platform-fee recipient both set to the deployer for now — same as
  // CommunityMarketV1's bootstrap. Reassign platformFeeAddress later via
  // setPlatformFeeAddress if a dedicated treasury address is set up.
  const initData = encodeFunctionData({
    abi: artifact.abi,
    functionName: "initialize",
    args: [deployer.account.address, deployer.account.address],
  });

  const proxy = await hre.viem.deployContract("ERC1967Proxy", [implementation.address, initData]);

  const market = await hre.viem.getContractAt("ForfeitMarket", proxy.address);
  const owner = await market.read.owner();
  const platformFeeAddress = await market.read.platformFeeAddress();

  console.log(`\nForfeitMarket UUPS deployed!`);
  console.log(`  Proxy:              ${proxy.address}`);
  console.log(`  Implementation:     ${implementation.address}`);
  console.log(`  Block:              ${startBlock}`);
  console.log(`  Owner:              ${owner}`);
  console.log(`  Platform fee addr:  ${platformFeeAddress}`);

  const deploymentRecord = {
    network: network === "celo" ? "celo" : network,
    chainId: network === "celo" ? 42220 : null,
    contract: "ForfeitMarket",
    proxy: proxy.address,
    implementation: implementation.address,
    address: proxy.address,
    startBlock: Number(startBlock),
    owner: deployer.account.address,
    platformFeeAddress: deployer.account.address,
    deployedAt: new Date().toISOString().slice(0, 10),
    upgradeable: "uups",
  };

  const outPath = path.join(
    __dirname,
    "..",
    "deployments",
    `forfeit-market-${network === "celo" ? "celo" : network}.json`,
  );
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(deploymentRecord, null, 2)}\n`);

  console.log(`\nWrote ${outPath}`);
  console.log(`\nNext steps:`);
  console.log(`  1. apps/web/.env.local:`);
  console.log(`       NEXT_PUBLIC_FORFEIT_MARKET_${network === "celo" ? "MAINNET" : "SEPOLIA"}=${proxy.address}`);
  console.log(`  2. Call setApprovedToken(G$, true) — nothing can be created until a token is approved`);
  console.log(`  3. Call setApprovedCharity(...) for any charity destination`);
  console.log(`  4. Run add_forfeit_tables.sql against Supabase`);

  return { proxyAddress: proxy.address, implAddress: implementation.address, blockNumber: startBlock };
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
