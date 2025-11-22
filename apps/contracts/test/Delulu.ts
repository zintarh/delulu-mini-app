// import {
//   time,
//   loadFixture,
// } from "@nomicfoundation/hardhat-toolbox-viem/network-helpers";
// import { expect } from "chai";
// import hre from "hardhat";
// import { parseEther, getAddress } from "viem";

// describe("Delulu", function () {
//   // Constants matching the contract
//   const PLATFORM_FEE_BPS = 10n; // 0.1%
//   const CLIMATE_ALLOCATION_BPS = 2000n; // 20% of platform fees
//   const WITHDRAWAL_PENALTY_BPS = 500n; // 5%
//   const MIN_SWITCH_PENALTY_BPS = 50n; // 0.5%
//   const MAX_SWITCH_PENALTY_BPS = 1000n; // 10%
//   const BPS_DENOMINATOR = 10000n;

//   // Mock cUSD address (for testing purposes)
//   const MOCK_CUSD_ADDRESS = "0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1";

//   /**
//    * Fixture to deploy a mock ERC20 token (cUSD) and the Delulu contract
//    */
//   async function deployDeluluFixture() {
//     const [owner, creator, believer1, believer2, doubter1, doubter2] =
//       await hre.viem.getWalletClients();

//     // Deploy a mock ERC20 token to simulate cUSD
//     const mockCUSD = await hre.viem.deployContract("MockERC20", [
//       "Celo Dollar",
//       "cUSD",
//       18n,
//     ]);

//     // Deploy Delulu contract with mock cUSD address
//     const delulu = await hre.viem.deployContract("Delulu", [mockCUSD.address]);

//     // Mint tokens to test users
//     const mintAmount = parseEther("10000");
//     await mockCUSD.write.mint([owner.account.address, mintAmount]);
//     await mockCUSD.write.mint([creator.account.address, mintAmount]);
//     await mockCUSD.write.mint([believer1.account.address, mintAmount]);
//     await mockCUSD.write.mint([believer2.account.address, mintAmount]);
//     await mockCUSD.write.mint([doubter1.account.address, mintAmount]);
//     await mockCUSD.write.mint([doubter2.account.address, mintAmount]);

//     const publicClient = await hre.viem.getPublicClient();

//     return {
//       delulu,
//       mockCUSD,
//       owner,
//       creator,
//       believer1,
//       believer2,
//       doubter1,
//       doubter2,
//       publicClient,
//     };
//   }

//   /**
//    * Helper to approve and stake
//    */
//   async function approveAndStake(
//     mockCUSD: any,
//     delulu: any,
//     user: any,
//     delusionId: bigint,
//     amount: bigint,
//     isBeliever: boolean
//   ) {
//     const mockCUSDAsUser = await hre.viem.getContractAt(
//       "MockERC20",
//       mockCUSD.address,
//       { client: { wallet: user } }
//     );

//     await mockCUSDAsUser.write.approve([delulu.address, amount]);

//     const deluluAsUser = await hre.viem.getContractAt("Delulu", delulu.address, {
//       client: { wallet: user },
//     });

//     if (isBeliever) {
//       await deluluAsUser.write.stakeBelieve([delusionId, amount]);
//     } else {
//       await deluluAsUser.write.stakeDoubt([delusionId, amount]);
//     }
//   }

//   // ============================================================
//   // DEPLOYMENT TESTS
//   // ============================================================

//   describe("Deployment", function () {
//     it("Should set the correct cUSD address", async function () {
//       const { delulu, mockCUSD } = await loadFixture(deployDeluluFixture);
//       expect(await delulu.read.cUSD()).to.equal(getAddress(mockCUSD.address));
//     });

//     it("Should set the correct owner", async function () {
//       const { delulu, owner } = await loadFixture(deployDeluluFixture);
//       expect(await delulu.read.owner()).to.equal(
//         getAddress(owner.account.address)
//       );
//     });

//     it("Should initialize with zero delusions", async function () {
//       const { delulu } = await loadFixture(deployDeluluFixture);
//       expect(await delulu.read.delusionCounter()).to.equal(0n);
//     });

//     it("Should initialize with zero vaults", async function () {
//       const { delulu } = await loadFixture(deployDeluluFixture);
//       expect(await delulu.read.platformVault()).to.equal(0n);
//       expect(await delulu.read.climateVault()).to.equal(0n);
//     });
//   });

//   // ============================================================
//   // DELUSION CREATION TESTS
//   // ============================================================

//   describe("Delusion Creation", function () {
//     it("Should create a delusion with valid parameters", async function () {
//       const { delulu, creator } = await loadFixture(deployDeluluFixture);

//       const claimText = "I will run a marathon in under 3 hours";
//       const deadline = BigInt((await time.latest()) + 30 * 24 * 60 * 60); // 30 days

//       const deluluAsCreator = await hre.viem.getContractAt(
//         "Delulu",
//         delulu.address,
//         { client: { wallet: creator } }
//       );

//       await deluluAsCreator.write.createDelusion([claimText, deadline]);

//       const delusion = await delulu.read.getDelusion([1n]);
//       expect(delusion.id).to.equal(1n);
//       expect(delusion.creator).to.equal(getAddress(creator.account.address));
//       expect(delusion.claimText).to.equal(claimText);
//       expect(delusion.deadline).to.equal(deadline);
//       expect(delusion.believePool).to.equal(0n);
//       expect(delusion.doubtPool).to.equal(0n);
//       expect(delusion.status).to.equal(0); // Active
//     });

//     it("Should increment delusion counter", async function () {
//       const { delulu, creator } = await loadFixture(deployDeluluFixture);

//       const deadline = BigInt((await time.latest()) + 30 * 24 * 60 * 60);

//       const deluluAsCreator = await hre.viem.getContractAt(
//         "Delulu",
//         delulu.address,
//         { client: { wallet: creator } }
//       );

//       await deluluAsCreator.write.createDelusion(["First delusion", deadline]);
//       expect(await delulu.read.delusionCounter()).to.equal(1n);

//       await deluluAsCreator.write.createDelusion(["Second delusion", deadline]);
//       expect(await delulu.read.delusionCounter()).to.equal(2n);
//     });

//     it("Should emit DelusionCreated event", async function () {
//       const { delulu, creator, publicClient } = await loadFixture(
//         deployDeluluFixture
//       );

//       const claimText = "I will learn to juggle";
//       const deadline = BigInt((await time.latest()) + 30 * 24 * 60 * 60);

//       const deluluAsCreator = await hre.viem.getContractAt(
//         "Delulu",
//         delulu.address,
//         { client: { wallet: creator } }
//       );

//       const hash = await deluluAsCreator.write.createDelusion([
//         claimText,
//         deadline,
//       ]);
//       await publicClient.waitForTransactionReceipt({ hash });

//       const events = await delulu.getEvents.DelusionCreated();
//       expect(events).to.have.lengthOf(1);
//       expect(events[0].args.delusionId).to.equal(1n);
//       expect(events[0].args.creator).to.equal(
//         getAddress(creator.account.address)
//       );
//       expect(events[0].args.claimText).to.equal(claimText);
//       expect(events[0].args.deadline).to.equal(deadline);
//     });

//     it("Should fail with empty claim text", async function () {
//       const { delulu, creator } = await loadFixture(deployDeluluFixture);

//       const deadline = BigInt((await time.latest()) + 30 * 24 * 60 * 60);

//       const deluluAsCreator = await hre.viem.getContractAt(
//         "Delulu",
//         delulu.address,
//         { client: { wallet: creator } }
//       );

//       await expect(
//         deluluAsCreator.write.createDelusion(["", deadline])
//       ).to.be.rejectedWith("Claim text cannot be empty");
//     });

//     it("Should fail with deadline in the past", async function () {
//       const { delulu, creator } = await loadFixture(deployDeluluFixture);

//       const pastDeadline = BigInt((await time.latest()) - 1);

//       const deluluAsCreator = await hre.viem.getContractAt(
//         "Delulu",
//         delulu.address,
//         { client: { wallet: creator } }
//       );

