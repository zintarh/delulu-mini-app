/**
 * Tests decimal-aware minimum creator stake (18-decimal G$ / cUSD and 6-decimal USDT).
 * Run: npx hardhat test test/Delulu-v3-min-stake-decimals.js --config hardhat.config.cjs
 */
const { time, loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");
const hre = require("hardhat");
const { parseEther, parseUnits, encodeFunctionData } = require("viem");

const ONE_DAY = 24n * 60n * 60n;
const MIN_STAKE_WHOLE = 100n;

function assertRevert(promise, pattern) {
  return promise.then(
    () => expect.fail("Expected revert"),
    (e) => expect(String(e)).to.match(pattern)
  );
}

describe("Delulu-v3 min stake decimals", function () {
  async function deployV3Fixture() {
    const [owner, creator] = await hre.viem.getWalletClients();

    const cuSD = await hre.viem.deployContract("MockERC20", ["cUSD", "cUSD", 18]);
    const gDollar = await hre.viem.deployContract("MockERC20", ["GoodDollar", "G$", 18]);
    const usdt = await hre.viem.deployContract("MockERC20", ["Tether USD", "USDT", 6]);

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

    await delulu.write.setTokenSupport([gDollar.address, true], {
      account: owner.account,
    });
    await delulu.write.setTokenSupport([usdt.address, true], {
      account: owner.account,
    });

    const mintAmount18 = parseEther("1000000");
    const mintAmount6 = parseUnits("1000000", 6);
    for (const token of [cuSD, gDollar, usdt]) {
      const mintAmount = token === usdt ? mintAmount6 : mintAmount18;
      await token.write.mint([creator.account.address, mintAmount]);
      await token.write.approve([delulu.address, mintAmount], {
        account: creator.account,
      });
    }

    await delulu.write.setProfile(["alice"], { account: creator.account });

    return { delulu, cuSD, gDollar, usdt, creator };
  }

  async function resolutionDeadline() {
    const latest = BigInt(await time.latest());
    return latest + 30n * ONE_DAY;
  }

  it("accepts 100 whole tokens for 18-decimal cUSD", async function () {
    const { delulu, cuSD, creator } = await loadFixture(deployV3Fixture);
    const latest = BigInt(await time.latest());

    await delulu.write.createDelulu(
      [
        cuSD.address,
        "ipfs-18dec",
        latest + ONE_DAY,
        await resolutionDeadline(),
        parseEther(String(MIN_STAKE_WHOLE)),
      ],
      { account: creator.account }
    );

    expect(await delulu.read.nextDeluluId()).to.equal(2n);
  });

  it("reverts below 100 whole tokens for 18-decimal G$", async function () {
    const { delulu, gDollar, creator } = await loadFixture(deployV3Fixture);
    const latest = BigInt(await time.latest());

    await assertRevert(
      delulu.write.createDelulu(
        [
          gDollar.address,
          "ipfs-too-small-18",
          latest + ONE_DAY,
          await resolutionDeadline(),
          parseEther("99"),
        ],
        { account: creator.account }
      ),
      /StakeTooSmall/
    );
  });

  it("accepts 100 whole tokens for 6-decimal USDT", async function () {
    const { delulu, usdt, creator } = await loadFixture(deployV3Fixture);
    const latest = BigInt(await time.latest());

    await delulu.write.createDelulu(
      [
        usdt.address,
        "ipfs-usdt",
        latest + ONE_DAY,
        await resolutionDeadline(),
        parseUnits(String(MIN_STAKE_WHOLE), 6),
      ],
      { account: creator.account }
    );

    expect(await delulu.read.nextDeluluId()).to.equal(2n);
  });

  it("reverts below 100 whole tokens for 6-decimal USDT", async function () {
    const { delulu, usdt, creator } = await loadFixture(deployV3Fixture);
    const latest = BigInt(await time.latest());

    await assertRevert(
      delulu.write.createDelulu(
        [
          usdt.address,
          "ipfs-too-small-usdt",
          latest + ONE_DAY,
          await resolutionDeadline(),
          parseUnits("99", 6),
        ],
        { account: creator.account }
      ),
      /StakeTooSmall/
    );
  });
});
