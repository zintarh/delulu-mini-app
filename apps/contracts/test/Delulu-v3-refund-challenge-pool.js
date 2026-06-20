/**
 * Tests for refundChallengePool (Delulu-v3).
 * Run: npx hardhat test test/Delulu-v3-refund-challenge-pool.js --config hardhat.config.cjs
 */
const { time, loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");
const hre = require("hardhat");
const { parseEther, encodeFunctionData } = require("viem");

const ONE_WEEK = 7n * 24n * 60n * 60n;

function assertRevert(promise, pattern) {
  return promise.then(
    () => expect.fail("Expected revert"),
    (e) => expect(String(e)).to.match(pattern)
  );
}

describe("Delulu-v3 refundChallengePool", function () {
  async function deployV3Fixture() {
    const [owner, creator] = await hre.viem.getWalletClients();

    const cuSD = await hre.viem.deployContract("MockERC20", ["cUSD", "cUSD", 18]);
    const gDollar = await hre.viem.deployContract("MockERC20", ["GoodDollar", "G$", 18]);

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
    for (const user of [owner, creator]) {
      await cuSD.write.mint([user.account.address, mintAmount]);
      await gDollar.write.mint([user.account.address, mintAmount]);
      await cuSD.write.approve([delulu.address, mintAmount], {
        account: user.account,
      });
      await gDollar.write.approve([delulu.address, mintAmount], {
        account: user.account,
      });
    }

    return { delulu, cuSD, gDollar, owner, creator };
  }

  async function createEndedEmptyChallengeFixture() {
    const fixture = await loadFixture(deployV3Fixture);
    const { delulu, gDollar, owner } = fixture;

    const poolAmount = parseEther("100");
    await delulu.write.createChallenge(
      ["ipfs-campaign-hash", poolAmount, ONE_WEEK],
      { account: owner.account }
    );

    await time.increase(ONE_WEEK + 1n);

    return { ...fixture, poolAmount, challengeId: 1n };
  }

  it("refunds empty campaign pool to funder after campaign ends", async function () {
    const { delulu, cuSD, owner, poolAmount } = await loadFixture(
      createEndedEmptyChallengeFixture
    );

    const ownerBefore = await cuSD.read.balanceOf([owner.account.address]);
    const contractBefore = await cuSD.read.balanceOf([delulu.address]);

    await delulu.write.refundChallengePool([1n], { account: owner.account });

    const ownerAfter = await cuSD.read.balanceOf([owner.account.address]);
    const contractAfter = await cuSD.read.balanceOf([delulu.address]);
    const challenge = await delulu.read.challenges([1n]);
    const funder = await delulu.read.challengeFunder([1n]);

    expect(funder.toLowerCase()).to.equal(owner.account.address.toLowerCase());
    expect(ownerAfter - ownerBefore).to.equal(poolAmount);
    expect(contractBefore - contractAfter).to.equal(poolAmount);
    expect(challenge[2]).to.equal(0n);
    expect(challenge[6]).to.equal(false);
  });

  it("reverts: ChallengeNotClosed while campaign is active", async function () {
    const { delulu, owner } = await loadFixture(deployV3Fixture);

    await delulu.write.createChallenge(
      ["ipfs-campaign-hash", parseEther("50"), ONE_WEEK],
      { account: owner.account }
    );

    await assertRevert(
      delulu.write.refundChallengePool([1n], { account: owner.account }),
      /ChallengeNotClosed/
    );
  });

  it("reverts: ChallengePoolEmpty on double refund", async function () {
    const { delulu, owner } = await loadFixture(createEndedEmptyChallengeFixture);

    await delulu.write.refundChallengePool([1n], { account: owner.account });

    await assertRevert(
      delulu.write.refundChallengePool([1n], { account: owner.account }),
      /ChallengePoolEmpty/
    );
  });

  it("reverts: Unauthorized when not the campaign funder", async function () {
    const { delulu, creator } = await loadFixture(createEndedEmptyChallengeFixture);

    await assertRevert(
      delulu.write.refundChallengePool([1n], { account: creator.account }),
      /Unauthorized/
    );
  });
});