//       await expect(
//         deluluAsCreator.write.createDelusion(["Test claim", pastDeadline])
//       ).to.be.rejectedWith("Deadline must be in the future");
//     });

//     it("Should fail with deadline too far in future", async function () {
//       const { delulu, creator } = await loadFixture(deployDeluluFixture);

//       const farDeadline = BigInt(
//         (await time.latest()) + 366 * 24 * 60 * 60
//       ); // > 365 days

//       const deluluAsCreator = await hre.viem.getContractAt(
//         "Delulu",
//         delulu.address,
//         { client: { wallet: creator } }
//       );

//       await expect(
//         deluluAsCreator.write.createDelusion(["Test claim", farDeadline])
//       ).to.be.rejectedWith("Deadline too far in future");
//     });
//   });

//   // ============================================================
//   // STAKING - BELIEVE TESTS
//   // ============================================================

//   describe("Staking - Believe", function () {
//     it("Should allow a user to stake on believe", async function () {
//       const { delulu, mockCUSD, creator, believer1 } = await loadFixture(
//         deployDeluluFixture
//       );

//       const deadline = BigInt((await time.latest()) + 30 * 24 * 60 * 60);
//       const deluluAsCreator = await hre.viem.getContractAt(
//         "Delulu",
//         delulu.address,
//         { client: { wallet: creator } }
//       );
//       await deluluAsCreator.write.createDelusion(["Test claim", deadline]);

//       const stakeAmount = parseEther("100");
//       await approveAndStake(
//         mockCUSD,
//         delulu,
//         believer1,
//         1n,
//         stakeAmount,
//         true
//       );

//       const delusion = await delulu.read.getDelusion([1n]);
//       expect(delusion.believerCount).to.equal(1n);

//       // Calculate expected net amount after fees
//       const platformFee = (stakeAmount * PLATFORM_FEE_BPS) / BPS_DENOMINATOR;
//       const netAmount = stakeAmount - platformFee;

//       expect(delusion.believePool).to.equal(netAmount);
//     });

//     it("Should collect platform and climate fees", async function () {
//       const { delulu, mockCUSD, creator, believer1 } = await loadFixture(
//         deployDeluluFixture
//       );

//       const deadline = BigInt((await time.latest()) + 30 * 24 * 60 * 60);
//       const deluluAsCreator = await hre.viem.getContractAt(
//         "Delulu",
//         delulu.address,
//         { client: { wallet: creator } }
//       );
//       await deluluAsCreator.write.createDelusion(["Test claim", deadline]);

//       const stakeAmount = parseEther("100");
//       await approveAndStake(
//         mockCUSD,
//         delulu,
//         believer1,
//         1n,
//         stakeAmount,
//         true
//       );

//       const platformFee = (stakeAmount * PLATFORM_FEE_BPS) / BPS_DENOMINATOR;
//       const climateFee =
//         (platformFee * CLIMATE_ALLOCATION_BPS) / BPS_DENOMINATOR;
//       const expectedPlatformVault = platformFee - climateFee;

//       expect(await delulu.read.platformVault()).to.equal(
//         expectedPlatformVault
//       );
//       expect(await delulu.read.climateVault()).to.equal(climateFee);
//     });

//     it("Should allow multiple users to stake on believe", async function () {
//       const { delulu, mockCUSD, creator, believer1, believer2 } =
//         await loadFixture(deployDeluluFixture);

//       const deadline = BigInt((await time.latest()) + 30 * 24 * 60 * 60);
//       const deluluAsCreator = await hre.viem.getContractAt(
//         "Delulu",
//         delulu.address,
//         { client: { wallet: creator } }
//       );
//       await deluluAsCreator.write.createDelusion(["Test claim", deadline]);

//       const stakeAmount = parseEther("100");
//       await approveAndStake(
//         mockCUSD,
//         delulu,
//         believer1,
//         1n,
//         stakeAmount,
//         true
//       );
//       await approveAndStake(
//         mockCUSD,
//         delulu,
//         believer2,
//         1n,
//         stakeAmount,
//         true
//       );

//       const delusion = await delulu.read.getDelusion([1n]);
//       expect(delusion.believerCount).to.equal(2n);
//     });

//     it("Should allow user to add to existing believe stake", async function () {
//       const { delulu, mockCUSD, creator, believer1 } = await loadFixture(
//         deployDeluluFixture
//       );

//       const deadline = BigInt((await time.latest()) + 30 * 24 * 60 * 60);
//       const deluluAsCreator = await hre.viem.getContractAt(
//         "Delulu",
//         delulu.address,
//         { client: { wallet: creator } }
//       );
//       await deluluAsCreator.write.createDelusion(["Test claim", deadline]);

//       const stakeAmount = parseEther("100");
//       await approveAndStake(
//         mockCUSD,
//         delulu,
//         believer1,
//         1n,
//         stakeAmount,
//         true
//       );
//       await approveAndStake(
//         mockCUSD,
//         delulu,
//         believer1,
//         1n,
//         stakeAmount,
//         true
//       );

//       const delusion = await delulu.read.getDelusion([1n]);
//       expect(delusion.believerCount).to.equal(1n); // Still 1 unique believer

//       const netAmountPerStake =
//         stakeAmount - (stakeAmount * PLATFORM_FEE_BPS) / BPS_DENOMINATOR;
//       expect(delusion.believePool).to.equal(netAmountPerStake * 2n);
//     });

//     it("Should emit StakePlaced event", async function () {
//       const { delulu, mockCUSD, creator, believer1, publicClient } =
//         await loadFixture(deployDeluluFixture);

//       const deadline = BigInt((await time.latest()) + 30 * 24 * 60 * 60);
//       const deluluAsCreator = await hre.viem.getContractAt(
//         "Delulu",
//         delulu.address,
//         { client: { wallet: creator } }
//       );
//       await deluluAsCreator.write.createDelusion(["Test claim", deadline]);

//       const stakeAmount = parseEther("100");
//       const mockCUSDAsUser = await hre.viem.getContractAt(
//         "MockERC20",
//         mockCUSD.address,
//         { client: { wallet: believer1 } }
//       );
//       await mockCUSDAsUser.write.approve([delulu.address, stakeAmount]);

//       const deluluAsUser = await hre.viem.getContractAt(
//         "Delulu",
//         delulu.address,
//         { client: { wallet: believer1 } }
//       );
//       const hash = await deluluAsUser.write.stakeBelieve([1n, stakeAmount]);
//       await publicClient.waitForTransactionReceipt({ hash });

//       const events = await delulu.getEvents.StakePlaced();
//       expect(events).to.have.lengthOf(1);
//       expect(events[0].args.delusionId).to.equal(1n);
//       expect(events[0].args.user).to.equal(
//         getAddress(believer1.account.address)
//       );
//       expect(events[0].args.position).to.equal(1); // Believe
//     });

//     it("Should fail with zero amount", async function () {
//       const { delulu, creator, believer1 } = await loadFixture(
//         deployDeluluFixture
//       );

//       const deadline = BigInt((await time.latest()) + 30 * 24 * 60 * 60);
//       const deluluAsCreator = await hre.viem.getContractAt(
//         "Delulu",
//         delulu.address,
//         { client: { wallet: creator } }
//       );
//       await deluluAsCreator.write.createDelusion(["Test claim", deadline]);

//       const deluluAsUser = await hre.viem.getContractAt(
//         "Delulu",
//         delulu.address,
//         { client: { wallet: believer1 } }
//       );

//       await expect(
//         deluluAsUser.write.stakeBelieve([1n, 0n])
//       ).to.be.rejectedWith("Amount must be greater than 0");
//     });

//     it("Should fail after deadline", async function () {
//       const { delulu, mockCUSD, creator, believer1 } = await loadFixture(
//         deployDeluluFixture
//       );

//       const deadline = BigInt((await time.latest()) + 30 * 24 * 60 * 60);
//       const deluluAsCreator = await hre.viem.getContractAt(
//         "Delulu",
//         delulu.address,
//         { client: { wallet: creator } }
//       );
//       await deluluAsCreator.write.createDelusion(["Test claim", deadline]);

