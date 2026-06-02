/**
 * Single-process deploy + UUPS upgrade on the in-memory Hardhat network.
 * Proves upgrade path; each `hardhat run` uses a fresh chain, so deploy and upgrade must share one script.
 *
 *   npx hardhat run scripts/simulate-uups-upgrade-hardhat.cjs --config hardhat.config.cjs --network hardhat
 */

const { ethers } = require("hardhat");

async function main() {
  if (hre.network.name !== "hardhat") {
    throw new Error("Use --network hardhat only (in-memory).");
  }

  const [deployer] = await ethers.getSigners();
  const Delulu = await ethers.getContractFactory("contracts/Delulu-v3.sol:Delulu");

  console.log("=== 1) Deploy mocks + v1 impl + proxy ===\n");
  const MockERC20 = await ethers.getContractFactory("MockERC20");
  const cusd = await MockERC20.deploy("cUSD", "cUSD", 18);
  await cusd.waitForDeployment();
  const gdollar = await MockERC20.deploy("GoodDollar", "G$", 18);
  await gdollar.waitForDeployment();
  const cUSDAddress = await cusd.getAddress();
  const gDollarAddress = await gdollar.getAddress();

  const implV1 = await Delulu.deploy();
  await implV1.waitForDeployment();
  const implV1Addr = await implV1.getAddress();

  const initData = implV1.interface.encodeFunctionData("initialize", [
    cUSDAddress,
    deployer.address,
    gDollarAddress,
  ]);

  const ERC1967Proxy = await ethers.getContractFactory(
    "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol:ERC1967Proxy",
  );
  const proxy = await ERC1967Proxy.deploy(implV1Addr, initData);
  await proxy.waitForDeployment();
  const proxyAddress = await proxy.getAddress();

  const delulu = Delulu.attach(proxyAddress);
  const owner1 = await delulu.owner();
  console.log("Proxy:", proxyAddress);
  console.log("Impl v1:", implV1Addr);
  console.log("Owner:  ", owner1);

  console.log("\n=== 2) Deploy v2 impl + upgradeToAndCall ===\n");
  const implV2 = await Delulu.deploy();
  await implV2.waitForDeployment();
  const implV2Addr = await implV2.getAddress();
  console.log("Impl v2:", implV2Addr);

  const tx = await delulu.upgradeToAndCall(implV2Addr, "0x");
  await tx.wait();
  console.log("Upgrade tx:", tx.hash);

  const owner2 = await delulu.owner();
  console.log("Post-upgrade owner:", owner2);
  if (owner2.toLowerCase() !== deployer.address.toLowerCase()) {
    throw new Error("Owner mismatch after upgrade");
  }

  console.log("\n=== SIMULATION OK ===");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
