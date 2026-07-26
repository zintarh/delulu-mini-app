/**
 * ForfeitMarket — UUPS proxy, personal stake-or-lose commitments.
 * Run: npx hardhat test test/ForfeitMarket.js --config hardhat.config.cjs
 */
const { time, loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");
const hre = require("hardhat");
const { parseEther, encodeFunctionData, keccak256, toBytes, zeroAddress } = require("viem");

const ONE_DAY = 86400n;
const BPS_DENOMINATOR = 10000n;
const KEEPER_BOUNTY_BPS = 100n; // 1%
const PROTOCOL_FEE_BPS = 500n; // 5%

// Enum values, matching the Solidity declaration order.
const DestinationType = { SelfReturn: 0, Charity: 1, Friend: 2, CommunityPool: 3 };
const Cadence = { Once: 0, Daily: 1, Weekday: 2, Weekly: 3, Monthly: 4 };

function assertRevert(promise, pattern) {
  return promise.then(
    () => expect.fail("Expected revert"),
    (e) => expect(String(e)).to.match(pattern),
  );
}

describe("ForfeitMarket", function () {
  async function deployFixture() {
    const [owner, creator, friend, charity, stranger, platformFeeRecipient] =
      await hre.viem.getWalletClients();
    const token = await hre.viem.deployContract("MockERC20", ["GoodDollar", "G$", 18]);

    const implementation = await hre.viem.deployContract("ForfeitMarket", []);
    const artifact = await hre.artifacts.readArtifact("ForfeitMarket");
    const initData = encodeFunctionData({
      abi: artifact.abi,
      functionName: "initialize",
      args: [owner.account.address, platformFeeRecipient.account.address],
    });
    const proxy = await hre.viem.deployContract("ERC1967Proxy", [
      implementation.address,
      initData,
    ]);
    const market = await hre.viem.getContractAt("ForfeitMarket", proxy.address);

    const mintAmount = parseEther("1000000");
    for (const user of [owner, creator, friend, charity, stranger]) {
      await token.write.mint([user.account.address, mintAmount]);
    }

    await market.write.setApprovedCharity([charity.account.address, true], {
      account: owner.account,
    });
    await market.write.setApprovedToken([token.address, true], {
      account: owner.account,
    });

    return {
      market,
      token,
      owner,
      creator,
      friend,
      charity,
      stranger,
      platformFeeRecipient,
      proxy,
      implementation,
    };
  }

  async function approveAndCreate(market, token, creator, overrides = {}) {
    const stakeAmount = overrides.stakeAmount ?? parseEther("100");
    await token.write.approve([market.address, stakeAmount], { account: creator.account });

    const deadline = BigInt((await time.latest())) + (overrides.deadlineOffset ?? ONE_DAY);
    const args = [
      overrides.token ?? undefined, // filled below, token address comes from closure
      stakeAmount,
      overrides.destinationType ?? DestinationType.SelfReturn,
      overrides.destinationAddr ?? zeroAddress,
      overrides.cadence ?? Cadence.Once,
      overrides.totalPeriods ?? 1,
      overrides.periodSeconds ?? 0n,
      deadline,
      overrides.verifier ?? zeroAddress,
      overrides.verifierInviteCodeHash ?? `0x${"00".repeat(32)}`,
    ];
    args[0] = token.address;

    await market.write.createCommitment(args, { account: creator.account });
    return { stakeAmount, deadline };
  }

  it("deploys behind UUPS proxy and initializes owner + platform fee address", async function () {
    const { market, owner, platformFeeRecipient } = await loadFixture(deployFixture);
    const contractOwner = await market.read.owner();
    expect(contractOwner.toLowerCase()).to.equal(owner.account.address.toLowerCase());
    const feeAddr = await market.read.platformFeeAddress();
    expect(feeAddr.toLowerCase()).to.equal(platformFeeRecipient.account.address.toLowerCase());
  });

  it("escrows the stake on createCommitment", async function () {
    const { market, token, creator } = await loadFixture(deployFixture);
    const balBefore = await token.read.balanceOf([creator.account.address]);
    const { stakeAmount } = await approveAndCreate(market, token, creator);
    const balAfter = await token.read.balanceOf([creator.account.address]);
    expect(balBefore - balAfter).to.equal(stakeAmount);
    expect(await token.read.balanceOf([market.address])).to.equal(stakeAmount);
  });

  describe("self-verify / AI-gated-self path (no verifier bound)", function () {
    it("lets the creator resolve success and reclaim the stake", async function () {
      const { market, token, creator } = await loadFixture(deployFixture);
      const { stakeAmount } = await approveAndCreate(market, token, creator);

      const balBefore = await token.read.balanceOf([creator.account.address]);
      await market.write.resolveCommitmentSuccess([0n], { account: creator.account });
      const balAfter = await token.read.balanceOf([creator.account.address]);
      expect(balAfter - balBefore).to.equal(stakeAmount);
    });

    it("rejects a stranger resolving success (no AI/self gate bypass on-chain)", async function () {
      const { market, token, creator, stranger } = await loadFixture(deployFixture);
      await approveAndCreate(market, token, creator);
      await assertRevert(
        market.write.resolveCommitmentSuccess([0n], { account: stranger.account }),
        /Unauthorized/,
      );
    });

    it("rejects resolving success after the deadline has passed", async function () {
      const { market, token, creator } = await loadFixture(deployFixture);
      await approveAndCreate(market, token, creator, { deadlineOffset: ONE_DAY });
      await time.increase(ONE_DAY + 1n);
      await assertRevert(
        market.write.resolveCommitmentSuccess([0n], { account: creator.account }),
        /DeadlinePassed/,
      );
    });
  });

  describe("friend-verify path (verifier resolved at creation)", function () {
    it("lets only the named verifier resolve success, not the creator", async function () {
      const { market, token, creator, friend } = await loadFixture(deployFixture);
      await approveAndCreate(market, token, creator, { verifier: friend.account.address });

      await assertRevert(
        market.write.resolveCommitmentSuccess([0n], { account: creator.account }),
        /Unauthorized/,
      );

      const balBefore = await token.read.balanceOf([creator.account.address]);
      await market.write.resolveCommitmentSuccess([0n], { account: friend.account });
      const balAfter = await token.read.balanceOf([creator.account.address]);
      expect(balAfter - balBefore).to.equal(parseEther("100"));
    });
  });

  describe("friend-verify invite flow (friend not yet a user at creation)", function () {
    it("rejects the creator resolving success while the invite is still pending", async function () {
      const { market, token, creator } = await loadFixture(deployFixture);
      const inviteCode = `0x${"33".repeat(32)}`;
      const codeHash = keccak256(inviteCode);

      await approveAndCreate(market, token, creator, { verifierInviteCodeHash: codeHash });

      // Regression test: before the invite is accepted, `verifier` reads as
      // address(0) exactly like true self-verify — the creator must not be able
      // to exploit that to self-approve and bypass friend-verification entirely.
      await assertRevert(
        market.write.resolveCommitmentSuccess([0n], { account: creator.account }),
        /VerifierInvitePending/,
      );
    });

    it("binds the invited wallet as verifier via acceptVerifierInvite", async function () {
      const { market, token, creator, friend, stranger } = await loadFixture(deployFixture);
      const inviteCode = `0x${"11".repeat(32)}`;
      const codeHash = keccak256(inviteCode);

      await approveAndCreate(market, token, creator, { verifierInviteCodeHash: codeHash });

      await assertRevert(
        market.write.acceptVerifierInvite([0n, `0x${"22".repeat(32)}`], {
          account: friend.account,
        }),
        /InvalidInviteCode/,
      );

      await market.write.acceptVerifierInvite([0n, inviteCode], { account: friend.account });
      const [, , , , , , , , , , verifier] = await market.read.commitments([0n]);
      expect(verifier.toLowerCase()).to.equal(friend.account.address.toLowerCase());

      // A stranger can no longer claim the role once it's bound.
      await assertRevert(
        market.write.acceptVerifierInvite([0n, inviteCode], { account: stranger.account }),
        /VerifierAlreadySet/,
      );

      // Only the now-bound friend can resolve success, not the creator.
      await assertRevert(
        market.write.resolveCommitmentSuccess([0n], { account: creator.account }),
        /Unauthorized/,
      );
      await market.write.resolveCommitmentSuccess([0n], { account: friend.account });
    });
  });

  describe("permissionless forfeiture", function () {
    it("reverts before the deadline has passed", async function () {
      const { market, token, creator, stranger } = await loadFixture(deployFixture);
      await approveAndCreate(market, token, creator);
      await assertRevert(
        market.write.resolveCommitmentForfeited([0n], { account: stranger.account }),
        /DeadlineNotPassed/,
      );
    });

    it("pays the keeper bounty and the platform fee, then routes the remainder to a Friend destination", async function () {
      const { market, token, creator, friend, stranger, platformFeeRecipient } =
        await loadFixture(deployFixture);
      const { stakeAmount } = await approveAndCreate(market, token, creator, {
        destinationType: DestinationType.Friend,
        destinationAddr: friend.account.address,
      });
      await time.increase(ONE_DAY + 1n);

      const bounty = (stakeAmount * KEEPER_BOUNTY_BPS) / BPS_DENOMINATOR;
      const fee = (stakeAmount * PROTOCOL_FEE_BPS) / BPS_DENOMINATOR;
      const remainder = stakeAmount - bounty - fee;

      const keeperBalBefore = await token.read.balanceOf([stranger.account.address]);
      const feeBalBefore = await token.read.balanceOf([platformFeeRecipient.account.address]);
      const friendBalBefore = await token.read.balanceOf([friend.account.address]);

      await market.write.resolveCommitmentForfeited([0n], { account: stranger.account });

      expect(
        (await token.read.balanceOf([stranger.account.address])) - keeperBalBefore,
      ).to.equal(bounty);
      expect(
        (await token.read.balanceOf([platformFeeRecipient.account.address])) - feeBalBefore,
      ).to.equal(fee);
      expect((await token.read.balanceOf([friend.account.address])) - friendBalBefore).to.equal(
        remainder,
      );
    });

    it("routes the remainder to an approved Charity destination", async function () {
      const { market, token, creator, charity, stranger } = await loadFixture(deployFixture);
      const { stakeAmount } = await approveAndCreate(market, token, creator, {
        destinationType: DestinationType.Charity,
        destinationAddr: charity.account.address,
      });
      await time.increase(ONE_DAY + 1n);

      const bounty = (stakeAmount * KEEPER_BOUNTY_BPS) / BPS_DENOMINATOR;
      const fee = (stakeAmount * PROTOCOL_FEE_BPS) / BPS_DENOMINATOR;
      const remainder = stakeAmount - bounty - fee;

      const balBefore = await token.read.balanceOf([charity.account.address]);
      await market.write.resolveCommitmentForfeited([0n], { account: stranger.account });
      const balAfter = await token.read.balanceOf([charity.account.address]);
      expect(balAfter - balBefore).to.equal(remainder);
    });

    it("accrues the remainder to communityPoolBalance for CommunityPool destination, waiving the platform fee", async function () {
      const { market, token, creator, stranger } = await loadFixture(deployFixture);
      const { stakeAmount } = await approveAndCreate(market, token, creator, {
        destinationType: DestinationType.CommunityPool,
      });
      await time.increase(ONE_DAY + 1n);

      const bounty = (stakeAmount * KEEPER_BOUNTY_BPS) / BPS_DENOMINATOR;
      const remainder = stakeAmount - bounty; // no platform fee on pool-destined forfeits

      await market.write.resolveCommitmentForfeited([0n], { account: stranger.account });
      expect(await market.read.communityPoolBalance([token.address])).to.equal(remainder);
    });

    it("rejects creating a Charity commitment against a non-approved address", async function () {
      const { market, token, creator, stranger } = await loadFixture(deployFixture);
      await token.write.approve([market.address, parseEther("100")], {
        account: creator.account,
      });
      const deadline = BigInt(await time.latest()) + ONE_DAY;
      await assertRevert(
        market.write.createCommitment(
          [
            token.address,
            parseEther("100"),
            DestinationType.Charity,
            stranger.account.address,
            Cadence.Once,
            1,
            0n,
            deadline,
            zeroAddress,
            `0x${"00".repeat(32)}`,
          ],
          { account: creator.account },
        ),
        /CharityNotApproved/,
      );
    });

    it("ends the whole commitment on a single forfeited period, even mid a repeating schedule", async function () {
      const { market, token, creator, stranger } = await loadFixture(deployFixture);
      await approveAndCreate(market, token, creator, {
        cadence: Cadence.Daily,
        totalPeriods: 5,
        periodSeconds: ONE_DAY,
      });
      await time.increase(ONE_DAY + 1n);
      await market.write.resolveCommitmentForfeited([0n], { account: stranger.account });

      const state = await market.read.getCommitmentState([0n]);
      expect(state).to.equal("ENDED");
      await assertRevert(
        market.write.resolveCommitmentForfeited([0n], { account: stranger.account }),
        /NotActive/,
      );
    });
  });

  describe("repeat-cadence rollover", function () {
    it("keeps the stake escrowed across intermediate period successes and only pays out on the final one", async function () {
      const { market, token, creator } = await loadFixture(deployFixture);
      const { stakeAmount } = await approveAndCreate(market, token, creator, {
        cadence: Cadence.Daily,
        totalPeriods: 2,
        periodSeconds: ONE_DAY,
      });

      const balAfterCreate = await token.read.balanceOf([creator.account.address]);
      await market.write.resolveCommitmentSuccess([0n], { account: creator.account });
      // Intermediate period: stake stays in the contract, nothing paid out yet.
      expect(await token.read.balanceOf([creator.account.address])).to.equal(balAfterCreate);
      expect(await token.read.balanceOf([market.address])).to.equal(stakeAmount);

      await time.increase(ONE_DAY);
      await market.write.resolveCommitmentSuccess([0n], { account: creator.account });
      // Final period: full stake returns.
      expect(await token.read.balanceOf([creator.account.address])).to.equal(
        balAfterCreate + stakeAmount,
      );

      const state = await market.read.getCommitmentState([0n]);
      expect(state).to.equal("ENDED");
    });
  });

  describe("cancelCommitment", function () {
    it("refunds the full stake to the creator before the deadline", async function () {
      const { market, token, creator } = await loadFixture(deployFixture);
      const { stakeAmount } = await approveAndCreate(market, token, creator);
      const balBefore = await token.read.balanceOf([creator.account.address]);
      await market.write.cancelCommitment([0n], { account: creator.account });
      const balAfter = await token.read.balanceOf([creator.account.address]);
      expect(balAfter - balBefore).to.equal(stakeAmount);
      expect(await market.read.getCommitmentState([0n])).to.equal("CANCELLED");
    });

    it("rejects cancelling after the deadline has passed (must resolve as forfeited instead)", async function () {
      const { market, token, creator } = await loadFixture(deployFixture);
      await approveAndCreate(market, token, creator, { deadlineOffset: ONE_DAY });
      await time.increase(ONE_DAY + 1n);
      await assertRevert(
        market.write.cancelCommitment([0n], { account: creator.account }),
        /DeadlinePassed/,
      );
    });

    it("rejects a non-creator cancelling", async function () {
      const { market, token, creator, stranger } = await loadFixture(deployFixture);
      await approveAndCreate(market, token, creator);
      await assertRevert(
        market.write.cancelCommitment([0n], { account: stranger.account }),
        /Unauthorized/,
      );
    });
  });

  describe("minimum stake", function () {
    it("rejects a commitment below the configured minimum for that token", async function () {
      const { market, token, owner, creator } = await loadFixture(deployFixture);
      await market.write.setMinStake([token.address, parseEther("10")], {
        account: owner.account,
      });
      await token.write.approve([market.address, parseEther("5")], { account: creator.account });
      const deadline = BigInt(await time.latest()) + ONE_DAY;
      await assertRevert(
        market.write.createCommitment(
          [
            token.address,
            parseEther("5"),
            DestinationType.SelfReturn,
            zeroAddress,
            Cadence.Once,
            1,
            0n,
            deadline,
            zeroAddress,
            `0x${"00".repeat(32)}`,
          ],
          { account: creator.account },
        ),
        /StakeBelowMinimum/,
      );
    });
  });

  describe("token allowlist", function () {
    it("rejects creating a commitment with a non-approved token", async function () {
      const { market, creator } = await loadFixture(deployFixture);
      const otherToken = await hre.viem.deployContract("MockERC20", ["Other", "OTH", 18]);
      await otherToken.write.mint([creator.account.address, parseEther("1000")]);
      await otherToken.write.approve([market.address, parseEther("100")], {
        account: creator.account,
      });
      const deadline = BigInt(await time.latest()) + ONE_DAY;
      await assertRevert(
        market.write.createCommitment(
          [
            otherToken.address,
            parseEther("100"),
            DestinationType.SelfReturn,
            zeroAddress,
            Cadence.Once,
            1,
            0n,
            deadline,
            zeroAddress,
            `0x${"00".repeat(32)}`,
          ],
          { account: creator.account },
        ),
        /TokenNotApproved/,
      );
    });
  });

  describe("pausing", function () {
    it("blocks new commitments while paused, but not resolving an existing one", async function () {
      const { market, token, owner, creator } = await loadFixture(deployFixture);
      const { stakeAmount, deadline } = await approveAndCreate(market, token, creator);

      await market.write.pause({ account: owner.account });

      await token.write.approve([market.address, parseEther("100")], { account: creator.account });
      await assertRevert(
        market.write.createCommitment(
          [
            token.address,
            parseEther("100"),
            DestinationType.SelfReturn,
            zeroAddress,
            Cadence.Once,
            1,
            0n,
            deadline + ONE_DAY,
            zeroAddress,
            `0x${"00".repeat(32)}`,
          ],
          { account: creator.account },
        ),
        /EnforcedPause/,
      );

      // Existing commitment can still be resolved normally while paused.
      const balBefore = await token.read.balanceOf([creator.account.address]);
      await market.write.resolveCommitmentSuccess([0n], { account: creator.account });
      const balAfter = await token.read.balanceOf([creator.account.address]);
      expect(balAfter - balBefore).to.equal(stakeAmount);
    });

    it("rejects a non-owner pausing", async function () {
      const { market, creator } = await loadFixture(deployFixture);
      await assertRevert(
        market.write.pause({ account: creator.account }),
        /OwnableUnauthorizedAccount/,
      );
    });
  });

  describe("revokeVerifierInvite", function () {
    it("lets the creator rebind a hijacked/pending invite to a new verifier wallet", async function () {
      const { market, token, creator, friend, stranger } = await loadFixture(deployFixture);
      const inviteCode = `0x${"44".repeat(32)}`;
      const codeHash = keccak256(inviteCode);
      await approveAndCreate(market, token, creator, { verifierInviteCodeHash: codeHash });

      // Someone other than the intended friend claims the role first (front-run).
      await market.write.acceptVerifierInvite([0n, inviteCode], { account: stranger.account });
      const [, , , , , , , , , , hijackedVerifier] = await market.read.commitments([0n]);
      expect(hijackedVerifier.toLowerCase()).to.equal(stranger.account.address.toLowerCase());

      // Creator rebinds directly to the friend's now-known wallet.
      await market.write.revokeVerifierInvite(
        [0n, friend.account.address, `0x${"00".repeat(32)}`],
        { account: creator.account },
      );
      const [, , , , , , , , , , newVerifier] = await market.read.commitments([0n]);
      expect(newVerifier.toLowerCase()).to.equal(friend.account.address.toLowerCase());

      // The original hijacker can no longer act as verifier.
      await assertRevert(
        market.write.resolveCommitmentSuccess([0n], { account: stranger.account }),
        /Unauthorized/,
      );
      // The friend now can.
      await market.write.resolveCommitmentSuccess([0n], { account: friend.account });
    });

    it("rejects a non-creator revoking", async function () {
      const { market, token, creator, friend, stranger } = await loadFixture(deployFixture);
      await approveAndCreate(market, token, creator, { verifier: friend.account.address });
      await assertRevert(
        market.write.revokeVerifierInvite(
          [0n, stranger.account.address, `0x${"00".repeat(32)}`],
          { account: stranger.account },
        ),
        /Unauthorized/,
      );
    });

    it("cannot be used to downgrade a friend-verify commitment to self-verify", async function () {
      const { market, token, creator, friend } = await loadFixture(deployFixture);
      await approveAndCreate(market, token, creator, { verifier: friend.account.address });
      await assertRevert(
        market.write.revokeVerifierInvite([0n, zeroAddress, `0x${"00".repeat(32)}`], {
          account: creator.account,
        }),
        /InvalidInput/,
      );
    });
  });

  describe("forfeiture destination fallback", function () {
    it("routes the remainder to the community pool if the Friend destination is blacklisted by the token", async function () {
      const { market, token, creator, friend, stranger } = await loadFixture(deployFixture);
      const { stakeAmount } = await approveAndCreate(market, token, creator, {
        destinationType: DestinationType.Friend,
        destinationAddr: friend.account.address,
      });
      await token.write.setBlacklisted([friend.account.address, true]);
      await time.increase(ONE_DAY + 1n);

      const bounty = (stakeAmount * KEEPER_BOUNTY_BPS) / BPS_DENOMINATOR;
      const fee = (stakeAmount * PROTOCOL_FEE_BPS) / BPS_DENOMINATOR;
      const remainder = stakeAmount - bounty - fee;

      const keeperBalBefore = await token.read.balanceOf([stranger.account.address]);
      const friendBalBefore = await token.read.balanceOf([friend.account.address]);
      // Must not revert even though the intended destination can't receive funds.
      await market.write.resolveCommitmentForfeited([0n], { account: stranger.account });

      expect(
        (await token.read.balanceOf([stranger.account.address])) - keeperBalBefore,
      ).to.equal(bounty);
      expect(await token.read.balanceOf([friend.account.address])).to.equal(friendBalBefore);
      expect(await market.read.communityPoolBalance([token.address])).to.equal(remainder);
    });
  });

  it("owner can upgrade implementation without losing state", async function () {
    const { market, token, creator, owner, proxy } = await loadFixture(deployFixture);
    await approveAndCreate(market, token, creator);

    const implementationV2 = await hre.viem.deployContract("ForfeitMarket", []);
    await market.write.upgradeToAndCall([implementationV2.address, "0x"], {
      account: owner.account,
    });

    const marketV2 = await hre.viem.getContractAt("ForfeitMarket", proxy.address);
    const [creatorAfter] = await marketV2.read.commitments([0n]);
    expect(creatorAfter.toLowerCase()).to.equal(creator.account.address.toLowerCase());
  });
});