//       // Move time past deadline
//       await time.increaseTo(deadline + 1n);

//       const stakeAmount = parseEther("100");
//       const mockCUSDAsUser = await hre.viem.getContractAt(
//         "MockERC20",
//         mockCUSD.address,
//         { client: { wallet: believer1 } }
//       );
//       await mockCUSDAsUser.write.approve([delulu.address, stakeAmount]);

//       const deluluAsUser = await hre.viem.getContractAt(
//         "Delulu",
//         delulu.address,
//         { client: { wallet: believer1 } }
//       );

//       await expect(
//         deluluAsUser.write.stakeBelieve([1n, stakeAmount])
//       ).to.be.rejectedWith("Deadline passed");
//     });

//     it("Should fail if already staked on doubt", async function () {
//       const { delulu, mockCUSD, creator, doubter1 } = await loadFixture(
//         deployDeluluFixture
//       );

//       const deadline = BigInt((await time.latest()) + 30 * 24 * 60 * 60);
//       const deluluAsCreator = await hre.viem.getContractAt(
//         "Delulu",
//         delulu.address,
//         { client: { wallet: creator } }
//       );
//       await deluluAsCreator.write.createDelusion(["Test claim", deadline]);

//       // First stake on doubt
//       const stakeAmount = parseEther("100");
//       await approveAndStake(mockCUSD, delulu, doubter1, 1n, stakeAmount, false);

//       // Try to stake on believe
//       const mockCUSDAsUser = await hre.viem.getContractAt(
//         "MockERC20",
//         mockCUSD.address,
//         { client: { wallet: doubter1 } }
//       );
//       await mockCUSDAsUser.write.approve([delulu.address, stakeAmount]);

//       const deluluAsUser = await hre.viem.getContractAt(
//         "Delulu",
//         delulu.address,
//         { client: { wallet: doubter1 } }
//       );

//       await expect(
//         deluluAsUser.write.stakeBelieve([1n, stakeAmount])
//       ).to.be.rejectedWith("Already staked on Doubt. Use switch function.");
//     });
//   });

//   // ============================================================
//   // STAKING - DOUBT TESTS
//   // ============================================================

//   describe("Staking - Doubt", function () {
//     it("Should allow a user to stake on doubt", async function () {
//       const { delulu, mockCUSD, creator, doubter1 } = await loadFixture(
//         deployDeluluFixture
//       );

//       const deadline = BigInt((await time.latest()) + 30 * 24 * 60 * 60);
//       const deluluAsCreator = await hre.viem.getContractAt(
//         "Delulu",
//         delulu.address,
//         { client: { wallet: creator } }
//       );
//       await deluluAsCreator.write.createDelusion(["Test claim", deadline]);

//       const stakeAmount = parseEther("100");
//       await approveAndStake(mockCUSD, delulu, doubter1, 1n, stakeAmount, false);

//       const delusion = await delulu.read.getDelusion([1n]);
//       expect(delusion.doubterCount).to.equal(1n);

//       const platformFee = (stakeAmount * PLATFORM_FEE_BPS) / BPS_DENOMINATOR;
//       const netAmount = stakeAmount - platformFee;

//       expect(delusion.doubtPool).to.equal(netAmount);
//     });

//     it("Should allow multiple users to stake on doubt", async function () {
//       const { delulu, mockCUSD, creator, doubter1, doubter2 } =
//         await loadFixture(deployDeluluFixture);

//       const deadline = BigInt((await time.latest()) + 30 * 24 * 60 * 60);
//       const deluluAsCreator = await hre.viem.getContractAt(
//         "Delulu",
//         delulu.address,
//         { client: { wallet: creator } }
//       );
//       await deluluAsCreator.write.createDelusion(["Test claim", deadline]);

//       const stakeAmount = parseEther("100");
//       await approveAndStake(mockCUSD, delulu, doubter1, 1n, stakeAmount, false);
//       await approveAndStake(mockCUSD, delulu, doubter2, 1n, stakeAmount, false);

//       const delusion = await delulu.read.getDelusion([1n]);
//       expect(delusion.doubterCount).to.equal(2n);
//     });

//     it("Should fail if already staked on believe", async function () {
//       const { delulu, mockCUSD, creator, believer1 } = await loadFixture(
//         deployDeluluFixture
//       );

//       const deadline = BigInt((await time.latest()) + 30 * 24 * 60 * 60);
//       const deluluAsCreator = await hre.viem.getContractAt(
//         "Delulu",
//         delulu.address,
//         { client: { wallet: creator } }
//       );
//       await deluluAsCreator.write.createDelusion(["Test claim", deadline]);

//       // First stake on believe
//       const stakeAmount = parseEther("100");
//       await approveAndStake(mockCUSD, delulu, believer1, 1n, stakeAmount, true);

//       // Try to stake on doubt
//       const mockCUSDAsUser = await hre.viem.getContractAt(
//         "MockERC20",
//         mockCUSD.address,
//         { client: { wallet: believer1 } }
//       );
//       await mockCUSDAsUser.write.approve([delulu.address, stakeAmount]);

//       const deluluAsUser = await hre.viem.getContractAt(
//         "Delulu",
//         delulu.address,
//         { client: { wallet: believer1 } }
//       );

//       await expect(
//         deluluAsUser.write.stakeDoubt([1n, stakeAmount])
//       ).to.be.rejectedWith("Already staked on Believe. Use switch function.");
//     });
//   });

//   // ============================================================
//   // SWITCHING TESTS
//   // ============================================================

//   describe("Switching Stakes", function () {
//     it("Should allow switching from doubt to believe", async function () {
//       const { delulu, mockCUSD, creator, doubter1 } = await loadFixture(
//         deployDeluluFixture
//       );

//       const deadline = BigInt((await time.latest()) + 30 * 24 * 60 * 60);
//       const deluluAsCreator = await hre.viem.getContractAt(
//         "Delulu",
//         delulu.address,
//         { client: { wallet: creator } }
//       );
//       await deluluAsCreator.write.createDelusion(["Test claim", deadline]);

//       const stakeAmount = parseEther("100");
//       await approveAndStake(mockCUSD, delulu, doubter1, 1n, stakeAmount, false);

//       // Switch to believe
//       const deluluAsUser = await hre.viem.getContractAt(
//         "Delulu",
//         delulu.address,
//         { client: { wallet: doubter1 } }
//       );
//       await deluluAsUser.write.switchToBelieve([1n]);

//       const delusion = await delulu.read.getDelusion([1n]);
//       expect(delusion.believerCount).to.equal(1n);
//       expect(delusion.doubterCount).to.equal(0n);
//       expect(delusion.doubtPool).to.equal(0n);
//     });

//     it("Should allow switching from believe to doubt", async function () {
//       const { delulu, mockCUSD, creator, believer1 } = await loadFixture(
//         deployDeluluFixture
//       );

//       const deadline = BigInt((await time.latest()) + 30 * 24 * 60 * 60);
//       const deluluAsCreator = await hre.viem.getContractAt(
//         "Delulu",
//         delulu.address,
//         { client: { wallet: creator } }
//       );
//       await deluluAsCreator.write.createDelusion(["Test claim", deadline]);

//       const stakeAmount = parseEther("100");
//       await approveAndStake(mockCUSD, delulu, believer1, 1n, stakeAmount, true);

//       // Switch to doubt
//       const deluluAsUser = await hre.viem.getContractAt(
//         "Delulu",
//         delulu.address,
//         { client: { wallet: believer1 } }
//       );
//       await deluluAsUser.write.switchToDoubt([1n]);

//       const delusion = await delulu.read.getDelusion([1n]);
//       expect(delusion.believerCount).to.equal(0n);
//       expect(delusion.doubterCount).to.equal(1n);
//       expect(delusion.believePool).to.equal(0n);
//     });

//     it("Should apply minimum penalty when switching early", async function () {
//       const { delulu, mockCUSD, creator, believer1 } = await loadFixture(
//         deployDeluluFixture
//       );

