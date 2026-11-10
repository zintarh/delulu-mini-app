/**
 * Re-applies a campaign's CURRENT on-chain economics (same token, stake and %)
 * so it picks up campaignForfeitToDelulu after the CommunityMarketV1 upgrade.
 * Nothing about the campaign changes except where missed-milestone stake goes.
 * Only works while the campaign has 0 participants (the contract locks it after).
 *
 * Usage (Celo mainnet), from apps/contracts:
 *   CAMPAIGN_ID=47 PRIVATE_KEY=0x... HARDHAT_TELEMETRY_DISABLED=1 \
 *   npx hardhat run scripts/reapply-campaign-economics.cjs --config hardhat.config.cjs --network celo
 *
 * Optional: PROXY_ADDRESS (defaults to the production proxy on celo).
 */
const { ethers } = require("hardhat");

const DEFAULT_PROXY_BY_NETWORK = {
  celo: "0xE652E0cA7DACb6489928C6801D83356a016DcfE1",
};

async function main() {
  const campaignId = BigInt(process.env.CAMPAIGN_ID ?? "");
  const network = hre.network.name;
  const proxyAddress = process.env.PROXY_ADDRESS || DEFAULT_PROXY_BY_NETWORK[network];
  if (!proxyAddress) throw new Error(`Unknown network ${network}. Set PROXY_ADDRESS.`);

  const [signer] = await ethers.getSigners();
  if (!signer) throw new Error("No account. Set PRIVATE_KEY (the CommunityMarketV1 owner or campaign creator).");

  const market = await ethers.getContractAt("CommunityMarketV1", proxyAddress, signer);

  // Upgrade must be live first — otherwise the flag doesn't exist yet.
  let flagged;
  try {
    flagged = await market.campaignForfeitToDelulu(campaignId);
  } catch {
    throw new Error("campaignForfeitToDelulu not found — run the upgrade (upgrade-community-market-v1.cjs) first.");
  }

  const [isPaid, joinToken, joinAmount, forfeitPct, participants] = await Promise.all([
    market.campaignIsPaid(campaignId),
    market.campaignJoinToken(campaignId),
    market.campaignJoinAmount(campaignId),
    market.campaignForfeitPct(campaignId),
    market.campaignParticipantCount(campaignId),
  ]);

  console.log(`Campaign ${campaignId} on ${proxyAddress}`);
  console.log(`  paid=${isPaid} token=${joinToken} stake=${ethers.formatUnits(joinAmount, 18)} pct=${forfeitPct}`);
  console.log(`  participants=${participants} forfeitToDelulu=${flagged}`);

  if (flagged) {
    console.log("Already sends missed stake to Delulu — nothing to do.");
    return;
  }
  if (participants > 0n) {
    throw new Error("Campaign already has participants — economics are locked on-chain and can't be re-applied.");
  }

  const tx = await market.setCommunityCampaignEconomics(campaignId, isPaid, joinToken, joinAmount, forfeitPct);
  console.log("Tx:", tx.hash);
  await tx.wait();
  console.log("forfeitToDelulu now:", await market.campaignForfeitToDelulu(campaignId));
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
