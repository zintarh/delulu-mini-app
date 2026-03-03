// const { time, loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
// const { expect } = require("chai");
// const hre = require("hardhat");
// const { getAddress, parseEther, zeroAddress, encodeFunctionData } = require("viem");

// const MIN_STAKE = parseEther("1");
// const MAX_STAKE_PER_USER = parseEther("100000");
// const ONE_DAY = 24n * 60n * 60n;
// const ONE_YEAR = 365n * ONE_DAY;
// const TWO_YEARS = 730n * ONE_DAY;

// function assertRevert(promise, pattern) {
//   return promise.then(
//     () => expect.fail("Expected revert"),
//     (e) => expect(String(e)).to.match(pattern)
//   );
// }

// describe("Delulu", function () {
//   async function deployFixture() {
//     const [owner, creator, player1, player2, attacker] = await hre.viem.getWalletClients();
//     const publicClient = await hre.viem.getPublicClient();

//     const cuSD = await hre.viem.deployContract("MockERC20", ["cUSD", "cUSD"]);
//     const gDollar = await hre.viem.deployContract("MockERC20", ["GoodDollar", "G$"]);
//     const implementation = await hre.viem.deployContract("Delulu", []);

//     const artifact = await hre.artifacts.readArtifact("Delulu");
//     const initData = encodeFunctionData({
//       abi: artifact.abi,
//       functionName: "initialize",
//       args: [cuSD.address],
//     });
//     const proxy = await hre.viem.deployContract("ERC1967Proxy", [implementation.address, initData]);
//     const delulu = await hre.viem.getContractAt("Delulu", proxy.address);

//     await delulu.write.setTokenSupport([gDollar.address, true]);

//     const mintAmount = parseEther("1000000");
//     for (const user of [creator, player1, player2, attacker]) {
//       await cuSD.write.mint([user.account.address, mintAmount]);
//       await gDollar.write.mint([user.account.address, mintAmount]);
//       await cuSD.write.approve([delulu.address, mintAmount], { account: user.account });
//       await gDollar.write.approve([delulu.address, mintAmount], { account: user.account });
//     }

//     return { delulu, cuSD, gDollar, owner, creator, player1, player2, attacker, publicClient };
//   }

//   // --- CREATE MARKET ---
//   describe("createDelulu", function () {
//     it("creates market and returns id", async function () {
//       const { delulu, creator, cuSD } = await loadFixture(deployFixture);
//       const latest = BigInt(await time.latest());
//       const tx = await delulu.write.createDelulu(
//         [cuSD.address, "ipfs-hash", latest + ONE_DAY, latest + 2n * ONE_DAY, parseEther("10")],
//         { account: creator.account }
//       );
//       expect(await delulu.read.nextDeluluId()).to.equal(2n);
//       const market = await delulu.read.delulus([1n]);
//       expect(market[0]).to.equal(1n);
//       expect(getAddress(market[1])).to.equal(getAddress(creator.account.address));
//       expect(getAddress(market[2])).to.equal(getAddress(cuSD.address));
//       expect(market[6]).to.equal(parseEther("10"));
//       expect(market[7]).to.equal(0n);
//       expect(market[9]).to.equal(false);
//       expect(market[10]).to.equal(false);
//     });

//     it("reverts: TokenNotSupported", async function () {
//       const { delulu, creator } = await loadFixture(deployFixture);
//       const latest = BigInt(await time.latest());
//       await assertRevert(
//         delulu.write.createDelulu(
//           [zeroAddress, "hash", latest + ONE_DAY, latest + 2n * ONE_DAY, parseEther("10")],
//           { account: creator.account }
//         ),
//         /TokenNotSupported/
//       );
//     });

//     it("reverts: EmptyContentHash", async function () {
//       const { delulu, creator, cuSD } = await loadFixture(deployFixture);
//       const latest = BigInt(await time.latest());
//       await assertRevert(
//         delulu.write.createDelulu(
//           [cuSD.address, "", latest + ONE_DAY, latest + 2n * ONE_DAY, parseEther("10")],
//           { account: creator.account }
//         ),
//         /EmptyContentHash/
//       );
//     });

//     it("reverts: StakeTooSmall", async function () {
//       const { delulu, creator, cuSD } = await loadFixture(deployFixture);
//       const latest = BigInt(await time.latest());
//       await assertRevert(
//         delulu.write.createDelulu(
//           [cuSD.address, "hash", latest + ONE_DAY, latest + 2n * ONE_DAY, parseEther("0.5")],
//           { account: creator.account }
//         ),
//         /StakeTooSmall/
//       );
//     });