//       const deadline = BigInt((await time.latest()) + 30 * 24 * 60 * 60);
//       const deluluAsCreator = await hre.viem.getContractAt(
//         "Delulu",
//         delulu.address,
//         { client: { wallet: creator } }
//       );
//       await deluluAsCreator.write.createDelusion(["Test claim", deadline]);

//       const stakeAmount = parseEther("100");
//       const platformFee = (stakeAmount * PLATFORM_FEE_BPS) / BPS_DENOMINATOR;
//       const netStake = stakeAmount - platformFee;

//       await approveAndStake(mockCUSD, delulu, believer1, 1n, stakeAmount, true);

//       // Switch immediately (should apply ~0.5% penalty)
//       const deluluAsUser = await hre.viem.getContractAt(
//         "Delulu",
//         delulu.address,
//         { client: { wallet: believer1 } }
//       );
//       await deluluAsUser.write.switchToDoubt([1n]);

//       const delusion = await delulu.read.getDelusion([1n]);

//       // Calculate expected amount after minimum switch penalty
//       const minPenalty = (netStake * MIN_SWITCH_PENALTY_BPS) / BPS_DENOMINATOR;
//       const expectedAmount = netStake - minPenalty;

//       // Allow small rounding tolerance (within 0.1%)
//       const lowerBound = (expectedAmount * 999n) / 1000n;
//       const upperBound = (expectedAmount * 1001n) / 1000n;
//       expect(delusion.doubtPool).to.be.greaterThanOrEqual(lowerBound);
//       expect(delusion.doubtPool).to.be.lessThanOrEqual(upperBound);
//     });

//     it("Should apply higher penalty when switching closer to deadline", async function () {
//       const { delulu, mockCUSD, creator, believer1 } = await loadFixture(
//         deployDeluluFixture
//       );

//       const durationSeconds = 30 * 24 * 60 * 60; // 30 days
//       const deadline = BigInt((await time.latest()) + durationSeconds);
//       const deluluAsCreator = await hre.viem.getContractAt(
//         "Delulu",
//         delulu.address,
//         { client: { wallet: creator } }
//       );
//       await deluluAsCreator.write.createDelusion(["Test claim", deadline]);

//       const stakeAmount = parseEther("100");
//       const platformFee = (stakeAmount * PLATFORM_FEE_BPS) / BPS_DENOMINATOR;
//       const netStake = stakeAmount - platformFee;

//       await approveAndStake(mockCUSD, delulu, believer1, 1n, stakeAmount, true);

//       // Move to 90% through the duration
//       await time.increase(BigInt(Math.floor(durationSeconds * 0.9)));

//       const deluluAsUser = await hre.viem.getContractAt(
//         "Delulu",
//         delulu.address,
//         { client: { wallet: believer1 } }
//       );
//       await deluluAsUser.write.switchToDoubt([1n]);

//       const delusion = await delulu.read.getDelusion([1n]);

//       // At 90% elapsed time, quadratic penalty should be significant
//       // progressSquared ≈ 0.81, so penalty ≈ 0.5% + 0.81 * (10% - 0.5%) ≈ 8.2%
//       const minPenalty = (netStake * MIN_SWITCH_PENALTY_BPS) / BPS_DENOMINATOR;
      
//       // The penalty should be significantly higher than minimum
//       expect(delusion.doubtPool < netStake - minPenalty).to.be.true;
//     });

//     it("Should emit StakeSwitched event", async function () {
//       const { delulu, mockCUSD, creator, believer1, publicClient } =
//         await loadFixture(deployDeluluFixture);

//       const deadline = BigInt((await time.latest()) + 30 * 24 * 60 * 60);
//       const deluluAsCreator = await hre.viem.getContractAt(
//         "Delulu",
//         delulu.address,
//         { client: { wallet: creator } }
//       );
//       await deluluAsCreator.write.createDelusion(["Test claim", deadline]);

//       const stakeAmount = parseEther("100");
//       await approveAndStake(mockCUSD, delulu, believer1, 1n, stakeAmount, true);

//       const deluluAsUser = await hre.viem.getContractAt(
//         "Delulu",
//         delulu.address,
//         { client: { wallet: believer1 } }
//       );
//       const hash = await deluluAsUser.write.switchToDoubt([1n]);
//       await publicClient.waitForTransactionReceipt({ hash });

//       const events = await delulu.getEvents.StakeSwitched();
//       expect(events).to.have.lengthOf(1);
//       expect(events[0].args.delusionId).to.equal(1n);
//       expect(events[0].args.user).to.equal(
//         getAddress(believer1.account.address)
//       );
//       expect(events[0].args.fromPosition).to.equal(1); // Believe
//       expect(events[0].args.toPosition).to.equal(2); // Doubt
//     });

//     it("Should fail when no stake to switch", async function () {
//       const { delulu, creator, believer1 } = await loadFixture(
//         deployDeluluFixture
//       );

//       const deadline = BigInt((await time.latest()) + 30 * 24 * 60 * 60);
//       const deluluAsCreator = await hre.viem.getContractAt(
//         "Delulu",
//         delulu.address,
//         { client: { wallet: creator } }
//       );
//       await deluluAsCreator.write.createDelusion(["Test claim", deadline]);

//       const deluluAsUser = await hre.viem.getContractAt(
//         "Delulu",
//         delulu.address,
//         { client: { wallet: believer1 } }
//       );

//       await expect(
//         deluluAsUser.write.switchToBelieve([1n])
//       ).to.be.rejectedWith("Not staked on Doubt");
//     });

//     it("Should fail switching after deadline", async function () {
//       const { delulu, mockCUSD, creator, believer1 } = await loadFixture(
//         deployDeluluFixture
//       );

//       const deadline = BigInt((await time.latest()) + 30 * 24 * 60 * 60);
//       const deluluAsCreator = await hre.viem.getContractAt(
//         "Delulu",
//         delulu.address,
//         { client: { wallet: creator } }
//       );
//       await deluluAsCreator.write.createDelusion(["Test claim", deadline]);

//       const stakeAmount = parseEther("100");
//       await approveAndStake(mockCUSD, delulu, believer1, 1n, stakeAmount, true);

//       // Move past deadline
//       await time.increaseTo(deadline + 1n);

//       const deluluAsUser = await hre.viem.getContractAt(
//         "Delulu",
//         delulu.address,
//         { client: { wallet: believer1 } }
//       );

//       await expect(
//         deluluAsUser.write.switchToDoubt([1n])
//       ).to.be.rejectedWith("Deadline passed");
//     });
//   });

//   // ============================================================
//   // WITHDRAWAL TESTS
//   // ============================================================

//   describe("Withdrawal", function () {
//     it("Should allow early withdrawal with 5% penalty", async function () {
//       const { delulu, mockCUSD, creator, believer1, publicClient } =
//         await loadFixture(deployDeluluFixture);

//       const deadline = BigInt((await time.latest()) + 30 * 24 * 60 * 60);
//       const deluluAsCreator = await hre.viem.getContractAt(
//         "Delulu",
//         delulu.address,
//         { client: { wallet: creator } }
//       );
//       await deluluAsCreator.write.createDelusion(["Test claim", deadline]);

//       const stakeAmount = parseEther("100");
//       await approveAndStake(mockCUSD, delulu, believer1, 1n, stakeAmount, true);

//       const platformFee = (stakeAmount * PLATFORM_FEE_BPS) / BPS_DENOMINATOR;
//       const netStake = stakeAmount - platformFee;

//       const balanceBefore = await mockCUSD.read.balanceOf([
//         believer1.account.address,
//       ]);

//       const deluluAsUser = await hre.viem.getContractAt(
//         "Delulu",
//         delulu.address,
//         { client: { wallet: believer1 } }
//       );
//       await deluluAsUser.write.withdrawStake([1n]);

//       const balanceAfter = await mockCUSD.read.balanceOf([
//         believer1.account.address,
//       ]);

