/**
 * Tests for shares bonding curve (Delulu-v3).
 * Run: npx hardhat test test/Delulu-v3-shares.js --config hardhat.config.cjs
 */
const { time, loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");
const hre = require("hardhat");
const { parseEther, encodeFunctionData } = require("viem");

const ONE_DAY = 24n * 60n * 60n;

function assertRevert(promise, pattern) {
  return promise.then(
    () => expect.fail("Expected revert"),
    (e) => expect(String(e)).to.match(pattern)
  );
}

describe("Delulu-v3 shares", function () {
  async function deployV3Fixture() {
    const [owner, creator, buyer, seller] = await hre.viem.getWalletClients();

    const cuSD = await hre.viem.deployContract("MockERC20", ["cUSD", "cUSD"]);
    const gDollar = await hre.viem.deployContract("MockERC20", ["GoodDollar", "G$"]);

    const implementation = await hre.viem.deployContract(
      "contracts/Delulu-v3.sol:Delulu",
      []
    );
    const artifact = await hre.artifacts.readArtifact(
      "Delulu",
      "contracts/Delulu-v3.sol:Delulu"
    );
    const initData = encodeFunctionData({
      abi: artifact.abi,
      functionName: "initialize",
      args: [cuSD.address, owner.account.address, gDollar.address],
    });

    const proxy = await hre.viem.deployContract("ERC1967Proxy", [
      implementation.address,
      initData,
    ]);
    const delulu = await hre.viem.getContractAt(
      "contracts/Delulu-v3.sol:Delulu",
      proxy.address
    );

    const mintAmount = parseEther("1000000");
    for (const user of [owner, creator, buyer, seller]) {
      await cuSD.write.mint([user.account.address, mintAmount]);
      await cuSD.write.approve([delulu.address, mintAmount], { account: user.account });
    }

    return { delulu, cuSD, owner, creator, buyer, seller };
  }

  async function createDeluluFixture() {
    const fx = await loadFixture(deployV3Fixture);
    const { delulu, cuSD, creator } = fx;

    await delulu.write.setProfile(["alice"], { account: creator.account });

    const latest = BigInt(await time.latest());
    await delulu.write.createDelulu(
      [cuSD.address, "ipfs-hash", latest + ONE_DAY, latest + 30n * ONE_DAY, parseEther("10")],
      { account: creator.account }
    );

    return fx;
  }

  it("mints 1 initial share to creator on create", async function () {
    const { delulu, creator } = await loadFixture(createDeluluFixture);

    expect(await delulu.read.sharesEnabled([1n])).to.equal(true);
    expect(await delulu.read.shareSupply([1n])).to.equal(1n);
    expect(await delulu.read.shareBalance([1n, creator.account.address])).to.equal(1n);
  });

  it("buyShares increases supply/balance and reserves", async function () {
    const { delulu, buyer } = await loadFixture(createDeluluFixture);

    const curveCost = await delulu.read.getShareBuyPrice([1n, 2n]);
    expect(curveCost).to.be.gt(0n);

    // totalCost = curveCost + 1% protocol + 1% creator
    const totalCost = curveCost + (curveCost / 100n) + (curveCost / 100n);

    await delulu.write.buyShares([1n, 2n, totalCost], { account: buyer.account });

    expect(await delulu.read.shareSupply([1n])).to.equal(3n);
    expect(await delulu.read.shareBalance([1n, buyer.account.address])).to.equal(2n);
    expect(await delulu.read.shareReserveByDelulu([1n])).to.equal(curveCost);
  });

  it("sellShares pays out net and releases reserves", async function () {
    const { delulu, buyer } = await loadFixture(createDeluluFixture);

    const curveCost = await delulu.read.getShareBuyPrice([1n, 2n]);
    const totalCost = curveCost + (curveCost / 100n) + (curveCost / 100n);
    await delulu.write.buyShares([1n, 2n, totalCost], { account: buyer.account });

    const curveProceeds = await delulu.read.getShareSellProceeds([1n, 1n]);
    const net = curveProceeds - (curveProceeds / 100n) - (curveProceeds / 100n);

    await delulu.write.sellShares([1n, 1n, net], { account: buyer.account });

    expect(await delulu.read.shareSupply([1n])).to.equal(2n);
    expect(await delulu.read.shareBalance([1n, buyer.account.address])).to.equal(1n);
    expect(await delulu.read.shareReserveByDelulu([1n])).to.equal(curveCost - curveProceeds);
  });

  it("reverts on slippage (buy)", async function () {
    const { delulu, buyer } = await loadFixture(createDeluluFixture);

    await assertRevert(
      delulu.write.buyShares([1n, 1n, 1n], { account: buyer.account }),
      /SlippageTooHigh/
    );
  });

  it("reverts: tipping disabled (stakeDelulu + tipMilestone)", async function () {
    const { delulu, buyer } = await loadFixture(createDeluluFixture);
    await assertRevert(
      delulu.write.stakeDelulu([1n, parseEther("1")], { account: buyer.account }),
      /TippingDisabled/
    );
    await assertRevert(
      delulu.write.tipMilestone([1n, 0n, parseEther("1")], { account: buyer.account }),
      /TippingDisabled/
    );
  });
});