//     it("reverts: InvalidDeadlines (staking in past)", async function () {
//       const { delulu, creator, cuSD } = await loadFixture(deployFixture);
//       const latest = BigInt(await time.latest());
//       await assertRevert(
//         delulu.write.createDelulu(
//           [cuSD.address, "hash", latest - 1n, latest + ONE_DAY, parseEther("10")],
//           { account: creator.account }
//         ),
//         /InvalidDeadlines/
//       );
//     });

//     it("reverts: InvalidDeadlines (resolution before staking)", async function () {
//       const { delulu, creator, cuSD } = await loadFixture(deployFixture);
//       const latest = BigInt(await time.latest());
//       await assertRevert(
//         delulu.write.createDelulu(
//           [cuSD.address, "hash", latest + ONE_DAY, latest + ONE_DAY, parseEther("10")],
//           { account: creator.account }
//         ),
//         /InvalidDeadlines/
//       );
//     });

//     it("reverts: StakingDeadlineTooFar", async function () {
//       const { delulu, creator, cuSD } = await loadFixture(deployFixture);
//       const latest = BigInt(await time.latest());
//       const tooFar = latest + ONE_YEAR + 1000n;
//       await assertRevert(
//         delulu.write.createDelulu(
//           [cuSD.address, "hash", tooFar, tooFar + ONE_DAY, parseEther("10")],
//           { account: creator.account }
//         ),
//         /StakingDeadlineTooFar/
//       );
//     });

//     it("reverts: ResolutionDeadlineTooFar", async function () {
//       const { delulu, creator, cuSD } = await loadFixture(deployFixture);
//       const latest = BigInt(await time.latest());
//       const staking = latest + ONE_DAY;
//       const resolutionTooFar = staking + TWO_YEARS + 1000n;
//       await assertRevert(
//         delulu.write.createDelulu(
//           [cuSD.address, "hash", staking, resolutionTooFar, parseEther("10")],
//           { account: creator.account }
//         ),
//         /ResolutionDeadlineTooFar/
//       );
//     });
//   });

//   // --- TOKEN MANAGEMENT ---
//   describe("setTokenSupport", function () {
//     it("only owner can whitelist", async function () {
//       const { delulu, attacker, gDollar } = await loadFixture(deployFixture);
//       await assertRevert(
//         delulu.write.setTokenSupport([gDollar.address, false], { account: attacker.account }),
//         /OwnableUnauthorizedAccount/
//       );
//     });

//     it("reverts: InvalidTokenAddress", async function () {
//       const { delulu, owner } = await loadFixture(deployFixture);
//       await assertRevert(
//         delulu.write.setTokenSupport([zeroAddress, true], { account: owner.account }),
//         /InvalidTokenAddress/
//       );
//     });

//     it("owner can add and remove token support", async function () {
//       const { delulu, owner, gDollar } = await loadFixture(deployFixture);
//       await delulu.write.setTokenSupport([gDollar.address, false], { account: owner.account });
//       expect(await delulu.read.isSupportedToken([gDollar.address])).to.equal(false);
//       await delulu.write.setTokenSupport([gDollar.address, true], { account: owner.account });
//       expect(await delulu.read.isSupportedToken([gDollar.address])).to.equal(true);
//     });
//   });

//   // --- STAKING ---
//   describe("stakeOnDelulu", function () {
//     it("reverts: DeluluNotFound", async function () {
//       const { delulu, player1, cuSD } = await loadFixture(deployFixture);
//       await assertRevert(
//         delulu.write.stakeOnDelulu([999n, true, parseEther("10"), 0n], { account: player1.account }),
//         /DeluluNotFound/
//       );
//     });

//     it("reverts: StakingIsClosed", async function () {
//       const { delulu, creator, player1, cuSD } = await loadFixture(deployFixture);
//       const latest = BigInt(await time.latest());
//       await delulu.write.createDelulu(
//         [cuSD.address, "hash", latest + 100n, latest + 200n, parseEther("10")],
//         { account: creator.account }
//       );
//       await time.increaseTo(latest + 101n);
//       await assertRevert(
//         delulu.write.stakeOnDelulu([1n, false, parseEther("10"), 0n], { account: player1.account }),
//         /StakingIsClosed/
//       );
//     });