//       const withdrawalPenalty =
//         (netStake * WITHDRAWAL_PENALTY_BPS) / BPS_DENOMINATOR;
//       const expectedWithdrawal = netStake - withdrawalPenalty;

//       expect(balanceAfter - balanceBefore).to.equal(expectedWithdrawal);
//     });

//     it("Should update pools and counts after withdrawal", async function () {
//       const { delulu, mockCUSD, creator, believer1 } = await loadFixture(
//         deployDeluluFixture
//       );

//       const deadline = BigInt((await time.latest()) + 30 * 24 * 60 * 60);
//       const deluluAsCreator = await hre.viem.getContractAt(
//         "Delulu",
//         delulu.address,
//         { client: { wallet: creator } }
//       );
//       await deluluAsCreator.write.createDelusion(["Test claim", deadline]);

//       const stakeAmount = parseEther("100");
//       await approveAndStake(mockCUSD, delulu, believer1, 1n, stakeAmount, true);

//       const deluluAsUser = await hre.viem.getContractAt(
//         "Delulu",
//         delulu.address,
//         { client: { wallet: believer1 } }
//       );
//       await deluluAsUser.write.withdrawStake([1n]);

//       const delusion = await delulu.read.getDelusion([1n]);
//       expect(delusion.believePool).to.equal(0n);
//       expect(delusion.believerCount).to.equal(0n);
//     });

//     it("Should send penalty to vaults", async function () {
//       const { delulu, mockCUSD, creator, believer1 } = await loadFixture(
//         deployDeluluFixture
//       );

//       const deadline = BigInt((await time.latest()) + 30 * 24 * 60 * 60);
//       const deluluAsCreator = await hre.viem.getContractAt(
//         "Delulu",
//         delulu.address,
//         { client: { wallet: creator } }
//       );
//       await deluluAsCreator.write.createDelusion(["Test claim", deadline]);

//       const stakeAmount = parseEther("100");
//       await approveAndStake(mockCUSD, delulu, believer1, 1n, stakeAmount, true);

//       const platformVaultBefore = await delulu.read.platformVault();
//       const climateVaultBefore = await delulu.read.climateVault();

//       const deluluAsUser = await hre.viem.getContractAt(
//         "Delulu",
//         delulu.address,
//         { client: { wallet: believer1 } }
//       );
//       await deluluAsUser.write.withdrawStake([1n]);

//       const platformVaultAfter = await delulu.read.platformVault();
//       const climateVaultAfter = await delulu.read.climateVault();

//       expect(platformVaultAfter > platformVaultBefore).to.be.true;
//       expect(climateVaultAfter > climateVaultBefore).to.be.true;
//     });

//     it("Should emit StakeWithdrawn event", async function () {
//       const { delulu, mockCUSD, creator, believer1, publicClient } =
//         await loadFixture(deployDeluluFixture);

//       const deadline = BigInt((await time.latest()) + 30 * 24 * 60 * 60);
//       const deluluAsCreator = await hre.viem.getContractAt(
//         "Delulu",
//         delulu.address,
//         { client: { wallet: creator } }
//       );
//       await deluluAsCreator.write.createDelusion(["Test claim", deadline]);

//       const stakeAmount = parseEther("100");
//       await approveAndStake(mockCUSD, delulu, believer1, 1n, stakeAmount, true);

//       const deluluAsUser = await hre.viem.getContractAt(
//         "Delulu",
//         delulu.address,
//         { client: { wallet: believer1 } }
//       );
//       const hash = await deluluAsUser.write.withdrawStake([1n]);
//       await publicClient.waitForTransactionReceipt({ hash });

//       const events = await delulu.getEvents.StakeWithdrawn();
//       expect(events).to.have.lengthOf(1);
//       expect(events[0].args.delusionId).to.equal(1n);
//       expect(events[0].args.user).to.equal(
//         getAddress(believer1.account.address)
//       );
//     });

//     it("Should fail if no stake to withdraw", async function () {
//       const { delulu, creator, believer1 } = await loadFixture(
//         deployDeluluFixture
//       );

//       const deadline = BigInt((await time.latest()) + 30 * 24 * 60 * 60);
//       const deluluAsCreator = await hre.viem.getContractAt(
//         "Delulu",
//         delulu.address,
//         { client: { wallet: creator } }
//       );
//       await deluluAsCreator.write.createDelusion(["Test claim", deadline]);

//       const deluluAsUser = await hre.viem.getContractAt(
//         "Delulu",
//         delulu.address,
//         { client: { wallet: believer1 } }
//       );

//       await expect(
//         deluluAsUser.write.withdrawStake([1n])
//       ).to.be.rejectedWith("No stake to withdraw");
//     });

//     it("Should fail to withdraw after deadline", async function () {
//       const { delulu, mockCUSD, creator, believer1 } = await loadFixture(
//         deployDeluluFixture
//       );

//       const deadline = BigInt((await time.latest()) + 30 * 24 * 60 * 60);
//       const deluluAsCreator = await hre.viem.getContractAt(
//         "Delulu",
//         delulu.address,
//         { client: { wallet: creator } }
//       );
//       await deluluAsCreator.write.createDelusion(["Test claim", deadline]);

//       const stakeAmount = parseEther("100");
//       await approveAndStake(mockCUSD, delulu, believer1, 1n, stakeAmount, true);

//       // Move past deadline
//       await time.increaseTo(deadline + 1n);

//       const deluluAsUser = await hre.viem.getContractAt(
//         "Delulu",
//         delulu.address,
//         { client: { wallet: believer1 } }
//       );

//       await expect(
//         deluluAsUser.write.withdrawStake([1n])
//       ).to.be.rejectedWith("Deadline passed");
//     });
//   });

//   // ============================================================
//   // FINALIZATION TESTS
//   // ============================================================

//   describe("Finalization", function () {
//     it("Should allow creator to finalize as success", async function () {
//       const { delulu, mockCUSD, creator, believer1, doubter1 } =
//         await loadFixture(deployDeluluFixture);

//       const deadline = BigInt((await time.latest()) + 30 * 24 * 60 * 60);
//       const deluluAsCreator = await hre.viem.getContractAt(
//         "Delulu",
//         delulu.address,
//         { client: { wallet: creator } }
//       );
//       await deluluAsCreator.write.createDelusion(["Test claim", deadline]);

//       const stakeAmount = parseEther("100");
//       await approveAndStake(mockCUSD, delulu, believer1, 1n, stakeAmount, true);
//       await approveAndStake(mockCUSD, delulu, doubter1, 1n, stakeAmount, false);

//       // Move past deadline
//       await time.increaseTo(deadline + 1n);

//       await deluluAsCreator.write.finalizeDelusionSuccess([1n]);

//       const delusion = await delulu.read.getDelusion([1n]);
//       expect(delusion.status).to.equal(1); // SuccessFinalized
//     });

//     it("Should allow creator to finalize as fail", async function () {
//       const { delulu, mockCUSD, creator, believer1, doubter1 } =
//         await loadFixture(deployDeluluFixture);

//       const deadline = BigInt((await time.latest()) + 30 * 24 * 60 * 60);
//       const deluluAsCreator = await hre.viem.getContractAt(
//         "Delulu",
//         delulu.address,
//         { client: { wallet: creator } }
//       );
//       await deluluAsCreator.write.createDelusion(["Test claim", deadline]);

//       const stakeAmount = parseEther("100");
//       await approveAndStake(mockCUSD, delulu, believer1, 1n, stakeAmount, true);
//       await approveAndStake(mockCUSD, delulu, doubter1, 1n, stakeAmount, false);

//       // Move past deadline
//       await time.increaseTo(deadline + 1n);

//       await deluluAsCreator.write.finalizeDelusionFail([1n]);

//       const delusion = await delulu.read.getDelusion([1n]);
//       expect(delusion.status).to.equal(2); // FailedFinalized
//     });

//     it("Should emit DelusionFinalized event", async function () {
//       const { delulu, mockCUSD, creator, believer1, publicClient } =
//         await loadFixture(deployDeluluFixture);

