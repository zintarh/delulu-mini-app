/**
 * Deploy Delulu-v3 with UUPS proxy pattern
 * Usage:
 *   PRIVATE_KEY=0x... npx hardhat run scripts/deploy-delulu-v3.cjs --config hardhat.config.cjs --network celo
 *   PRIVATE_KEY=0x... npx hardhat run scripts/deploy-delulu-v3.cjs --config hardhat.config.cjs --network sepolia
 */

const { ethers } = require("hardhat");

// Celo Mainnet tokens
const TOKENS = {
  celo: {
    cUSD: "0x765DE816845861e75A25fCA122bb6898B8B1282a",
    gDollar: "0x62B8B11039FcfE5aB0C56E502b1C372A3d2a9c7A",
  },
  sepolia: {
    // Celo Sepolia - no native cUSD/G$, deploy MockERC20 or use known addresses
    cUSD: "0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1", // cUSD on Alfajores/Sepolia
    gDollar: "0x62B8B11039FcfE5aB0C56E502b1C372A3d2a9c7A", // placeholder
  },
  localhost: {
    cUSD: null, // will deploy MockERC20
    gDollar: null,
  },
};

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = hre.network.name;

  console.log("=== Delulu-v3 Deployment ===");
  console.log("Network:", network);
  console.log("Deployer:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Deployer balance:", ethers.formatEther(balance), "CELO");

  if (balance === 0n) {
    throw new Error("Deployer has no CELO for gas. Fund the deployer address first.");
  }

  let cUSDAddress, gDollarAddress;

  if (network === "localhost") {
    // Deploy mock tokens for local testing
    console.log("\nDeploying MockERC20 tokens...");
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const cusd = await MockERC20.deploy("cUSD", "cUSD");
    await cusd.waitForDeployment();
    cUSDAddress = await cusd.getAddress();

    const gdollar = await MockERC20.deploy("GoodDollar", "G$");
    await gdollar.waitForDeployment();
    gDollarAddress = await gdollar.getAddress();
    console.log("MockERC20 cUSD:", cUSDAddress);
    console.log("MockERC20 G$:  ", gDollarAddress);
  } else {
    cUSDAddress = TOKENS[network]?.cUSD;
    gDollarAddress = TOKENS[network]?.gDollar;
    if (!cUSDAddress || !gDollarAddress) {
      throw new Error(`No token addresses configured for network: ${network}`);
    }
    console.log("cUSD address:", cUSDAddress);
    console.log("G$   address:", gDollarAddress);
  }

  // 1. Deploy implementation
  console.log("\nDeploying Delulu implementation...");
  const Delulu = await ethers.getContractFactory("contracts/Delulu-v3.sol:Delulu");
  const implementation = await Delulu.deploy();
  await implementation.waitForDeployment();
  const implAddress = await implementation.getAddress();
  console.log("Implementation deployed:", implAddress);

  // 2. Encode initializer call
  const initData = implementation.interface.encodeFunctionData("initialize", [
    cUSDAddress,
    deployer.address, // vault / owner
    gDollarAddress,
  ]);

  // 3. Deploy ERC1967Proxy (UUPS proxy)
  console.log("\nDeploying ERC1967Proxy...");
  const ERC1967Proxy = await ethers.getContractFactory(
    "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol:ERC1967Proxy"
  );
  const proxy = await ERC1967Proxy.deploy(implAddress, initData);
  await proxy.waitForDeployment();
  const proxyAddress = await proxy.getAddress();
  console.log("Proxy (TEST contract) deployed:", proxyAddress);

  // 4. Verify initialization
  const deluluProxy = Delulu.attach(proxyAddress);
  const owner = await deluluProxy.owner();
  console.log("\nVerification:");
  console.log("  Proxy owner:", owner);
  console.log("  Matches deployer:", owner.toLowerCase() === deployer.address.toLowerCase());

  console.log("\n=== DEPLOYMENT COMPLETE ===");
  console.log("TEST_CONTRACT_PROXY=", proxyAddress);
  console.log("TEST_CONTRACT_IMPL=", implAddress);
  console.log("\nAdd these to your .env files as test contract addresses.");

  return { proxyAddress, implAddress };
}

main()
  .then(({ proxyAddress, implAddress }) => {
    console.log("\nProxy:", proxyAddress);
    console.log("Impl: ", implAddress);
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
