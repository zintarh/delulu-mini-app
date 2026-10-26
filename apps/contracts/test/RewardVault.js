/**
 * RewardVault — UUPS proxy, admin-granted / user-claimed rewards.
 * Run: npx hardhat test test/RewardVault.js --config hardhat.config.cjs
 */
const { time, loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");
const hre = require("hardhat");
const { parseEther, encodeFunctionData, keccak256, toHex } = require("viem");

function assertRevert(promise, pattern) {
  return promise.then(
    () => expect.fail("Expected revert"),
    (e) => expect(String(e)).to.match(pattern),
  );
}

const rid = (s) => keccak256(toHex(s));

describe("RewardVault", function () {
  async function deployFixture() {
    const [owner, rewarder, user, funder, stranger] = await hre.viem.getWalletClients();
    const token = await hre.viem.deployContract("MockERC20", ["GoodDollar", "G$", 18]);

    const implementation = await hre.viem.deployContract("RewardVault", []);
    const artifact = await hre.artifacts.readArtifact("RewardVault");
    const initData = encodeFunctionData({
      abi: artifact.abi,
      functionName: "initialize",
      args: [rewarder.account.address],
    });
    const proxy = await hre.viem.deployContract("ERC1967Proxy", [implementation.address, initData]);
    const vault = await hre.viem.getContractAt("RewardVault", proxy.address);

    for (const w of [owner, rewarder, funder]) {
      await token.write.mint([w.account.address, parseEther("100000")]);
    }
    return { vault, token, owner, rewarder, user, funder, stranger };
  }

  async function fundedFixture() {
    const f = await deployFixture();
    await f.token.write.approve([f.vault.address, parseEther("1000")], { account: f.funder.account });
    await f.vault.write.fundPool([f.token.address, parseEther("1000")], { account: f.funder.account });
    return f;
  }

  describe("fundPool", function () {
    it("pulls tokens into the vault and counts them as available", async function () {
      const { vault, token } = await loadFixture(fundedFixture);
      expect(await token.read.balanceOf([vault.address])).to.equal(parseEther("1000"));
      expect(await vault.read.availableBalance([token.address])).to.equal(parseEther("1000"));
    });

    it("treats a plain transfer to the vault as pool funds too", async function () {
      const { vault, token, funder } = await loadFixture(deployFixture);
      await token.write.transfer([vault.address, parseEther("50")], { account: funder.account });
      expect(await vault.read.availableBalance([token.address])).to.equal(parseEther("50"));
    });
  });

  describe("creditReward", function () {
    it("credits from the pool without touching the rewarder's wallet", async function () {
      const { vault, token, rewarder, user } = await loadFixture(fundedFixture);
      const before = await token.read.balanceOf([rewarder.account.address]);

      await vault.write.creditReward([user.account.address, token.address, parseEther("10"), rid("a")], {
        account: rewarder.account,
      });

      expect(await token.read.balanceOf([rewarder.account.address])).to.equal(before);
      expect(await vault.read.pendingReward([user.account.address, token.address])).to.equal(parseEther("10"));
      expect(await vault.read.availableBalance([token.address])).to.equal(parseEther("990"));
    });

    it("lets the user claim a pool-credited reward", async function () {
      const { vault, token, rewarder, user } = await loadFixture(fundedFixture);
      await vault.write.creditReward([user.account.address, token.address, parseEther("10"), rid("a")], {
        account: rewarder.account,
      });
      await vault.write.claimReward([token.address], { account: user.account });
      expect(await token.read.balanceOf([user.account.address])).to.equal(parseEther("10"));
      expect(await vault.read.totalPendingByToken([token.address])).to.equal(0n);
    });

    it("never hands out funds already owed to other users", async function () {
      const { vault, token, rewarder, user, stranger } = await loadFixture(fundedFixture);
      await vault.write.creditReward([user.account.address, token.address, parseEther("1000"), rid("a")], {
        account: rewarder.account,
      });
      await assertRevert(
        vault.write.creditReward([stranger.account.address, token.address, 1n, rid("b")], {
          account: rewarder.account,
        }),
        /InsufficientFreeBalance/,
      );
    });

    it("does not let pool credits spend balance backing depositReward grants", async function () {
      const { vault, token, rewarder, user } = await loadFixture(deployFixture);
      await token.write.approve([vault.address, parseEther("10")], { account: rewarder.account });
      await vault.write.depositReward([user.account.address, token.address, parseEther("10"), rid("d")], {
        account: rewarder.account,
      });
      await assertRevert(
        vault.write.creditReward([user.account.address, token.address, 1n, rid("c")], {
          account: rewarder.account,
        }),
        /InsufficientFreeBalance/,
      );
    });

    it("shares the rewardId namespace with depositReward", async function () {
      const { vault, token, rewarder, user } = await loadFixture(fundedFixture);
      await token.write.approve([vault.address, parseEther("10")], { account: rewarder.account });
      await vault.write.depositReward([user.account.address, token.address, parseEther("10"), rid("x")], {
        account: rewarder.account,
      });
      await assertRevert(
        vault.write.creditReward([user.account.address, token.address, parseEther("10"), rid("x")], {
          account: rewarder.account,
        }),
        /RewardIdAlreadyUsed/,
      );
    });

    it("rejects non-rewarders", async function () {
      const { vault, token, stranger, user } = await loadFixture(fundedFixture);
      // Hardhat surfaces the bare Unauthorized() revert as an RPC "invalid
      // parameters" error (same for depositReward), so assert on the outcome.
      await assertRevert(
        vault.write.creditReward([user.account.address, token.address, 1n, rid("a")], {
          account: stranger.account,
        }),
        /Unauthorized|Missing or invalid parameters/,
      );
      expect(await vault.read.pendingReward([user.account.address, token.address])).to.equal(0n);
      expect(await vault.read.usedRewardId([rid("a")])).to.equal(false);
    });

    it("respects maxDepositPerToken and pause", async function () {
      const { vault, token, owner, rewarder, user } = await loadFixture(fundedFixture);
      await vault.write.setMaxDepositPerToken([token.address, parseEther("5")], { account: owner.account });
      await assertRevert(
        vault.write.creditReward([user.account.address, token.address, parseEther("6"), rid("a")], {
          account: rewarder.account,
        }),
        /AmountExceedsMax/,
      );
      await vault.write.pause({ account: owner.account });
      await assertRevert(
        vault.write.creditReward([user.account.address, token.address, 1n, rid("b")], {
          account: rewarder.account,
        }),
        /EnforcedPause/,
      );
    });

    it("enforces the daily credit limit and resets it the next day", async function () {
      const { vault, token, owner, rewarder, user } = await loadFixture(fundedFixture);
      await vault.write.setMaxDailyCreditPerToken([token.address, parseEther("15")], { account: owner.account });
      await vault.write.creditReward([user.account.address, token.address, parseEther("10"), rid("a")], {
        account: rewarder.account,
      });
      await assertRevert(
        vault.write.creditReward([user.account.address, token.address, parseEther("10"), rid("b")], {
          account: rewarder.account,
        }),
        /DailyCreditLimitExceeded/,
      );
      await time.increase(86400);
      await vault.write.creditReward([user.account.address, token.address, parseEther("10"), rid("b")], {
        account: rewarder.account,
      });
      expect(await vault.read.pendingReward([user.account.address, token.address])).to.equal(parseEther("20"));
    });
  });

  describe("rescueToken", function () {
    it("lets the owner withdraw unallocated pool funds but not owed ones", async function () {
      const { vault, token, owner, rewarder, user } = await loadFixture(fundedFixture);
      await vault.write.creditReward([user.account.address, token.address, parseEther("400"), rid("a")], {
        account: rewarder.account,
      });
      await assertRevert(
        vault.write.rescueToken([token.address, owner.account.address, parseEther("601")], {
          account: owner.account,
        }),
        /InsufficientFreeBalance/,
      );
      await vault.write.rescueToken([token.address, owner.account.address, parseEther("600")], {
        account: owner.account,
      });
      expect(await vault.read.availableBalance([token.address])).to.equal(0n);
    });
  });
});
