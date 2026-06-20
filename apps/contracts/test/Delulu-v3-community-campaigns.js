/**
 * Community campaign on-chain flows (Delulu-v3).
 * Run: npx hardhat test test/Delulu-v3-community-campaigns.js --config hardhat.config.cjs
 */
const { time, loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");
const hre = require("hardhat");
const { parseEther, encodeFunctionData } = require("viem");

const ONE_DAY = 86400n;
const ONE_WEEK = 7n * ONE_DAY;

function assertRevert(promise, pattern) {
  return promise.then(
    () => expect.fail("Expected revert"),
    (e) => expect(String(e)).to.match(pattern)
  );
}

describe("Delulu-v3 community campaigns", function () {
  async function deployV3Fixture() {
    const [owner, creator, participant] = await hre.viem.getWalletClients();

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
    for (const user of [owner, creator, participant]) {
      await cuSD.write.mint([user.account.address, mintAmount]);
      await gDollar.write.mint([user.account.address, mintAmount]);
      await cuSD.write.approve([delulu.address, mintAmount], {
        account: user.account,
      });
      await gDollar.write.approve([delulu.address, mintAmount], {
        account: user.account,
      });
    }

    return { delulu, cuSD, gDollar, owner, creator, participant };
  }

  it("creates community challenge with zero pool", async function () {
    const { delulu, owner } = await loadFixture(deployV3Fixture);

    await delulu.write.createCommunityChallenge(
      ["ipfs-community-campaign", ONE_WEEK, ONE_DAY],
      { account: owner.account }
    );

    const challenge = await delulu.read.challenges([1n]);
    expect(challenge[2]).to.equal(0n); // poolAmount
    expect(await delulu.read.isCommunityCampaign([1n])).to.equal(true);
    expect(await delulu.read.challengeKind([1n])).to.equal(1);
  });

  it("join and submit proof awards points with streak bonus", async function () {
    const { delulu, owner, participant } = await loadFixture(deployV3Fixture);

    await delulu.write.createCommunityChallenge(
      ["ipfs-community-campaign", ONE_WEEK, ONE_DAY],
      { account: owner.account }
    );

    await delulu.write.joinCommunityCampaign([1n], {
      account: participant.account,
    });

    await delulu.write.submitCommunityProof(
      [1n, "https://proof.example/1", true],
      { account: participant.account }
    );

    let points = await delulu.read.communityCampaignPoints([1n, participant.account.address]);
    expect(points).to.equal(10n);

    await time.increase(ONE_DAY + 1n);

    await delulu.write.submitCommunityProof(
      [1n, "https://proof.example/2", true],
      { account: participant.account }
    );

    points = await delulu.read.communityCampaignPoints([1n, participant.account.address]);
    expect(points).to.equal(21n); // 10 + 11 (base + 1 streak bonus)
  });

  it("rejects proof before join and enforces cadence", async function () {
    const { delulu, owner, participant } = await loadFixture(deployV3Fixture);

    await delulu.write.createCommunityChallenge(
      ["ipfs-community-campaign", ONE_WEEK, ONE_DAY],
      { account: owner.account }
    );

    await assertRevert(
      delulu.write.submitCommunityProof(
        [1n, "https://proof.example/1", true],
        { account: participant.account }
      ),
      /NotJoinedCommunity/
    );

    await delulu.write.joinCommunityCampaign([1n], {
      account: participant.account,
    });

    await delulu.write.submitCommunityProof(
      [1n, "https://proof.example/1", true],
      { account: participant.account }
    );

    await assertRevert(
      delulu.write.submitCommunityProof(
        [1n, "https://proof.example/2", true],
        { account: participant.account }
      ),
      /ProofTooSoon/
    );
  });

  it("funds community challenge and ends it", async function () {
    const { delulu, gDollar, owner, participant } = await loadFixture(deployV3Fixture);

    await delulu.write.createCommunityChallenge(
      ["ipfs-community-campaign", ONE_WEEK, ONE_DAY],
      { account: owner.account }
    );

    const fundAmount = parseEther("50");
    await delulu.write.fundCommunityChallenge([1n, fundAmount], {
      account: owner.account,
    });

    const challenge = await delulu.read.challenges([1n]);
    expect(challenge[2]).to.equal(fundAmount);

    await delulu.write.endCommunityChallenge([1n], {
      account: owner.account,
    });

    expect(await delulu.read.communityChallengeEnded([1n])).to.equal(true);

    await assertRevert(
      delulu.write.joinCommunityCampaign([1n], {
        account: participant.account,
      }),
      /ChallengeAlreadyEnded/
    );
  });

  it("blocks legacy joinChallenge on community campaigns", async function () {
    const { delulu, cuSD, owner } = await loadFixture(deployV3Fixture);

    await delulu.write.createCommunityChallenge(
      ["ipfs-community-campaign", ONE_WEEK, ONE_DAY],
      { account: owner.account }
    );

    const stake = parseEther("100");
    const now = BigInt(Math.floor(Date.now() / 1000));
    await delulu.write.setProfile(["owner"], { account: owner.account });
    await delulu.write.createDelulu(
      [
        cuSD.address,
        "ipfs-delulu",
        now + ONE_WEEK,
        now + ONE_WEEK * 2n,
        stake,
      ],
      { account: owner.account }
    );

    await assertRevert(
      delulu.write.joinChallenge([1n, 1n], { account: owner.account }),
      /NotCommunityChallenge/
    );
  });
});
