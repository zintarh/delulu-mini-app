/**
 * CommunityMarketV1 — UUPS proxy, flat milestone points, start-time gating.
 * Run: npx hardhat test test/CommunityMarketV1.js --config hardhat.config.cjs
 */
const { time, loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");
const hre = require("hardhat");
const { parseEther, encodeFunctionData } = require("viem");

const ONE_DAY = 86400n;

function assertRevert(promise, pattern) {
  return promise.then(
    () => expect.fail("Expected revert"),
    (e) => expect(String(e)).to.match(pattern),
  );
}

describe("CommunityMarketV1", function () {
  async function deployFixture() {
    const [owner, creator, participant] = await hre.viem.getWalletClients();
    const currency = await hre.viem.deployContract("MockERC20", ["GoodDollar", "G$", 18]);

    const implementation = await hre.viem.deployContract("CommunityMarketV1", []);
    const artifact = await hre.artifacts.readArtifact("CommunityMarketV1");
    const initData = encodeFunctionData({
      abi: artifact.abi,
      functionName: "initialize",
      args: [currency.address, owner.account.address],
    });
    const proxy = await hre.viem.deployContract("ERC1967Proxy", [
      implementation.address,
      initData,
    ]);
    const market = await hre.viem.getContractAt("CommunityMarketV1", proxy.address);

    const mintAmount = parseEther("1000000");
    for (const user of [owner, creator, participant]) {
      await currency.write.mint([user.account.address, mintAmount]);
    }

    return { market, currency, owner, creator, participant, proxy, implementation };
  }

  async function createCampaignWithMilestones(market, creator) {
    await market.write.createCommunityChallenge(
      ["ipfs-community-campaign", 7n * ONE_DAY, ONE_DAY],
      { account: creator.account },
    );
    await market.write.addCommunityCampaignMilestones(
      [0n, ["Day 1", "Day 2"], [ONE_DAY, ONE_DAY]],
      { account: creator.account },
    );
  }

  it("deploys behind UUPS proxy and initializes owner", async function () {
    const { market, owner } = await loadFixture(deployFixture);
    const contractOwner = await market.read.owner();
    expect(contractOwner.toLowerCase()).to.equal(owner.account.address.toLowerCase());
  });

  it("awards flat 1000 points per milestone", async function () {
    const { market, creator, participant } = await loadFixture(deployFixture);
    await createCampaignWithMilestones(market, creator);

    await market.write.joinCommunityCampaign([0n], {
      account: participant.account,
    });

    await market.write.submitCommunityCampaignMilestoneProof(
      [0n, 0n, "https://proof.example/1"],
      { account: participant.account },
    );

    const points = await market.read.participantPoints([0n, participant.account.address]);
    expect(points).to.equal(1000n);

    await time.increase(ONE_DAY + 1n);

    await market.write.submitCommunityCampaignMilestoneProof(
      [0n, 1n, "https://proof.example/2"],
      { account: participant.account },
    );

    const total = await market.read.participantPoints([0n, participant.account.address]);
    expect(total).to.equal(2000n);
  });

  it("rejects proof before milestone start time", async function () {
    const { market, creator, participant } = await loadFixture(deployFixture);
    await createCampaignWithMilestones(market, creator);

    await market.write.joinCommunityCampaign([0n], {
      account: participant.account,
    });

    await market.write.submitCommunityCampaignMilestoneProof(
      [0n, 0n, "https://proof.example/1"],
      { account: participant.account },
    );

    await assertRevert(
      market.write.submitCommunityCampaignMilestoneProof(
        [0n, 1n, "https://proof.example/2"],
        { account: participant.account },
      ),
      /ProofBeforeStart/,
    );
  });

  it("owner can upgrade implementation without losing state", async function () {
    const { market, creator, participant, owner, proxy } = await loadFixture(deployFixture);
    await createCampaignWithMilestones(market, creator);

    await market.write.joinCommunityCampaign([0n], {
      account: participant.account,
    });
    await market.write.submitCommunityCampaignMilestoneProof(
      [0n, 0n, "https://proof.example/1"],
      { account: participant.account },
    );

    const pointsBefore = await market.read.participantPoints([
      0n,
      participant.account.address,
    ]);

    const implementationV2 = await hre.viem.deployContract("CommunityMarketV1", []);
    await market.write.upgradeToAndCall([implementationV2.address, "0x"], {
      account: owner.account,
    });

    const marketV2 = await hre.viem.getContractAt("CommunityMarketV1", proxy.address);
    const pointsAfter = await marketV2.read.participantPoints([
      0n,
      participant.account.address,
    ]);
    expect(pointsAfter).to.equal(pointsBefore);
  });
});