//       const deadline = BigInt((await time.latest()) + 30 * 24 * 60 * 60);
//       const deluluAsCreator = await hre.viem.getContractAt(
//         "Delulu",
//         delulu.address,
//         { client: { wallet: creator } }
//       );
//       await deluluAsCreator.write.createDelusion(["Test claim", deadline]);

//       const stakeAmount = parseEther("100");
//       await approveAndStake(mockCUSD, delulu, believer1, 1n, stakeAmount, true);

//       await time.increaseTo(deadline + 1n);

//       const hash = await deluluAsCreator.write.finalizeDelusionSuccess([1n]);
//       await publicClient.waitForTransactionReceipt({ hash });

//       const events = await delulu.getEvents.DelusionFinalized();
//       expect(events).to.have.lengthOf(1);
//       expect(events[0].args.delusionId).to.equal(1n);
//       expect(events[0].args.outcome).to.equal(1); // SuccessFinalized
//     });

//     it("Should fail if not creator", async function () {
//       const { delulu, creator, believer1 } = await loadFixture(
//         deployDeluluFixture
//       );

//       const deadline = BigInt((await time.latest()) + 30 * 24 * 60 * 60);
//       const deluluAsCreator = await hre.viem.getContractAt(
//         "Delulu",
//         delulu.address,
//         { client: { wallet: creator } }
//       );
//       await deluluAsCreator.write.createDelusion(["Test claim", deadline]);

//       await time.increaseTo(deadline + 1n);

//       const deluluAsUser = await hre.viem.getContractAt(
//         "Delulu",
//         delulu.address,
//         { client: { wallet: believer1 } }
//       );

//       await expect(
//         deluluAsUser.write.finalizeDelusionSuccess([1n])
//       ).to.be.rejectedWith("Only creator can finalize");
//     });

//     it("Should fail if before deadline", async function () {
//       const { delulu, creator } = await loadFixture(deployDeluluFixture);

//       const deadline = BigInt((await time.latest()) + 30 * 24 * 60 * 60);
//       const deluluAsCreator = await hre.viem.getContractAt(
//         "Delulu",
//         delulu.address,
//         { client: { wallet: creator } }
//       );
//       await deluluAsCreator.write.createDelusion(["Test claim", deadline]);

//       await expect(
//         deluluAsCreator.write.finalizeDelusionSuccess([1n])
//       ).to.be.rejectedWith("Deadline not reached");
//     });
//   });

//   // ============================================================
//   // CLAIMING REWARDS TESTS
//   // ============================================================

//   describe("Claiming Rewards", function () {
//     it("Should allow winner (believer) to claim proportional reward", async function () {
//       const { delulu, mockCUSD, creator, believer1, doubter1 } =
//         await loadFixture(deployDeluluFixture);

//       const deadline = BigInt((await time.latest()) + 30 * 24 * 60 * 60);
//       const deluluAsCreator = await hre.viem.getContractAt(
//         "Delulu",
//         delulu.address,
//         { client: { wallet: creator } }
//       );
//       await deluluAsCreator.write.createDelusion(["Test claim", deadline]);

//       const stakeAmount = parseEther("100");
//       await approveAndStake(mockCUSD, delulu, believer1, 1n, stakeAmount, true);
//       await approveAndStake(mockCUSD, delulu, doubter1, 1n, stakeAmount, false);

//       await time.increaseTo(deadline + 1n);
//       await deluluAsCreator.write.finalizeDelusionSuccess([1n]);

//       const balanceBefore = await mockCUSD.read.balanceOf([
//         believer1.account.address,
//       ]);

//       const deluluAsUser = await hre.viem.getContractAt(
//         "Delulu",
//         delulu.address,
//         { client: { wallet: believer1 } }
//       );
//       await deluluAsUser.write.claim([1n]);

//       const balanceAfter = await mockCUSD.read.balanceOf([
//         believer1.account.address,
//       ]);

//       const platformFee = (stakeAmount * PLATFORM_FEE_BPS) / BPS_DENOMINATOR;
//       const netStake = stakeAmount - platformFee;

//       // Believer should get their stake + the entire losing pool (since they're the only winner)
//       const expectedReward = netStake * 2n;

//       expect(balanceAfter - balanceBefore).to.equal(expectedReward);
//     });

//     it("Should allow winner (doubter) to claim proportional reward", async function () {
//       const { delulu, mockCUSD, creator, believer1, doubter1 } =
//         await loadFixture(deployDeluluFixture);

//       const deadline = BigInt((await time.latest()) + 30 * 24 * 60 * 60);
//       const deluluAsCreator = await hre.viem.getContractAt(
//         "Delulu",
//         delulu.address,
//         { client: { wallet: creator } }
//       );
//       await deluluAsCreator.write.createDelusion(["Test claim", deadline]);

//       const stakeAmount = parseEther("100");
//       await approveAndStake(mockCUSD, delulu, believer1, 1n, stakeAmount, true);
//       await approveAndStake(mockCUSD, delulu, doubter1, 1n, stakeAmount, false);

//       await time.increaseTo(deadline + 1n);
//       await deluluAsCreator.write.finalizeDelusionFail([1n]);

//       const balanceBefore = await mockCUSD.read.balanceOf([
//         doubter1.account.address,
//       ]);

//       const deluluAsUser = await hre.viem.getContractAt(
//         "Delulu",
//         delulu.address,
//         { client: { wallet: doubter1 } }
//       );
//       await deluluAsUser.write.claim([1n]);

//       const balanceAfter = await mockCUSD.read.balanceOf([
//         doubter1.account.address,
//       ]);

//       const platformFee = (stakeAmount * PLATFORM_FEE_BPS) / BPS_DENOMINATOR;
//       const netStake = stakeAmount - platformFee;

//       const expectedReward = netStake * 2n;

//       expect(balanceAfter - balanceBefore).to.equal(expectedReward);
//     });

//     it("Should distribute rewards proportionally among multiple winners", async function () {
//       const { delulu, mockCUSD, creator, believer1, believer2, doubter1 } =
//         await loadFixture(deployDeluluFixture);

//       const deadline = BigInt((await time.latest()) + 30 * 24 * 60 * 60);
//       const deluluAsCreator = await hre.viem.getContractAt(
//         "Delulu",
//         delulu.address,
//         { client: { wallet: creator } }
//       );
//       await deluluAsCreator.write.createDelusion(["Test claim", deadline]);

//       const believerStake = parseEther("100");
//       const doubterStake = parseEther("200");

//       await approveAndStake(
//         mockCUSD,
//         delulu,
//         believer1,
//         1n,
//         believerStake,
//         true
//       );
//       await approveAndStake(
//         mockCUSD,
//         delulu,
//         believer2,
//         1n,
//         believerStake,
//         true
//       );
//       await approveAndStake(
//         mockCUSD,
//         delulu,
//         doubter1,
//         1n,
//         doubterStake,
//         false
//       );

//       await time.increaseTo(deadline + 1n);
//       await deluluAsCreator.write.finalizeDelusionSuccess([1n]);

//       // Both believers should get proportional rewards
//       const deluluAsBeliever1 = await hre.viem.getContractAt(
//         "Delulu",
//         delulu.address,
//         { client: { wallet: believer1 } }
//       );
//       const deluluAsBeliever2 = await hre.viem.getContractAt(
//         "Delulu",
//         delulu.address,
//         { client: { wallet: believer2 } }
//       );

//       const balance1Before = await mockCUSD.read.balanceOf([
//         believer1.account.address,
//       ]);
//       await deluluAsBeliever1.write.claim([1n]);
//       const balance1After = await mockCUSD.read.balanceOf([
//         believer1.account.address,
//       ]);

//       const balance2Before = await mockCUSD.read.balanceOf([
//         believer2.account.address,
//       ]);
//       await deluluAsBeliever2.write.claim([1n]);
//       const balance2After = await mockCUSD.read.balanceOf([
//         believer2.account.address,
//       ]);

//       const reward1 = balance1After - balance1Before;
//       const reward2 = balance2After - balance2Before;