//     it("reverts: CannotSwitchSides", async function () {
//       const { delulu, creator, cuSD } = await loadFixture(deployFixture);
//       const latest = BigInt(await time.latest());
//       await delulu.write.createDelulu(
//         [cuSD.address, "hash", latest + ONE_DAY, latest + 2n * ONE_DAY, parseEther("10")],
//         { account: creator.account }
//       );
//       await assertRevert(
//         delulu.write.stakeOnDelulu([1n, false, parseEther("5"), 0n], { account: creator.account }),
//         /CannotSwitchSides/
//       );
//     });

//     it("reverts: StakeLimitExceeded", async function () {
//       const { delulu, creator, player1, cuSD } = await loadFixture(deployFixture);
//       const latest = BigInt(await time.latest());
//       await delulu.write.createDelulu(
//         [cuSD.address, "hash", latest + ONE_DAY, latest + 2n * ONE_DAY, parseEther("10")],
//         { account: creator.account }
//       );
//       await assertRevert(
//         delulu.write.stakeOnDelulu([1n, false, MAX_STAKE_PER_USER + 1n, 0n], { account: player1.account }),
//         /StakeLimitExceeded/
//       );
//     });

//     it("reverts: SlippageTooHigh", async function () {
//       const { delulu, creator, player1, cuSD } = await loadFixture(deployFixture);
//       const latest = BigInt(await time.latest());
//       await delulu.write.createDelulu(
//         [cuSD.address, "hash", latest + ONE_DAY, latest + 2n * ONE_DAY, parseEther("100")],
//         { account: creator.account }
//       );
//       await assertRevert(
//         delulu.write.stakeOnDelulu([1n, false, parseEther("50"), parseEther("1000")], { account: player1.account }),
//         /SlippageTooHigh/
//       );
//     });

//     it("allows staking on same side and updates pools", async function () {
//       const { delulu, creator, player1, cuSD } = await loadFixture(deployFixture);
//       const latest = BigInt(await time.latest());
//       await delulu.write.createDelulu(
//         [cuSD.address, "hash", latest + ONE_DAY, latest + 2n * ONE_DAY, parseEther("100")],
//         { account: creator.account }
//       );
//       await delulu.write.stakeOnDelulu([1n, false, parseEther("50"), 0n], { account: player1.account });
//       const market = await delulu.read.delulus([1n]);
//       expect(market[6]).to.equal(parseEther("100"));
//       expect(market[7]).to.equal(parseEther("50"));
//     });
//   });

//   // --- RESOLVE & CLAIM ---
//   describe("resolveDelulu", function () {
//     it("reverts: Unauthorized (not creator or owner)", async function () {
//       const { delulu, creator, player1, cuSD } = await loadFixture(deployFixture);
//       const latest = BigInt(await time.latest());
//       await delulu.write.createDelulu(
//         [cuSD.address, "hash", latest + 100n, latest + 200n, parseEther("10")],
//         { account: creator.account }
//       );
//       await time.increaseTo(latest + 101n);
//       await assertRevert(
//         delulu.write.resolveDelulu([1n, true], { account: player1.account }),
//         /Unauthorized/
//       );
//     });

//     it("creator can resolve", async function () {
//       const { delulu, creator, cuSD } = await loadFixture(deployFixture);
//       const latest = BigInt(await time.latest());
//       await delulu.write.createDelulu(
//         [cuSD.address, "hash", latest + 100n, latest + 200n, parseEther("10")],
//         { account: creator.account }
//       );
//       await time.increaseTo(latest + 101n);
//       await delulu.write.resolveDelulu([1n, true], { account: creator.account });
//       const market = await delulu.read.delulus([1n]);
//       expect(market[8]).to.equal(true);
//       expect(market[9]).to.equal(true);
//     });

//     it("reverts: AlreadyResolved", async function () {
//       const { delulu, creator, cuSD } = await loadFixture(deployFixture);
//       const latest = BigInt(await time.latest());
//       await delulu.write.createDelulu(
//         [cuSD.address, "hash", latest + 100n, latest + 200n, parseEther("10")],
//         { account: creator.account }
//       );
//       await time.increaseTo(latest + 101n);
//       await delulu.write.resolveDelulu([1n, true], { account: creator.account });
//       await assertRevert(
//         delulu.write.resolveDelulu([1n, false], { account: creator.account }),
//         /AlreadyResolved/
//       );
//     });
//   });

