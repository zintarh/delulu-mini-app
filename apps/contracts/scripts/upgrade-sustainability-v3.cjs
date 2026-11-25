/**
 * Sustainability v3: upgrade ForfeitMarket + RewardVault in place (same addresses).
 *
 *  - ForfeitMarket: sweepCommunityPoolToVault (players' missed stakes → reward vault,
 *    permissionless) and createCommitmentFor (vault stakes on a player's behalf).
 *  - RewardVault: funding labelled by source, Delulu's share of forfeits to the
 *    treasury, purchase/cheer, stake credit, rollover, and sustainability() view.
 *
 * Usage (from apps/contracts):
 *   # dry run against a live copy of mainnet (no real transactions):
 *   anvil --fork-url https://forno.celo.org --chain-id 31337 &
 *   FORK=1 npx hardhat run scripts/upgrade-sustainability-v3.cjs --config hardhat.config.cjs --network localhost
 *   # mainnet:
 *   npx hardhat run scripts/upgrade-sustainability-v3.cjs --config hardhat.config.cjs --network celo
 *
 * Env: TREASURY (default: owner), DELULU_SHARE_BPS (default 2000 = 20%),
 *      CHEER_FEE_BPS (default 500 = 5%), SWEEP=1 to also sweep the community pool.
 */
const fs = require("fs");
const path = require("path");
const hre = require("hardhat");
const { formatEther, encodeFunctionData } = require("viem");

const G = "0x62B8B11039FcfE5aB0C56E502b1C372A3d2a9c7A";
const FM = "0x5548eC3Aa02dCbcE85Cdc6Ad37d61613019D92f8";
const RV = "0xFE5a411b47F88198038EcE3177C19Ea043398c02";
const OWNER = "0x9d8a7a866af0eeE89B45aBBB4F1BC9C3698B33e4";

const fmt = (x) => Number(formatEther(x)).toLocaleString("en-US", { maximumFractionDigits: 0 });

