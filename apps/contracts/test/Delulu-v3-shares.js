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

    // Read the actual initial share count so all tests derive from it dynamically.
    const initialShares = await delulu.read.shareSupply([1n]);

    return { ...fx, initialShares };
  }

  it("creator becomes first buyer: shares bought with stake, not free mint", async function () {
    const { delulu, creator, initialShares } = await loadFixture(createDeluluFixture);

    // Shares are enabled and supply reflects the curve purchase (not 1 free share).
    expect(await delulu.read.sharesEnabled([1n])).to.equal(true);
    expect(initialShares).to.be.gt(1n); // many shares, not 1

    // Creator holds all initial shares.
    expect(await delulu.read.shareBalance([1n, creator.account.address])).to.equal(initialShares);

    // Curve reserve is funded (stake entered the bonding curve).
    expect(await delulu.read.shareReserveByDelulu([1n])).to.be.gt(0n);

    // No separate stake pool — creator's commitment is their share position.
    expect(await delulu.read.marketStakedAmount([1n])).to.equal(0n);

    // Creator is counted as the first unique buyer.
    expect(await delulu.read.uniqueBuyerCount([1n])).to.equal(1n);
    expect(await delulu.read.hasEverBought([1n, creator.account.address])).to.equal(true);
  });

  it("buyShares increases supply/balance, reserves, and uniqueBuyerCount", async function () {
    const { delulu, buyer, initialShares } = await loadFixture(createDeluluFixture);

    const initialReserve = await delulu.read.shareReserveByDelulu([1n]);

    const curveCost = await delulu.read.getShareBuyPrice([1n, 2n]);
    expect(curveCost).to.be.gt(0n);

    // totalCost = curveCost + 1% protocol + 1% creator
    const totalCost = curveCost + (curveCost / 100n) + (curveCost / 100n);

    await delulu.write.buyShares([1n, 2n, totalCost], { account: buyer.account });

    // Supply grows by 2.
    expect(await delulu.read.shareSupply([1n])).to.equal(initialShares + 2n);
    // Buyer holds their 2 shares.
    expect(await delulu.read.shareBalance([1n, buyer.account.address])).to.equal(2n);
    // Reserve grows by curveCost of the new buy.
    expect(await delulu.read.shareReserveByDelulu([1n])).to.equal(initialReserve + curveCost);

    // Buyer is a new unique address — uniqueBuyerCount increments to 2.
    expect(await delulu.read.uniqueBuyerCount([1n])).to.equal(2n);
    expect(await delulu.read.hasEverBought([1n, buyer.account.address])).to.equal(true);
  });

  it("buying again from the same address does NOT increment uniqueBuyerCount", async function () {
    const { delulu, buyer } = await loadFixture(createDeluluFixture);

    const buy = async () => {
      const curveCost = await delulu.read.getShareBuyPrice([1n, 1n]);
      const totalCost = curveCost + (curveCost / 100n) + (curveCost / 100n);
      await delulu.write.buyShares([1n, 1n, totalCost], { account: buyer.account });
    };

    await buy(); // first buy — uniqueBuyerCount: 1 → 2
    await buy(); // second buy — same address, no increment

    expect(await delulu.read.uniqueBuyerCount([1n])).to.equal(2n);
  });

  it("sellShares pays out net and releases reserves", async function () {
    const { delulu, buyer, initialShares } = await loadFixture(createDeluluFixture);

    const initialReserve = await delulu.read.shareReserveByDelulu([1n]);

    const curveCost = await delulu.read.getShareBuyPrice([1n, 2n]);
    const totalCost = curveCost + (curveCost / 100n) + (curveCost / 100n);
    await delulu.write.buyShares([1n, 2n, totalCost], { account: buyer.account });

    const curveProceeds = await delulu.read.getShareSellProceeds([1n, 1n]);
    const net = curveProceeds - (curveProceeds / 100n) - (curveProceeds / 100n);

    await delulu.write.sellShares([1n, 1n, net], { account: buyer.account });

    // Supply: initialShares + 2 bought - 1 sold.
    expect(await delulu.read.shareSupply([1n])).to.equal(initialShares + 1n);
    expect(await delulu.read.shareBalance([1n, buyer.account.address])).to.equal(1n);
    // Reserve: initial + buyCurveCost - sellCurveProceeds.
    expect(await delulu.read.shareReserveByDelulu([1n])).to.equal(
      initialReserve + curveCost - curveProceeds
    );
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