//   describe("claimWinnings", function () {
//     it("reverts: NotResolved", async function () {
//       const { delulu, creator, player1, cuSD } = await loadFixture(deployFixture);
//       const latest = BigInt(await time.latest());
//       await delulu.write.createDelulu(
//         [cuSD.address, "hash", latest + ONE_DAY, latest + 2n * ONE_DAY, parseEther("10")],
//         { account: creator.account }
//       );
//       await delulu.write.stakeOnDelulu([1n, false, parseEther("10"), 0n], { account: player1.account });
//       await assertRevert(
//         delulu.write.claimWinnings([1n], { account: player1.account }),
//         /NotResolved/
//       );
//     });

//     it("reverts: UserIsNotWinner", async function () {
//       const { delulu, creator, player1, gDollar } = await loadFixture(deployFixture);
//       const latest = BigInt(await time.latest());
//       await delulu.write.createDelulu(
//         [gDollar.address, "hash", latest + 100n, latest + 200n, parseEther("100")],
//         { account: creator.account }
//       );
//       await delulu.write.stakeOnDelulu([1n, false, parseEther("100"), 0n], { account: player1.account });
//       await time.increaseTo(latest + 101n);
//       await delulu.write.resolveDelulu([1n, true], { account: creator.account });
//       await assertRevert(
//         delulu.write.claimWinnings([1n], { account: player1.account }),
//         /UserIsNotWinner/
//       );
//     });

//     it("reverts: AlreadyClaimed", async function () {
//       const { delulu, creator, player1, gDollar } = await loadFixture(deployFixture);
//       const latest = BigInt(await time.latest());
//       await delulu.write.createDelulu(
//         [gDollar.address, "hash", latest + 100n, latest + 200n, parseEther("100")],
//         { account: creator.account }
//       );
//       await delulu.write.stakeOnDelulu([1n, false, parseEther("100"), 0n], { account: player1.account });
//       await time.increaseTo(latest + 101n);
//       await delulu.write.resolveDelulu([1n, false], { account: creator.account });
//       await delulu.write.claimWinnings([1n], { account: player1.account });
//       await assertRevert(
//         delulu.write.claimWinnings([1n], { account: player1.account }),
//         /AlreadyClaimed/
//       );
//     });

//     it("reverts: no position (non-staker cannot claim)", async function () {
//       const { delulu, creator, player1, gDollar } = await loadFixture(deployFixture);
//       const latest = BigInt(await time.latest());
//       await delulu.write.createDelulu(
//         [gDollar.address, "hash", latest + 100n, latest + 200n, parseEther("100")],
//         { account: creator.account }
//       );
//       await time.increaseTo(latest + 101n);
//       await delulu.write.resolveDelulu([1n, true], { account: creator.account });
//       await assertRevert(
//         delulu.write.claimWinnings([1n], { account: player1.account }),
//         /UserIsNotWinner|NoStakeToRefund/
//       );
//     });

//     it("pays winners correctly (believers win)", async function () {
//       const { delulu, creator, player1, player2, gDollar } = await loadFixture(deployFixture);
//       const latest = BigInt(await time.latest());
//       await delulu.write.createDelulu(
//         [gDollar.address, "hash", latest + 100n, latest + 200n, parseEther("100")],
//         { account: creator.account }
//       );
//       await delulu.write.stakeOnDelulu([1n, false, parseEther("100"), 0n], { account: player1.account });
//       await delulu.write.stakeOnDelulu([1n, false, parseEther("200"), 0n], { account: player2.account });
//       await time.increaseTo(latest + 101n);
//       await delulu.write.resolveDelulu([1n, false], { account: creator.account });

//       const before = await gDollar.read.balanceOf([player2.account.address]);
//       await delulu.write.claimWinnings([1n], { account: player2.account });
//       const after = await gDollar.read.balanceOf([player2.account.address]);
//       expect(after - before).to.equal(parseEther("266.666666666666666666"));
//     });

//     it("pays winners correctly (believers win)", async function () {
//       const { delulu, creator, player1, player2, gDollar } = await loadFixture(deployFixture);
//       const latest = BigInt(await time.latest());
//       await delulu.write.createDelulu(
//         [gDollar.address, "hash", latest + 100n, latest + 200n, parseEther("100")],
//         { account: creator.account }
//       );
//       await delulu.write.stakeOnDelulu([1n, false, parseEther("100"), 0n], { account: player1.account });
//       await delulu.write.stakeOnDelulu([1n, false, parseEther("200"), 0n], { account: player2.account });
//       await time.increaseTo(latest + 101n);
//       await delulu.write.resolveDelulu([1n, true], { account: creator.account });