async function main() {
  const fork = process.env.FORK === "1";
  const publicClient = await hre.viem.getPublicClient();
  let account;
  if (fork) {
    // Run against a local mainnet fork: `anvil --fork-url https://forno.celo.org` + --network localhost.
    if (hre.network.name !== "localhost") throw new Error("FORK=1 needs --network localhost with anvil running");
    await hre.network.provider.request({ method: "hardhat_impersonateAccount", params: [OWNER] });
    account = OWNER;
    console.log("DRY RUN on a mainnet fork at block", await publicClient.getBlockNumber());
  } else {
    const [deployer] = await hre.viem.getWalletClients();
    account = deployer.account;
    console.log("MAINNET. Deployer:", deployer.account.address);
  }
  const from = typeof account === "string" ? account : account.address;
  if (from.toLowerCase() !== OWNER.toLowerCase()) throw new Error(`Must run as the owner ${OWNER}`);
  const opts = { account };

  const fm = await hre.viem.getContractAt("ForfeitMarket", FM);
  const rv = await hre.viem.getContractAt("RewardVault", RV);
  const gd = await hre.viem.getContractAt("MockERC20", G); // only balanceOf is used

  const before = {
    fmOwner: await fm.read.owner(), fee: await fm.read.platformFeeAddress(), next: await fm.read.nextCommitmentId(),
    pool: await fm.read.communityPoolBalance([G]), fmBal: await gd.read.balanceOf([FM]),
    rvOwner: await rv.read.owner(), rewarder: await rv.read.rewarder(), pending: await rv.read.totalPendingByToken([G]),
    maxDep: await rv.read.maxDepositPerToken([G]), maxDaily: await rv.read.maxDailyCreditPerToken([G]), rvBal: await gd.read.balanceOf([RV]),
  };
  console.log("\nBefore:", { commitments: String(before.next), communityPool: fmt(before.pool), forfeitMarketG: fmt(before.fmBal), vaultOwed: fmt(before.pending), vaultG: fmt(before.rvBal) });

  console.log("\nDeploying implementations…");
  const fmImpl = await hre.viem.deployContract("ForfeitMarket", [], opts);
  const rvImpl = await hre.viem.deployContract("RewardVault", [], opts);
  console.log("  ForfeitMarket impl:", fmImpl.address);
  console.log("  RewardVault impl:  ", rvImpl.address);

  const wait = async (hash, label) => {
    const r = await publicClient.waitForTransactionReceipt({ hash });
    if (r.status !== "success") throw new Error(`${label} failed: ${hash}`);
    console.log(`  ✓ ${label} ${hash}`);
  };

  const treasury = process.env.TREASURY || OWNER;
  const share = Number(process.env.DELULU_SHARE_BPS ?? 2000);
  const cheerFee = Number(process.env.CHEER_FEE_BPS ?? 500);
  const rvAbi = (await hre.artifacts.readArtifact("RewardVault")).abi;
  const initV3 = encodeFunctionData({ abi: rvAbi, functionName: "initializeV3", args: [treasury, FM, share, cheerFee] });

  console.log("\nUpgrading…");
  await wait(await fm.write.upgradeToAndCall([fmImpl.address, "0x"], opts), "ForfeitMarket upgraded");
  await wait(await rv.write.upgradeToAndCall([rvImpl.address, initV3], opts), "RewardVault upgraded + initializeV3");
  await wait(await fm.write.setRewardVault([RV], opts), "ForfeitMarket.setRewardVault");

  const after = {
    fmOwner: await fm.read.owner(), fee: await fm.read.platformFeeAddress(), next: await fm.read.nextCommitmentId(),
    pool: await fm.read.communityPoolBalance([G]), fmBal: await gd.read.balanceOf([FM]),
    rvOwner: await rv.read.owner(), rewarder: await rv.read.rewarder(), pending: await rv.read.totalPendingByToken([G]),
    maxDep: await rv.read.maxDepositPerToken([G]), maxDaily: await rv.read.maxDailyCreditPerToken([G]), rvBal: await gd.read.balanceOf([RV]),
  };
  for (const k of Object.keys(before)) {
    if (String(before[k]).toLowerCase() !== String(after[k]).toLowerCase()) throw new Error(`State changed across upgrade: ${k} ${before[k]} → ${after[k]}`);
  }
  console.log("  ✓ every existing value is unchanged");
  console.log("  vault config:", { treasury: await rv.read.treasury(), deluluShareBps: await rv.read.deluluShareBps(), cheerFeeBps: await rv.read.cheerFeeBps(), forfeitMarket: await rv.read.forfeitMarket(), forfeitSource: await rv.read.isForfeitSource([FM]) });

  if (fork || process.env.SWEEP === "1") {
    const pool = await fm.read.communityPoolBalance([G]);
    if (pool > 0n) {
      console.log(`\nSweeping ${fmt(pool)} G$ of players' missed stakes into the reward vault…`);
      await wait(await fm.write.sweepCommunityPoolToVault([G, pool], opts), "sweep");
      const s = await rv.read.sustainability([G]);
      console.log("  sustainability():", { playerForfeits: fmt(s[0]), playerPurchases: fmt(s[1]), team: fmt(s[2]), deluluRevenue: fmt(s[6]), playerFunded: `${Number(s[7]) / 100}%` });
      console.log("  vault available:", fmt(await rv.read.availableBalance([G])), "G$");
    }
  }

  if (!fork) {
    for (const [file, impl] of [["forfeit-market-celo.json", fmImpl.address], ["reward-vault-celo.json", rvImpl.address]]) {
      const p = path.join(__dirname, "..", "deployments", file);
      const rec = JSON.parse(fs.readFileSync(p, "utf8"));
      rec.implementation = impl;
      rec.upgradedAt = new Date().toISOString().slice(0, 10);
      rec.version = "sustainability-v3";
      fs.writeFileSync(p, `${JSON.stringify(rec, null, 2)}\n`);
    }
    console.log("\nDeployment records updated.");
  }
  console.log("\nDone.");
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
