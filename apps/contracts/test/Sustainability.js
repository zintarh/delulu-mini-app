/**
 * Sustainability v3 — ForfeitMarket ⇄ RewardVault: players' missed stakes fund rewards,
 * players spend/cheer G$, stake credit and rollover stake from the vault, and the
 * vault's sustainability() reports the player-funded share on-chain.
 * Run: npx hardhat test test/Sustainability.js --config hardhat.config.cjs
 */
const { time, loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");
const hre = require("hardhat");
const { parseEther, encodeFunctionData, keccak256, toHex, zeroAddress } = require("viem");

const DAY = 86400n;
const Dest = { SelfReturn: 0, Charity: 1, Friend: 2, CommunityPool: 3 };
const Cad = { Once: 0, Daily: 1 };
const SRC = { TEAM: 0, FORFEITS: 1, PURCHASES: 2, SPONSOR: 3 };
const rid = (s) => keccak256(toHex(s));

function assertRevert(promise, pattern) {
  return promise.then(
    () => expect.fail("Expected revert"),
    (e) => expect(String(e)).to.match(pattern),
  );
}

describe("Sustainability v3", function () {
  async function fixture() {
    const [owner, player, other, treasury, keeper, stranger] = await hre.viem.getWalletClients();
    const token = await hre.viem.deployContract("MockERC20", ["GoodDollar", "G$", 18]);

    const fmImpl = await hre.viem.deployContract("ForfeitMarket", []);
    const fmAbi = (await hre.artifacts.readArtifact("ForfeitMarket")).abi;
    const fmProxy = await hre.viem.deployContract("ERC1967Proxy", [
      fmImpl.address,
      encodeFunctionData({ abi: fmAbi, functionName: "initialize", args: [owner.account.address, treasury.account.address] }),
    ]);
    const market = await hre.viem.getContractAt("ForfeitMarket", fmProxy.address);

    const rvImpl = await hre.viem.deployContract("RewardVault", []);
    const rvAbi = (await hre.artifacts.readArtifact("RewardVault")).abi;
    const rvProxy = await hre.viem.deployContract("ERC1967Proxy", [
      rvImpl.address,
      encodeFunctionData({ abi: rvAbi, functionName: "initialize", args: [owner.account.address] }),
    ]);
    const vault = await hre.viem.getContractAt("RewardVault", rvProxy.address);

    await market.write.setApprovedToken([token.address, true]);
    await market.write.setRewardVault([vault.address]);
    await vault.write.initializeV3([treasury.account.address, market.address, 2000, 500]);

    for (const w of [owner, player, other, stranger]) await token.write.mint([w.account.address, parseEther("1000000")]);
    return { token, market, vault, owner, player, other, treasury, keeper, stranger };
  }

  /** A daily community-pool goal the player then misses, so its stake lands in the pool. */
  async function missedStake(f, amount = parseEther("10000")) {
    const { token, market, player, keeper } = f;
    await token.write.approve([market.address, amount], { account: player.account });
    const deadline = BigInt(await time.latest()) + DAY;
    await market.write.createCommitment(
      [token.address, amount, Dest.CommunityPool, zeroAddress, Cad.Daily, 3, Number(DAY), deadline, zeroAddress, "0x" + "00".repeat(32)],
      { account: player.account },
    );
    const id = (await market.read.nextCommitmentId()) - 1n;
    await time.increase(Number(DAY) + 10);
    await market.write.resolveCommitmentForfeited([id], { account: keeper.account });
    return id;
  }

  describe("missed stakes fund rewards", function () {
    it("sweeps the community pool into the vault, 80% to the pot and 20% to Delulu", async function () {
      const f = await loadFixture(fixture);
      const { token, market, vault, treasury, stranger } = f;
      await missedStake(f);
      const pool = await market.read.communityPoolBalance([token.address]);
      expect(pool).to.equal(parseEther("9900")); // 10,000 minus the 1% keeper bounty, no fee on community pool

      const treasuryBefore = await token.read.balanceOf([treasury.account.address]);
      // Anyone can trigger it; the money can only go to the vault.
      await market.write.sweepCommunityPoolToVault([token.address, pool], { account: stranger.account });

      expect(await market.read.communityPoolBalance([token.address])).to.equal(0n);
      expect(await market.read.sweptToVaultByToken([token.address])).to.equal(pool);
      expect(await vault.read.availableBalance([token.address])).to.equal(parseEther("7920"));
      expect((await token.read.balanceOf([treasury.account.address])) - treasuryBefore).to.equal(parseEther("1980"));
      expect(await vault.read.fundedBySource([token.address, SRC.FORFEITS])).to.equal(parseEther("7920"));
      expect(await vault.read.deluluRevenueByToken([token.address])).to.equal(parseEther("1980"));
    });

    it("can't sweep more than the pool holds, or before the vault is set", async function () {
      const f = await loadFixture(fixture);
      await missedStake(f);
      const pool = await f.market.read.communityPoolBalance([f.token.address]);
      await assertRevert(f.market.write.sweepCommunityPoolToVault([f.token.address, pool + 1n]), /InvalidInput/);
      await f.market.write.setRewardVault([zeroAddress]);
      await assertRevert(f.market.write.sweepCommunityPoolToVault([f.token.address, pool]), /RewardVaultNotSet/);
    });

    it("only an approved forfeit contract can fund as player money", async function () {
      const { token, vault, stranger } = await loadFixture(fixture);
      await token.write.approve([vault.address, parseEther("100")], { account: stranger.account });
      await assertRevert(vault.write.fundPoolFrom([token.address, parseEther("100"), SRC.FORFEITS], { account: stranger.account }), /NotForfeitSource/);
      await assertRevert(vault.write.fundPoolFrom([token.address, parseEther("100"), SRC.PURCHASES], { account: stranger.account }), /InvalidInput/);
    });

    it("team and sponsor top-ups are labelled; plain fundPool counts as team", async function () {
      const { token, vault, owner, stranger } = await loadFixture(fixture);
      await token.write.approve([vault.address, parseEther("300")]);
      await vault.write.fundPool([token.address, parseEther("100")]);
      await vault.write.fundPoolFrom([token.address, parseEther("200"), SRC.TEAM]);
      await token.write.approve([vault.address, parseEther("50")], { account: stranger.account });
      await vault.write.fundPoolFrom([token.address, parseEther("50"), SRC.SPONSOR], { account: stranger.account });
      expect(await vault.read.fundedBySource([token.address, SRC.TEAM])).to.equal(parseEther("300"));
      expect(await vault.read.fundedBySource([token.address, SRC.SPONSOR])).to.equal(parseEther("50"));
      expect(owner).to.exist;
    });
  });

  describe("players spend G$", function () {
    it("a purchase goes entirely to the pot as player money", async function () {
      const { token, vault, player } = await loadFixture(fixture);
      await token.write.approve([vault.address, parseEther("500")], { account: player.account });
      await vault.write.purchase([token.address, parseEther("500"), rid("STREAK_FREEZE"), rid("goal-1")], { account: player.account });
      expect(await vault.read.fundedBySource([token.address, SRC.PURCHASES])).to.equal(parseEther("500"));
      expect(await vault.read.availableBalance([token.address])).to.equal(parseEther("500"));
    });

    it("a cheer pays the other player 95% (claimable) and the pot 5%", async function () {
      const { token, vault, player, other } = await loadFixture(fixture);
      await token.write.approve([vault.address, parseEther("200")], { account: player.account });
      await vault.write.cheer([other.account.address, token.address, parseEther("200"), rid("proof-9")], { account: player.account });
      expect(await vault.read.pendingReward([other.account.address, token.address])).to.equal(parseEther("190"));
      expect(await vault.read.fundedBySource([token.address, SRC.PURCHASES])).to.equal(parseEther("10"));
      const before = await token.read.balanceOf([other.account.address]);
      await vault.write.claimReward([token.address], { account: other.account });
      expect((await token.read.balanceOf([other.account.address])) - before).to.equal(parseEther("190"));
    });

    it("can't cheer yourself", async function () {
      const { token, vault, player } = await loadFixture(fixture);
      await token.write.approve([vault.address, parseEther("10")], { account: player.account });
      await assertRevert(vault.write.cheer([player.account.address, token.address, parseEther("10"), rid("x")], { account: player.account }), /InvalidInput/);
    });
  });

  describe("stake credit and rollover", function () {
    async function funded() {
      const f = await fixture();
      await f.token.write.approve([f.vault.address, parseEther("50000")]);
      await f.vault.write.fundPool([f.token.address, parseEther("50000")]);
      return f;
    }
    const goal = async (token, amount, useRewards) => [
      token, amount, useRewards, Dest.CommunityPool, zeroAddress, Cad.Daily, 7, Number(DAY), BigInt(await time.latest()) + DAY, zeroAddress,
    ];

    it("stake credit can be staked, never claimed, and is reserved from the pool", async function () {
      const { token, vault, market, player } = await loadFixture(funded);
      await vault.write.grantStakeCredit([player.account.address, token.address, parseEther("5000"), rid("gift")]);
      expect(await vault.read.stakeCredit([player.account.address, token.address])).to.equal(parseEther("5000"));
      expect(await vault.read.availableBalance([token.address])).to.equal(parseEther("45000"));
      await assertRevert(vault.write.claimReward([token.address], { account: player.account }), /NothingToClaim/);

      await vault.write.stakeFromVault(await goal(token.address, parseEther("5000"), false), { account: player.account });
      const id = (await market.read.nextCommitmentId()) - 1n;
      const c = await market.read.commitments([id]);
      expect(c[0].toLowerCase()).to.equal(player.account.address.toLowerCase()); // the player owns the goal
      expect(c[2]).to.equal(parseEther("5000"));
      expect(await vault.read.stakeCredit([player.account.address, token.address])).to.equal(0n);
      expect(await token.read.balanceOf([market.address])).to.equal(parseEther("5000"));
    });

    it("rollover restakes unclaimed rewards and counts them", async function () {
      const { token, vault, player } = await loadFixture(funded);
      await vault.write.creditReward([player.account.address, token.address, parseEther("3000"), rid("cashback")]);
      await vault.write.stakeFromVault(await goal(token.address, parseEther("3000"), true), { account: player.account });
      expect(await vault.read.pendingReward([player.account.address, token.address])).to.equal(0n);
      expect(await vault.read.rolledOverByToken([token.address])).to.equal(parseEther("3000"));
    });

    it("uses credit first, then rewards, then the wallet for the rest", async function () {
      const { token, vault, market, player } = await loadFixture(funded);
      await vault.write.grantStakeCredit([player.account.address, token.address, parseEther("2000"), rid("ref")]);
      await vault.write.creditReward([player.account.address, token.address, parseEther("1000"), rid("r1")]);
      // 4,000 = 2,000 credit + 1,000 rewards + 1,000 wallet; without an approval the wallet part fails.
      await assertRevert(vault.write.stakeFromVault(await goal(token.address, parseEther("4000"), true), { account: player.account }), /allowance|ERC20InsufficientAllowance|0xfb8f41b2/i);
      await token.write.approve([vault.address, parseEther("1000")], { account: player.account });
      const walletBefore = await token.read.balanceOf([player.account.address]);
      await vault.write.stakeFromVault(await goal(token.address, parseEther("4000"), true), { account: player.account });
      expect(walletBefore - (await token.read.balanceOf([player.account.address]))).to.equal(parseEther("1000"));
      expect(await vault.read.stakeCredit([player.account.address, token.address])).to.equal(0n);
      expect(await vault.read.pendingReward([player.account.address, token.address])).to.equal(0n);
      const c = await market.read.commitments([(await market.read.nextCommitmentId()) - 1n]);
      expect(c[2]).to.equal(parseEther("4000"));
    });

    it("refuses when nothing comes from the vault (stake directly instead)", async function () {
      const { token, vault, player } = await loadFixture(funded);
      await vault.write.creditReward([player.account.address, token.address, parseEther("1000"), rid("r2")]);
      await assertRevert(vault.write.stakeFromVault(await goal(token.address, parseEther("3000"), false), { account: player.account }), /InsufficientStakeFunds/);
    });

    it("only the vault can stake on someone's behalf", async function () {
      const { token, market, stranger, player } = await loadFixture(funded);
      await assertRevert(
        market.write.createCommitmentFor(
          [player.account.address, token.address, parseEther("100"), Dest.CommunityPool, zeroAddress, Cad.Daily, 3, Number(DAY), BigInt(await time.latest()) + DAY, zeroAddress],
          { account: stranger.account },
        ),
        /Unauthorized/,
      );
    });

    it("a goal staked from the vault pays the player back on success", async function () {
      const { token, vault, market, player } = await loadFixture(funded);
      await vault.write.grantStakeCredit([player.account.address, token.address, parseEther("1000"), rid("g")]);
      await vault.write.stakeFromVault(
        [token.address, parseEther("1000"), false, Dest.CommunityPool, zeroAddress, Cad.Once, 1, 0, BigInt(await time.latest()) + DAY, zeroAddress],
        { account: player.account },
      );
      const id = (await market.read.nextCommitmentId()) - 1n;
      await market.write.submitProof([id, "ipfs://proof"], { account: player.account });
      const before = await token.read.balanceOf([player.account.address]);
      await market.write.resolveCommitmentSuccess([id], { account: player.account });
      expect((await token.read.balanceOf([player.account.address])) - before).to.equal(parseEther("1000"));
    });
  });

  describe("sustainability()", function () {
    it("reports the player-funded share of the pool", async function () {
      const f = await loadFixture(fixture);
      const { token, market, vault, player } = f;
      await missedStake(f, parseEther("10000"));
      await market.write.sweepCommunityPoolToVault([token.address, await market.read.communityPoolBalance([token.address])]);
      await token.write.approve([vault.address, parseEther("500")], { account: player.account });
      await vault.write.purchase([token.address, parseEther("500"), rid("FRESH_CARD"), rid("c")], { account: player.account });
      await token.write.approve([vault.address, parseEther("2000")]);
      await vault.write.fundPool([token.address, parseEther("2000")]);

      const [forfeits, purchases, team, sponsor, granted, rolled, revenue, bps] = await vault.read.sustainability([token.address]);
      expect(forfeits).to.equal(parseEther("7920"));
      expect(purchases).to.equal(parseEther("500"));
      expect(team).to.equal(parseEther("2000"));
      expect(sponsor).to.equal(0n);
      expect(granted).to.equal(0n);
      expect(rolled).to.equal(0n);
      expect(revenue).to.equal(parseEther("1980"));
      // (7,920 + 500) / 10,420 = 80.80%
      expect(bps).to.equal((parseEther("8420") * 10000n) / parseEther("10420"));
    });

    it("limits Delulu's share and the cheer fee", async function () {
      const { vault, treasury, market } = await loadFixture(fixture);
      await assertRevert(vault.write.setSustainabilityConfig([treasury.account.address, 3001, 500, market.address]), /InvalidInput/);
      await assertRevert(vault.write.setSustainabilityConfig([treasury.account.address, 2000, 1001, market.address]), /InvalidInput/);
    });

    it("initializeV3 runs once and only for the owner", async function () {
      const { vault, treasury, market, stranger } = await loadFixture(fixture);
      await assertRevert(vault.write.initializeV3([treasury.account.address, market.address, 2000, 500]), /InvalidInitialization|0xf92ee8a9/);
      await assertRevert(vault.write.setSustainabilityConfig([treasury.account.address, 2000, 500, market.address], { account: stranger.account }), /OwnableUnauthorizedAccount|0x118cdaa7/);
      expect(stranger).to.exist;
    });
  });
});