//       const before = await gDollar.read.balanceOf([creator.account.address]);
//       await delulu.write.claimWinnings([1n], { account: creator.account });
//       const after = await gDollar.read.balanceOf([creator.account.address]);
//       expect(after - before).to.equal(parseEther("400"));
//     });
//   });

//   // --- CANCEL ---
//   describe("cancelDelulu", function () {
//     it("reverts: Unauthorized", async function () {
//       const { delulu, creator, player1, cuSD } = await loadFixture(deployFixture);
//       const latest = BigInt(await time.latest());
//       await delulu.write.createDelulu(
//         [cuSD.address, "hash", latest + ONE_DAY, latest + 2n * ONE_DAY, parseEther("10")],
//         { account: creator.account }
//       );
//       await assertRevert(
//         delulu.write.cancelDelulu([1n], { account: player1.account }),
//         /Unauthorized/
//       );
//     });

//     it("creator can cancel", async function () {
//       const { delulu, creator, cuSD } = await loadFixture(deployFixture);
//       const latest = BigInt(await time.latest());
//       await delulu.write.createDelulu(
//         [cuSD.address, "hash", latest + ONE_DAY, latest + 2n * ONE_DAY, parseEther("10")],
//         { account: creator.account }
//       );
//       await delulu.write.cancelDelulu([1n], { account: creator.account });
//       const market = await delulu.read.delulus([1n]);
//       expect(market[10]).to.equal(true);
//     });

//     it("cancel prevents claim and allows emergency refund", async function () {
//       const { delulu, creator, player1, cuSD } = await loadFixture(deployFixture);
//       const latest = BigInt(await time.latest());
//       await delulu.write.createDelulu(
//         [cuSD.address, "hash", latest + ONE_DAY, latest + 2n * ONE_DAY, parseEther("10")],
//         { account: creator.account }
//       );
//       await delulu.write.stakeOnDelulu([1n, false, parseEther("10"), 0n], { account: player1.account });
//       await delulu.write.cancelDelulu([1n], { account: creator.account });

//       await assertRevert(
//         delulu.write.claimWinnings([1n], { account: creator.account }),
//         /MarketCancelled|NotResolved/
//       );

//       const before = await cuSD.read.balanceOf([creator.account.address]);
//       await delulu.write.emergencyRefund([1n], { account: creator.account });
//       const after = await cuSD.read.balanceOf([creator.account.address]);
//       expect(after - before).to.equal(parseEther("10"));
//     });
//   });

//   // --- EMERGENCY REFUND ---
//   describe("emergencyRefund", function () {
//     it("reverts before delay", async function () {
//       const { delulu, creator, cuSD } = await loadFixture(deployFixture);
//       const latest = BigInt(await time.latest());
//       const staking = latest + 100n;
//       const resolution = latest + 200n;
//       await delulu.write.createDelulu(
//         [cuSD.address, "hash", staking, resolution, parseEther("10")],
//         { account: creator.account }
//       );
//       await time.increaseTo(resolution + 1n);
//       await assertRevert(
//         delulu.write.emergencyRefund([1n], { account: creator.account }),
//         /NotRefundable/
//       );
//     });

//     it("succeeds after 7 days past resolution (unresolved)", async function () {
//       const { delulu, creator, cuSD } = await loadFixture(deployFixture);
//       const latest = BigInt(await time.latest());
//       const staking = latest + 100n;
//       const resolution = latest + 200n;
//       await delulu.write.createDelulu(
//         [cuSD.address, "hash", staking, resolution, parseEther("10")],
//         { account: creator.account }
//       );
//       const week = 7n * ONE_DAY;
//       await time.increaseTo(resolution + week + 1n);

//       const before = await cuSD.read.balanceOf([creator.account.address]);
//       await delulu.write.emergencyRefund([1n], { account: creator.account });
//       const after = await cuSD.read.balanceOf([creator.account.address]);
//       expect(after - before).to.equal(parseEther("10"));
//     });

//     it("reverts: NoStakeToRefund (no position)", async function () {
//       const { delulu, creator, player1, cuSD } = await loadFixture(deployFixture);
//       const latest = BigInt(await time.latest());
//       const staking = latest + 100n;
//       const resolution = latest + 200n;
//       await delulu.write.createDelulu(
//         [cuSD.address, "hash", staking, resolution, parseEther("10")],
//         { account: creator.account }
//       );
//       const week = 7n * ONE_DAY;
//       await time.increaseTo(resolution + week + 1n);
//       await assertRevert(
//         delulu.write.emergencyRefund([1n], { account: player1.account }),
//         /NoStakeToRefund/
//       );
//     });
//   });