//       // Both believers staked equally, so they should get equal rewards
//       expect(reward1).to.equal(reward2);

//       // Total rewards should equal total stakes (minus fees)
//       const totalRewards = reward1 + reward2;
//       expect(totalRewards > believerStake * 2n).to.be.true;
//     });

//     it("Should return only stake if no losing pool", async function () {
//       const { delulu, mockCUSD, creator, believer1 } = await loadFixture(
//         deployDeluluFixture
//       );

//       const deadline = BigInt((await time.latest()) + 30 * 24 * 60 * 60);
//       const deluluAsCreator = await hre.viem.getContractAt(
//         "Delulu",
//         delulu.address,
//         { client: { wallet: creator } }
//       );
//       await deluluAsCreator.write.createDelusion(["Test claim", deadline]);

//       const stakeAmount = parseEther("100");
//       await approveAndStake(mockCUSD, delulu, believer1, 1n, stakeAmount, true);

//       await time.increaseTo(deadline + 1n);
//       await deluluAsCreator.write.finalizeDelusionSuccess([1n]);

//       const balanceBefore = await mockCUSD.read.balanceOf([
//         believer1.account.address,
//       ]);

//       const deluluAsUser = await hre.viem.getContractAt(
//         "Delulu",
//         delulu.address,
//         { client: { wallet: believer1 } }
//       );
//       await deluluAsUser.write.claim([1n]);

//       const balanceAfter = await mockCUSD.read.balanceOf([
//         believer1.account.address,
//       ]);

//       const platformFee = (stakeAmount * PLATFORM_FEE_BPS) / BPS_DENOMINATOR;
//       const netStake = stakeAmount - platformFee;

//       // Should only get stake back (no losing pool)
//       expect(balanceAfter - balanceBefore).to.equal(netStake);
//     });

//     it("Should emit RewardClaimed event", async function () {
//       const { delulu, mockCUSD, creator, believer1, doubter1, publicClient } =
//         await loadFixture(deployDeluluFixture);

//       const deadline = BigInt((await time.latest()) + 30 * 24 * 60 * 60);
//       const deluluAsCreator = await hre.viem.getContractAt(
//         "Delulu",
//         delulu.address,
//         { client: { wallet: creator } }
//       );
//       await deluluAsCreator.write.createDelusion(["Test claim", deadline]);

//       const stakeAmount = parseEther("100");
//       await approveAndStake(mockCUSD, delulu, believer1, 1n, stakeAmount, true);
//       await approveAndStake(mockCUSD, delulu, doubter1, 1n, stakeAmount, false);

//       await time.increaseTo(deadline + 1n);
//       await deluluAsCreator.write.finalizeDelusionSuccess([1n]);

//       const deluluAsUser = await hre.viem.getContractAt(
//         "Delulu",
//         delulu.address,
//         { client: { wallet: believer1 } }
//       );
//       const hash = await deluluAsUser.write.claim([1n]);
//       await publicClient.waitForTransactionReceipt({ hash });

//       const events = await delulu.getEvents.RewardClaimed();
//       expect(events).to.have.lengthOf(1);
//       expect(events[0].args.delusionId).to.equal(1n);
//       expect(events[0].args.user).to.equal(
//         getAddress(believer1.account.address)
//       );
//     });

//     it("Should fail if loser tries to claim", async function () {
//       const { delulu, mockCUSD, creator, believer1, doubter1 } =
//         await loadFixture(deployDeluluFixture);

//       const deadline = BigInt((await time.latest()) + 30 * 24 * 60 * 60);
//       const deluluAsCreator = await hre.viem.getContractAt(
//         "Delulu",
//         delulu.address,
//         { client: { wallet: creator } }
//       );
//       await deluluAsCreator.write.createDelusion(["Test claim", deadline]);

//       const stakeAmount = parseEther("100");
//       await approveAndStake(mockCUSD, delulu, believer1, 1n, stakeAmount, true);
//       await approveAndStake(mockCUSD, delulu, doubter1, 1n, stakeAmount, false);

//       await time.increaseTo(deadline + 1n);
//       await deluluAsCreator.write.finalizeDelusionSuccess([1n]); // Believers win

//       const deluluAsDoubter = await hre.viem.getContractAt(
//         "Delulu",
//         delulu.address,
//         { client: { wallet: doubter1 } }
//       );

//       await expect(deluluAsDoubter.write.claim([1n])).to.be.rejectedWith(
//         "No reward to claim"
//       );
//     });

//     it("Should fail if claiming before finalization", async function () {
//       const { delulu, mockCUSD, creator, believer1 } = await loadFixture(
//         deployDeluluFixture
//       );

//       const deadline = BigInt((await time.latest()) + 30 * 24 * 60 * 60);
//       const deluluAsCreator = await hre.viem.getContractAt(
//         "Delulu",
//         delulu.address,
//         { client: { wallet: creator } }
//       );
//       await deluluAsCreator.write.createDelusion(["Test claim", deadline]);

//       const stakeAmount = parseEther("100");
//       await approveAndStake(mockCUSD, delulu, believer1, 1n, stakeAmount, true);

//       await time.increaseTo(deadline + 1n);

//       const deluluAsUser = await hre.viem.getContractAt(
//         "Delulu",
//         delulu.address,
//         { client: { wallet: believer1 } }
//       );

//       await expect(deluluAsUser.write.claim([1n])).to.be.rejectedWith(
//         "Delusion not finalized"
//       );
//     });

//     it("Should fail on double claim", async function () {
//       const { delulu, mockCUSD, creator, believer1, doubter1 } =
//         await loadFixture(deployDeluluFixture);

//       const deadline = BigInt((await time.latest()) + 30 * 24 * 60 * 60);
//       const deluluAsCreator = await hre.viem.getContractAt(
//         "Delulu",
//         delulu.address,
//         { client: { wallet: creator } }
//       );
//       await deluluAsCreator.write.createDelusion(["Test claim", deadline]);

//       const stakeAmount = parseEther("100");
//       await approveAndStake(mockCUSD, delulu, believer1, 1n, stakeAmount, true);
//       await approveAndStake(mockCUSD, delulu, doubter1, 1n, stakeAmount, false);

//       await time.increaseTo(deadline + 1n);
//       await deluluAsCreator.write.finalizeDelusionSuccess([1n]);

//       const deluluAsUser = await hre.viem.getContractAt(
//         "Delulu",
//         delulu.address,
//         { client: { wallet: believer1 } }
//       );

//       // First claim succeeds
//       await deluluAsUser.write.claim([1n]);

//       // Second claim fails
//       await expect(deluluAsUser.write.claim([1n])).to.be.rejectedWith(
//         "Already claimed"
//       );
//     });
//   });

//   // ============================================================
//   // OWNER FUNCTIONS TESTS
//   // ============================================================

//   describe("Owner Functions", function () {
//     it("Should allow owner to claim platform fees", async function () {
//       const { delulu, mockCUSD, creator, believer1, owner } =
//         await loadFixture(deployDeluluFixture);

//       const deadline = BigInt((await time.latest()) + 30 * 24 * 60 * 60);
//       const deluluAsCreator = await hre.viem.getContractAt(
//         "Delulu",
//         delulu.address,
//         { client: { wallet: creator } }
//       );
//       await deluluAsCreator.write.createDelusion(["Test claim", deadline]);

//       const stakeAmount = parseEther("100");
//       await approveAndStake(mockCUSD, delulu, believer1, 1n, stakeAmount, true);

//       const platformVaultBefore = await delulu.read.platformVault();
//       expect(platformVaultBefore > 0n).to.be.true;

//       const balanceBefore = await mockCUSD.read.balanceOf([
//         owner.account.address,
//       ]);

//       await delulu.write.claimPlatformFees();

//       const balanceAfter = await mockCUSD.read.balanceOf([
//         owner.account.address,
//       ]);

//       expect(balanceAfter - balanceBefore).to.equal(platformVaultBefore);
//       expect(await delulu.read.platformVault()).to.equal(0n);
//     });

