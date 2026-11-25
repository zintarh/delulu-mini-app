/**
 * Daily Boost — ForfeitMarket.boostCommitment: the creator adds G$ to an active
 * commitment during the current period. It joins the stake: back on a finish,
 * forfeited on a miss.
 * Run: npx hardhat test test/Boost.js --config hardhat.config.cjs
 */
const { time, loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");
const hre = require("hardhat");
const { parseEther, encodeFunctionData, zeroAddress } = require("viem");

const DAY = 86400n;
const Dest = { SelfReturn: 0, CommunityPool: 3 };
const Cad = { Daily: 1 };

function assertRevert(promise, pattern) {
  return promise.then(
    () => expect.fail("Expected revert"),
    (e) => expect(String(e)).to.match(pattern),
  );
}

describe("Daily Boost", function () {
  async function fixture() {
    const [owner, player, stranger, keeper] = await hre.viem.getWalletClients();
    const token = await hre.viem.deployContract("MockERC20", ["GoodDollar", "G$", 18]);
    const impl = await hre.viem.deployContract("ForfeitMarket", []);
    const abi = (await hre.artifacts.readArtifact("ForfeitMarket")).abi;
    const proxy = await hre.viem.deployContract("ERC1967Proxy", [
      impl.address,
      encodeFunctionData({ abi, functionName: "initialize", args: [owner.account.address, owner.account.address] }),
    ]);
    const market = await hre.viem.getContractAt("ForfeitMarket", proxy.address);
    await market.write.setApprovedToken([token.address, true]);
    for (const w of [player, stranger]) await token.write.mint([w.account.address, parseEther("100000")]);
    await token.write.approve([market.address, parseEther("100000")], { account: player.account });
    await market.write.createCommitment(
      [token.address, parseEther("1000"), Dest.CommunityPool, zeroAddress, Cad.Daily, 2, Number(DAY), BigInt(await time.latest()) + DAY, zeroAddress, "0x" + "00".repeat(32)],
      { account: player.account },
    );
    return { token, market, player, stranger, keeper, id: 0n };
  }

  it("adds to the stake and records the day's boost", async function () {
    const { market, player, id } = await loadFixture(fixture);
    await market.write.boostCommitment([id, parseEther("500")], { account: player.account });
    expect((await market.read.commitments([id]))[2]).to.equal(parseEther("1500"));
    expect(await market.read.boostedAmount([id, 0])).to.equal(parseEther("500"));
  });

  it("gives the boost back with the stake on a finish", async function () {
    const { token, market, player, id } = await loadFixture(fixture);
    await market.write.boostCommitment([id, parseEther("500")], { account: player.account });
    const before = await token.read.balanceOf([player.account.address]);
    await market.write.resolveCommitmentSuccess([id], { account: player.account });
    await time.increase(Number(DAY));
    await market.write.resolveCommitmentSuccess([id], { account: player.account });
    expect((await token.read.balanceOf([player.account.address])) - before).to.equal(parseEther("1500"));
  });

  it("forfeits the boost with the stake on a miss", async function () {
    const { token, market, player, keeper, id } = await loadFixture(fixture);
    await market.write.boostCommitment([id, parseEther("500")], { account: player.account });
    await time.increase(Number(DAY) + 10);
    await market.write.resolveCommitmentForfeited([id], { account: keeper.account });
    // 1% keeper bounty, no fee on community pool: 99% of 1,500 lands in the pool.
    expect(await market.read.communityPoolBalance([token.address])).to.equal(parseEther("1485"));
  });

  it("refuses strangers, zero, a closed day and an ended goal", async function () {
    const { market, player, stranger, keeper, id } = await loadFixture(fixture);
    await assertRevert(market.write.boostCommitment([id, parseEther("1")], { account: stranger.account }), /Unauthorized/);
    await assertRevert(market.write.boostCommitment([id, 0n], { account: player.account }), /InvalidInput/);
    await market.write.resolveCommitmentSuccess([id], { account: player.account });
    await assertRevert(market.write.boostCommitment([id, parseEther("1")], { account: player.account }), /PeriodNotOpen|PeriodAlreadyResolved|NotOpen/);
    await time.increase(Number(DAY) * 3);
    await market.write.resolveCommitmentForfeited([id], { account: keeper.account });
    await assertRevert(market.write.boostCommitment([id, parseEther("1")], { account: player.account }), /NotActive/);
  });
});