//   // --- PAUSE ---
//   describe("pause / unpause", function () {
//     it("only owner can pause", async function () {
//       const { delulu, attacker } = await loadFixture(deployFixture);
//       await assertRevert(
//         delulu.write.pause([], { account: attacker.account }),
//         /OwnableUnauthorizedAccount/
//       );
//     });

//     it("createDelulu reverts when paused", async function () {
//       const { delulu, owner, creator, cuSD } = await loadFixture(deployFixture);
//       await delulu.write.pause([], { account: owner.account });
//       const latest = BigInt(await time.latest());
//       await assertRevert(
//         delulu.write.createDelulu(
//           [cuSD.address, "hash", latest + ONE_DAY, latest + 2n * ONE_DAY, parseEther("10")],
//           { account: creator.account }
//         ),
//         /EnforcedPause|Pausable/
//       );
//     });

//     it("stake reverts when paused", async function () {
//       const { delulu, owner, creator, player1, cuSD } = await loadFixture(deployFixture);
//       const latest = BigInt(await time.latest());
//       await delulu.write.createDelulu(
//         [cuSD.address, "hash", latest + ONE_DAY, latest + 2n * ONE_DAY, parseEther("10")],
//         { account: creator.account }
//       );
//       await delulu.write.pause([], { account: owner.account });
//       await assertRevert(
//         delulu.write.stakeOnDelulu([1n, false, parseEther("10"), 0n], { account: player1.account }),
//         /EnforcedPause|Pausable/
//       );
//     });

//     it("claim reverts when paused", async function () {
//       const { delulu, owner, creator, player1, gDollar } = await loadFixture(deployFixture);
//       const latest = BigInt(await time.latest());
//       await delulu.write.createDelulu(
//         [gDollar.address, "hash", latest + 100n, latest + 200n, parseEther("100")],
//         { account: creator.account }
//       );
//       await delulu.write.stakeOnDelulu([1n, false, parseEther("100"), 0n], { account: player1.account });
//       await time.increaseTo(latest + 101n);
//       await delulu.write.resolveDelulu([1n, false], { account: creator.account });
//       await delulu.write.pause([], { account: owner.account });
//       await assertRevert(
//         delulu.write.claimWinnings([1n], { account: player1.account }),
//         /EnforcedPause|Pausable/
//       );
//     });

//     it("unpause restores operations", async function () {
//       const { delulu, owner, creator, cuSD } = await loadFixture(deployFixture);
//       await delulu.write.pause([], { account: owner.account });
//       await delulu.write.unpause([], { account: owner.account });
//       const latest = BigInt(await time.latest());
//       await delulu.write.createDelulu(
//         [cuSD.address, "hash", latest + ONE_DAY, latest + 2n * ONE_DAY, parseEther("10")],
//         { account: creator.account }
//       );
//       expect(await delulu.read.nextDeluluId()).to.equal(2n);
//     });
//   });

//   // --- VIEWS ---
//   describe("view functions", function () {
//     it("getDeluluState returns correct state", async function () {
//       const { delulu, creator, cuSD } = await loadFixture(deployFixture);
//       const latest = BigInt(await time.latest());
//       await delulu.write.createDelulu(
//         [cuSD.address, "hash", latest + ONE_DAY, latest + 2n * ONE_DAY, parseEther("10")],
//         { account: creator.account }
//       );
//       expect(await delulu.read.getDeluluState([1n])).to.equal(0n);
//       await time.increaseTo(latest + ONE_DAY + 1n);
//       expect(await delulu.read.getDeluluState([1n])).to.equal(1n);
//     });

//     it("getMarketToken returns correct token", async function () {
//       const { delulu, creator, gDollar } = await loadFixture(deployFixture);
//       const latest = BigInt(await time.latest());
//       await delulu.write.createDelulu(
//         [gDollar.address, "hash", latest + ONE_DAY, latest + 2n * ONE_DAY, parseEther("10")],
//         { account: creator.account }
//       );
//       expect(getAddress(await delulu.read.getMarketToken([1n]))).to.equal(getAddress(gDollar.address));
//     });

//     it("getTokenAddress returns default currency", async function () {
//       const { delulu, cuSD } = await loadFixture(deployFixture);
//       expect(getAddress(await delulu.read.getTokenAddress())).to.equal(getAddress(cuSD.address));
//     });
//   });
// });
