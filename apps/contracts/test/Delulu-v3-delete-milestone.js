/**
 * Tests for deleteMilestone (Delulu-v3).
 * Run: npx hardhat test test/Delulu-v3-delete-milestone.js --config hardhat.config.cjs
 */
const { time, loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");
const hre = require("hardhat");
const { getAddress, parseEther, encodeFunctionData } = require("viem");

const ONE_DAY = 24n * 60n * 60n;
const ONE_WEEK = 7n * ONE_DAY;

function assertRevert(promise, pattern) {
  return promise.then(
    () => expect.fail("Expected revert"),
    (e) => expect(String(e)).to.match(pattern)
  );
}

describe("Delulu-v3 deleteMilestone", function () {
  async function deployV3Fixture() {
    const [owner, creator, supporter1] = await hre.viem.getWalletClients();

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
    for (const user of [owner, creator, supporter1]) {
      await cuSD.write.mint([user.account.address, mintAmount]);
      await gDollar.write.mint([user.account.address, mintAmount]);
      await cuSD.write.approve([delulu.address, mintAmount], {
        account: user.account,
      });
      await gDollar.write.approve([delulu.address, mintAmount], {
        account: user.account,
      });
    }

    return { delulu, cuSD, gDollar, owner, creator, supporter1 };
  }

  async function createDeluluWithTwoMilestonesFixture() {
    const fixture = await loadFixture(deployV3Fixture);
    const { delulu, creator, supporter1, owner, cuSD } = fixture;

    await delulu.write.setProfile(["alice"], { account: creator.account });

    const latest = BigInt(await time.latest());
    await delulu.write.createDelulu(
      [
        cuSD.address,
        "ipfs-hash",
        latest + ONE_DAY,
        latest + 30n * ONE_DAY,
        parseEther("10"),
      ],
      { account: creator.account }
    );

    const mURIs = ["milestone-0", "milestone-1"];
    const mDurations = [ONE_WEEK, ONE_WEEK];
    await delulu.write.addMilestones([1n, mURIs, mDurations], {
      account: creator.account,
    });

    return { delulu, creator, supporter1, owner };
  }

  it("deletes a milestone when not submitted and before deadline", async function () {
    const { delulu, creator } = await loadFixture(
      createDeluluWithTwoMilestonesFixture
    );

    expect(await delulu.read.milestoneIsDeleted([1n, 1n])).to.equal(false);

    await delulu.write.deleteMilestone([1n, 1n], { account: creator.account });

    expect(await delulu.read.milestoneIsDeleted([1n, 1n])).to.equal(true);
    expect(await delulu.read.milestoneIsDeleted([1n, 0n])).to.equal(false);
  });

  it("reverts: Unauthorized (not creator)", async function () {
    const { delulu, supporter1 } = await loadFixture(
      createDeluluWithTwoMilestonesFixture
    );

    await assertRevert(
      delulu.write.deleteMilestone([1n, 1n], { account: supporter1.account }),
      /Unauthorized/
    );
  });

  it("reverts: MilestoneCannotBeDeleted when already submitted", async function () {
    const { delulu, creator } = await loadFixture(
      createDeluluWithTwoMilestonesFixture
    );

    await delulu.write.submitMilestone([1n, 0n, "https://proof.example.com"], {
      account: creator.account,
    });

    await assertRevert(
      delulu.write.deleteMilestone([1n, 0n], { account: creator.account }),
      /MilestoneCannotBeDeleted/
    );
  });

  it("reverts: MilestoneCannotBeDeleted when deadline has passed", async function () {
    const { delulu, creator } = await loadFixture(
      createDeluluWithTwoMilestonesFixture
    );

    const milestone = await delulu.read.getMilestoneInfo([1n, 1n]);
    await time.increaseTo(milestone[1] + 1n);

    await assertRevert(
      delulu.write.deleteMilestone([1n, 1n], { account: creator.account }),
      /MilestoneCannotBeDeleted/
    );
  });

  it("reverts: MilestoneNotFound when milestone already deleted", async function () {
    const { delulu, creator } = await loadFixture(
      createDeluluWithTwoMilestonesFixture
    );

    await delulu.write.deleteMilestone([1n, 1n], { account: creator.account });

    await assertRevert(
      delulu.write.deleteMilestone([1n, 1n], { account: creator.account }),
      /MilestoneNotFound/
    );
  });

  it("reverts: MilestoneNotFound when milestoneId >= milestoneCount", async function () {
    const { delulu, creator } = await loadFixture(
      createDeluluWithTwoMilestonesFixture
    );

    await assertRevert(
      delulu.write.deleteMilestone([1n, 99n], { account: creator.account }),
      /MilestoneNotFound/
    );
  });
});