//     it("Should allow owner to claim climate fees", async function () {
//       const { delulu, mockCUSD, creator, believer1, owner } =
//         await loadFixture(deployDeluluFixture);

//       const deadline = BigInt((await time.latest()) + 30 * 24 * 60 * 60);
//       const deluluAsCreator = await hre.viem.getContractAt(
//         "Delulu",
//         delulu.address,
//         { client: { wallet: creator } }
//       );
//       await deluluAsCreator.write.createDelusion(["Test claim", deadline]);

//       const stakeAmount = parseEther("100");
//       await approveAndStake(mockCUSD, delulu, believer1, 1n, stakeAmount, true);

//       const climateVaultBefore = await delulu.read.climateVault();
//       expect(climateVaultBefore > 0n).to.be.true;

//       const balanceBefore = await mockCUSD.read.balanceOf([
//         owner.account.address,
//       ]);

//       await delulu.write.claimClimateFees();

//       const balanceAfter = await mockCUSD.read.balanceOf([
//         owner.account.address,
//       ]);

//       expect(balanceAfter - balanceBefore).to.equal(climateVaultBefore);
//       expect(await delulu.read.climateVault()).to.equal(0n);
//     });

//     it("Should emit fee collection events", async function () {
//       const { delulu, mockCUSD, creator, believer1, publicClient } =
//         await loadFixture(deployDeluluFixture);

//       const deadline = BigInt((await time.latest()) + 30 * 24 * 60 * 60);
//       const deluluAsCreator = await hre.viem.getContractAt(
//         "Delulu",
//         delulu.address,
//         { client: { wallet: creator } }
//       );
//       await deluluAsCreator.write.createDelusion(["Test claim", deadline]);

//       const stakeAmount = parseEther("100");
//       await approveAndStake(mockCUSD, delulu, believer1, 1n, stakeAmount, true);

//       const hash = await delulu.write.claimPlatformFees();
//       await publicClient.waitForTransactionReceipt({ hash });

//       const events = await delulu.getEvents.PlatformFeesCollected();
//       expect(events).to.have.lengthOf(1);
//     });

//     it("Should fail if non-owner tries to claim fees", async function () {
//       const { delulu, mockCUSD, creator, believer1 } = await loadFixture(
//         deployDeluluFixture
//       );

//       const deadline = BigInt((await time.latest()) + 30 * 24 * 60 * 60);
//       const deluluAsCreator = await hre.viem.getContractAt(
//         "Delulu",
//         delulu.address,
//         { client: { wallet: creator } }
//       );
//       await deluluAsCreator.write.createDelusion(["Test claim", deadline]);

//       const stakeAmount = parseEther("100");
//       await approveAndStake(mockCUSD, delulu, believer1, 1n, stakeAmount, true);

//       const deluluAsUser = await hre.viem.getContractAt(
//         "Delulu",
//         delulu.address,
//         { client: { wallet: believer1 } }
//       );

//       await expect(
//         deluluAsUser.write.claimPlatformFees()
//       ).to.be.rejectedWith("OwnableUnauthorizedAccount");
//     });

//     it("Should fail claiming with zero fees", async function () {
//       const { delulu } = await loadFixture(deployDeluluFixture);

//       await expect(delulu.write.claimPlatformFees()).to.be.rejectedWith(
//         "No platform fees to claim"
//       );
//     });
//   });

//   // ============================================================
//   // VIEW FUNCTIONS TESTS
//   // ============================================================

//   describe("View Functions", function () {
//     it("Should return correct delusion data", async function () {
//       const { delulu, creator } = await loadFixture(deployDeluluFixture);

//       const claimText = "Test claim";
//       const deadline = BigInt((await time.latest()) + 30 * 24 * 60 * 60);
//       const deluluAsCreator = await hre.viem.getContractAt(
//         "Delulu",
//         delulu.address,
//         { client: { wallet: creator } }
//       );
//       await deluluAsCreator.write.createDelusion([claimText, deadline]);

//       const delusion = await delulu.read.getDelusion([1n]);

//       expect(delusion.id).to.equal(1n);
//       expect(delusion.creator).to.equal(getAddress(creator.account.address));
//       expect(delusion.claimText).to.equal(claimText);
//       expect(delusion.deadline).to.equal(deadline);
//     });

//     it("Should return correct user stake data", async function () {
//       const { delulu, mockCUSD, creator, believer1 } = await loadFixture(
//         deployDeluluFixture
//       );

//       const deadline = BigInt((await time.latest()) + 30 * 24 * 60 * 60);
//       const deluluAsCreator = await hre.viem.getContractAt(
//         "Delulu",
//         delulu.address,
//         { client: { wallet: creator } }
//       );
//       await deluluAsCreator.write.createDelusion(["Test claim", deadline]);

//       const stakeAmount = parseEther("100");
//       await approveAndStake(mockCUSD, delulu, believer1, 1n, stakeAmount, true);

//       const userStake = await delulu.read.getUserStake([
//         1n,
//         believer1.account.address,
//       ]);

//       expect(userStake.position).to.equal(1); // Believe
//       expect(userStake.amount > 0n).to.be.true;
//       expect(userStake.hasClaimed).to.equal(false);
//     });

//     it("Should return correct pool amounts", async function () {
//       const { delulu, mockCUSD, creator, believer1, doubter1 } =
//         await loadFixture(deployDeluluFixture);

//       const deadline = BigInt((await time.latest()) + 30 * 24 * 60 * 60);
//       const deluluAsCreator = await hre.viem.getContractAt(
//         "Delulu",
//         delulu.address,
//         { client: { wallet: creator } }
//       );
//       await deluluAsCreator.write.createDelusion(["Test claim", deadline]);

//       const stakeAmount = parseEther("100");
//       await approveAndStake(mockCUSD, delulu, believer1, 1n, stakeAmount, true);
//       await approveAndStake(mockCUSD, delulu, doubter1, 1n, stakeAmount, false);

//       const [believePool, doubtPool] = await delulu.read.getPools([1n]);

//       expect(believePool > 0n).to.be.true;
//       expect(doubtPool > 0n).to.be.true;
//     });

//     it("Should return correct believer and doubter counts", async function () {
//       const { delulu, mockCUSD, creator, believer1, believer2, doubter1 } =
//         await loadFixture(deployDeluluFixture);

//       const deadline = BigInt((await time.latest()) + 30 * 24 * 60 * 60);
//       const deluluAsCreator = await hre.viem.getContractAt(
//         "Delulu",
//         delulu.address,
//         { client: { wallet: creator } }
//       );
//       await deluluAsCreator.write.createDelusion(["Test claim", deadline]);

//       const stakeAmount = parseEther("100");
//       await approveAndStake(mockCUSD, delulu, believer1, 1n, stakeAmount, true);
//       await approveAndStake(mockCUSD, delulu, believer2, 1n, stakeAmount, true);
//       await approveAndStake(mockCUSD, delulu, doubter1, 1n, stakeAmount, false);

//       const believerCount = await delulu.read.getBelieverCount([1n]);
//       const doubterCount = await delulu.read.getDoubterCount([1n]);

//       expect(believerCount).to.equal(2n);
//       expect(doubterCount).to.equal(1n);
//     });

//     it("Should return correct outcome status", async function () {
//       const { delulu, creator } = await loadFixture(deployDeluluFixture);

//       const deadline = BigInt((await time.latest()) + 30 * 24 * 60 * 60);
//       const deluluAsCreator = await hre.viem.getContractAt(
//         "Delulu",
//         delulu.address,
//         { client: { wallet: creator } }
//       );
//       await deluluAsCreator.write.createDelusion(["Test claim", deadline]);

//       let outcome = await delulu.read.getOutcome([1n]);
//       expect(outcome).to.equal(0); // Active

//       await time.increaseTo(deadline + 1n);
//       await deluluAsCreator.write.finalizeDelusionSuccess([1n]);

//       outcome = await delulu.read.getOutcome([1n]);
//       expect(outcome).to.equal(1); // SuccessFinalized
//     });
//   });
// });

