/**
 * ForfeitMarket — Daily Boost (boostCommitment).
 * Run: npx hardhat test test/DailyBoost.js --config hardhat.config.cjs
 */
const { time, loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");
const hre = require("hardhat");
const { parseEther, encodeFunctionData, zeroAddress } = require("viem");

const ONE_DAY = 86400n;
const DestinationType = { SelfReturn: 0, Charity: 1, Friend: 2, CommunityPool: 3 };
const Cadence = { Once: 0, Daily: 1 };

describe("ForfeitMarket · Daily Boost", function () {
  async function fixture() {
    const [owner, creator, stranger, platform] = await hre.viem.getWalletClients();
    const token = await hre.viem.deployContract("MockERC20", ["GoodDollar", "G$", 18]);
    const impl = await hre.viem.deployContract("ForfeitMarket", []);
    const artifact = await hre.artifacts.readArtifact("ForfeitMarket");
    const init = encodeFunctionData({ abi: artifact.abi, functionName: "initialize", args: [owner.account.address, platform.account.address] });
    const proxy = await hre.viem.deployContract("ERC1967Proxy", [impl.address, init]);
    const market = await hre.viem.getContractAt("ForfeitMarket", proxy.address);
    for (const u of [creator, stranger]) await token.write.mint([u.account.address, parseEther("1000000")]);
    await market.write.setApprovedToken([token.address, true], { account: owner.account });
    // Creator approves generously once: stake + boosts.
    await token.write.approve([market.address, parseEther("1000000")], { account: creator.account });
    await token.write.approve([market.address, parseEther("1000000")], { account: stranger.account });
    return { market, token, creator, stranger };
  }

  async function create(market, token, creator, { stake = parseEther("3000"), periods = 3, destination = DestinationType.CommunityPool } = {}) {
    const deadline = BigInt(await time.latest()) + ONE_DAY;
    await market.write.createCommitment(
      [token.address, stake, destination, zeroAddress, Cadence.Daily, periods, ONE_DAY, deadline, zeroAddress, `0x${"00".repeat(32)}`],
      { account: creator.account },
    );
    return { stake };
  }

  it("adds to the stake, records the period's boost and emits the event", async function () {
    const { market, token, creator } = await loadFixture(fixture);
    const { stake } = await create(market, token, creator);
    await market.write.boostCommitment([0n, parseEther("1000")], { account: creator.account });
    await market.write.boostCommitment([0n, parseEther("200")], { account: creator.account });
    const c = await market.read.commitments([0n]);
    expect(c[2]).to.equal(stake + parseEther("1200"));
    expect(await market.read.boostedAmount([0n, 0])).to.equal(parseEther("1200"));
    const events = await market.getEvents.CommitmentBoosted();
    expect(events.length).to.equal(1); // latest block's event
    expect(events[0].args.newStakeAmount).to.equal(stake + parseEther("1200"));
  });

  it("returns the whole boosted pot on success", async function () {
    const { market, token, creator } = await loadFixture(fixture);
    const { stake } = await create(market, token, creator, { periods: 2 });
    const start = await token.read.balanceOf([creator.account.address]);
    await market.write.boostCommitment([0n, parseEther("500")], { account: creator.account });
    await market.write.resolveCommitmentSuccess([0n], { account: creator.account });
    await time.increase(ONE_DAY);
    // Day 2 boost, then finish.
    await market.write.boostCommitment([0n, parseEther("700")], { account: creator.account });
    expect(await market.read.boostedAmount([0n, 1])).to.equal(parseEther("700"));
    await market.write.resolveCommitmentSuccess([0n], { account: creator.account });
    // Everything staked and boosted comes back.
    expect(await token.read.balanceOf([creator.account.address])).to.equal(start + stake);
  });

  it("forfeits the boosts with the stake on a miss", async function () {
    const { market, token, creator, stranger } = await loadFixture(fixture);
    const { stake } = await create(market, token, creator);
    await market.write.boostCommitment([0n, parseEther("1000")], { account: creator.account });
    await time.increase(ONE_DAY + 1n);
    await market.write.resolveCommitmentForfeited([0n], { account: stranger.account });
    // Pool gets stake + boost minus the 1% keeper bounty (no fee for CommunityPool).
    const pot = stake + parseEther("1000");
    expect(await market.read.communityPoolBalance([token.address])).to.equal(pot - pot / 100n);
  });

  it("refuses a boost once today is resolved (no risk-free boosting after the photo)", async function () {
    const { market, token, creator } = await loadFixture(fixture);
    await create(market, token, creator, { periods: 2 });
    await time.increase(ONE_DAY - 600n);
    await market.write.resolveCommitmentSuccess([0n], { account: creator.account });
    // Day 2 hasn't opened yet: the next period can't be boosted early either.
    await expect(market.write.boostCommitment([0n, parseEther("1")], { account: creator.account })).to.be.rejectedWith("PeriodNotOpen");
  });

  it("refuses after the deadline, from a stranger, of 0, on a word pledge, and after the end", async function () {
    const { market, token, creator, stranger } = await loadFixture(fixture);
    await create(market, token, creator, { periods: 1 });
    await expect(market.write.boostCommitment([0n, parseEther("1")], { account: stranger.account })).to.be.rejectedWith("Unauthorized");
    await expect(market.write.boostCommitment([0n, 0n], { account: creator.account })).to.be.rejectedWith("InvalidInput");
    await market.write.resolveCommitmentSuccess([0n], { account: creator.account });
    await expect(market.write.boostCommitment([0n, parseEther("1")], { account: creator.account })).to.be.rejectedWith("NotActive");

    await create(market, token, creator, { stake: 0n, destination: DestinationType.SelfReturn });
    await expect(market.write.boostCommitment([1n, parseEther("1")], { account: creator.account })).to.be.rejectedWith("InvalidInput");

    await create(market, token, creator);
    await time.increase(ONE_DAY + 1n);
    await expect(market.write.boostCommitment([2n, parseEther("1")], { account: creator.account })).to.be.rejectedWith("DeadlinePassed");
  });
});
