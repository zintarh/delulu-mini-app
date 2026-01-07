import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { DeluluMarket, MockERC20 } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("DeluluMarket - Payout & Claimable Tests", function () {
    let deluluMarket: DeluluMarket;
    let mockToken: MockERC20;
    let owner: HardhatEthersSigner;
    let alice: HardhatEthersSigner;
    let bob: HardhatEthersSigner;
    let charlie: HardhatEthersSigner;
    let dave: HardhatEthersSigner;

    const ONE_TOKEN = ethers.parseEther("1");
    const HUNDRED_TOKENS = ethers.parseEther("100");
    const THOUSAND_TOKENS = ethers.parseEther("1000");
    const FIVE_THOUSAND_TOKENS = ethers.parseEther("5000");
    const TEN_THOUSAND_TOKENS = ethers.parseEther("10000");

    beforeEach(async function () {
        [owner, alice, bob, charlie, dave] = await ethers.getSigners();

        // Deploy Mock ERC20 Token
        const MockERC20Factory = await ethers.getContractFactory("MockERC20");
        mockToken = await MockERC20Factory.deploy("Mock USDC", "USDC", 18);
        await mockToken.waitForDeployment();

        // Deploy DeluluMarket
        const DeluluMarketFactory = await ethers.getContractFactory("DeluluMarket");
        deluluMarket = await DeluluMarketFactory.deploy(await mockToken.getAddress());
        await deluluMarket.waitForDeployment();

        // Mint tokens to users
        await mockToken.mint(alice.address, ethers.parseEther("100000"));
        await mockToken.mint(bob.address, ethers.parseEther("100000"));
        await mockToken.mint(charlie.address, ethers.parseEther("100000"));
        await mockToken.mint(dave.address, ethers.parseEther("100000"));

        // Approve DeluluMarket to spend tokens
        await mockToken.connect(alice).approve(await deluluMarket.getAddress(), ethers.MaxUint256);
        await mockToken.connect(bob).approve(await deluluMarket.getAddress(), ethers.MaxUint256);
        await mockToken.connect(charlie).approve(await deluluMarket.getAddress(), ethers.MaxUint256);
        await mockToken.connect(dave).approve(await deluluMarket.getAddress(), ethers.MaxUint256);
    });

    describe("Payout Calculations - Believers Win", function () {
        it("Should calculate correct payouts when believers dominate (10k vs 2k)", async function () {
            const now = await time.latest();
            const stakingDeadline = now + 3600; // 1 hour
            const resolutionDeadline = stakingDeadline + 86400; // 1 day later

            // Alice creates market with 5000 tokens (Believer)
            await deluluMarket.connect(alice).createDelulu(
                "QmTest123",
                stakingDeadline,
                resolutionDeadline,
                FIVE_THOUSAND_TOKENS
            );

            // Bob stakes 3000 as Believer
            await deluluMarket.connect(bob).stakeOnDelulu(
                1,
                true, // Believer
                ethers.parseEther("3000"),
                0 // No slippage protection for test
            );

            // Charlie stakes 2000 as Believer
            await deluluMarket.connect(charlie).stakeOnDelulu(
                1,
                true,
                ethers.parseEther("2000"),
                0
            );

            // Dave stakes 2000 as Doubter
            await deluluMarket.connect(dave).stakeOnDelulu(
                1,
                false, // Doubter
                ethers.parseEther("2000"),
                0
            );

            // Verify pools
            const delulu = await deluluMarket.getDelulu(1);
            expect(delulu.totalBelieverStake).to.equal(TEN_THOUSAND_TOKENS);
            expect(delulu.totalDoubterStake).to.equal(ethers.parseEther("2000"));

            // Fast forward past staking deadline
            await time.increaseTo(stakingDeadline + 1);

            // Resolve: Believers win
            await deluluMarket.connect(owner).resolveDelulu(1, true);

            // Check claimable status
            expect(await deluluMarket.isClaimable(1, alice.address)).to.be.true;
            expect(await deluluMarket.isClaimable(1, bob.address)).to.be.true;
            expect(await deluluMarket.isClaimable(1, charlie.address)).to.be.true;
            expect(await deluluMarket.isClaimable(1, dave.address)).to.be.false; // Loser

            // Calculate expected payouts (no fees)
            // Total pool = 12,000 tokens
            // Alice: (5000/10000) * 12000 = 6000 tokens
            // Bob: (3000/10000) * 12000 = 3600 tokens
            // Charlie: (2000/10000) * 12000 = 2400 tokens

            const aliceBalanceBefore = await mockToken.balanceOf(alice.address);
            const bobBalanceBefore = await mockToken.balanceOf(bob.address);
            const charlieBalanceBefore = await mockToken.balanceOf(charlie.address);

            // Claim winnings
            await deluluMarket.connect(alice).claimWinnings(1);
            await deluluMarket.connect(bob).claimWinnings(1);
            await deluluMarket.connect(charlie).claimWinnings(1);

            const aliceBalanceAfter = await mockToken.balanceOf(alice.address);
            const bobBalanceAfter = await mockToken.balanceOf(bob.address);
            const charlieBalanceAfter = await mockToken.balanceOf(charlie.address);

            // Verify payouts
            expect(aliceBalanceAfter - aliceBalanceBefore).to.equal(ethers.parseEther("6000"));
            expect(bobBalanceAfter - bobBalanceBefore).to.equal(ethers.parseEther("3600"));
            expect(charlieBalanceAfter - charlieBalanceBefore).to.equal(ethers.parseEther("2400"));

            // Verify profits
            expect(aliceBalanceAfter - aliceBalanceBefore).to.equal(ethers.parseEther("6000")); // +1000 profit
            expect(bobBalanceAfter - bobBalanceBefore).to.equal(ethers.parseEther("3600")); // +600 profit
            expect(charlieBalanceAfter - charlieBalanceBefore).to.equal(ethers.parseEther("2400")); // +400 profit

            // Verify everyone got same 1.2x multiplier
            const alicePayout = aliceBalanceAfter - aliceBalanceBefore;
            const bobPayout = bobBalanceAfter - bobBalanceBefore;
            const charliePayout = charlieBalanceAfter - charlieBalanceBefore;

            expect(alicePayout * 10n / FIVE_THOUSAND_TOKENS).to.equal(12n); // 1.2x
            expect(bobPayout * 10n / ethers.parseEther("3000")).to.equal(12n); // 1.2x
            expect(charliePayout * 10n / ethers.parseEther("2000")).to.equal(12n); // 1.2x
        });

        it("Should calculate correct payouts when doubters dominate (2k vs 10k)", async function () {
            const now = await time.latest();
            const stakingDeadline = now + 3600;
            const resolutionDeadline = stakingDeadline + 86400;

            // Alice creates with 2000 as Believer
            await deluluMarket.connect(alice).createDelulu(
                "QmTest456",
                stakingDeadline,
                resolutionDeadline,
                ethers.parseEther("2000")
            );

            // Bob stakes 10000 as Doubter
            await deluluMarket.connect(bob).stakeOnDelulu(
                1,
                false, // Doubter
                TEN_THOUSAND_TOKENS,
                0
            );

            // Fast forward and resolve: Doubters win
            await time.increaseTo(stakingDeadline + 1);
            await deluluMarket.connect(owner).resolveDelulu(1, false);

            // Bob should get massive payout (5.7x)
            const bobBalanceBefore = await mockToken.balanceOf(bob.address);
            await deluluMarket.connect(bob).claimWinnings(1);
            const bobBalanceAfter = await mockToken.balanceOf(bob.address);

            // Bob: (10000/10000) * 12000 = 12000 tokens (he's the only doubter)
            expect(bobBalanceAfter - bobBalanceBefore).to.equal(ethers.parseEther("12000"));

            // Verify 1.2x multiplier (12000 / 10000 = 1.2)
            const multiplier = (bobBalanceAfter - bobBalanceBefore) * 10n / TEN_THOUSAND_TOKENS;
            expect(multiplier).to.equal(12n); // 1.2x
        });
    });

    describe("Edge Case: No Opposition", function () {
        it("Should return original stake when no one bets against", async function () {
            const now = await time.latest();
            const stakingDeadline = now + 3600;
            const resolutionDeadline = stakingDeadline + 86400;

            // Alice creates with 5000 as Believer
            await deluluMarket.connect(alice).createDelulu(
                "QmNoOpposition",
                stakingDeadline,
                resolutionDeadline,
                FIVE_THOUSAND_TOKENS
            );

            // Bob also stakes as Believer
            await deluluMarket.connect(bob).stakeOnDelulu(
                1,
                true,
                ethers.parseEther("3000"),
                0
            );

            // NO DOUBTERS - only believers

            await time.increaseTo(stakingDeadline + 1);
            await deluluMarket.connect(owner).resolveDelulu(1, true);

            // Should get original stakes back (1.0x, no profit)
            const aliceBalanceBefore = await mockToken.balanceOf(alice.address);
            const bobBalanceBefore = await mockToken.balanceOf(bob.address);

            await deluluMarket.connect(alice).claimWinnings(1);
            await deluluMarket.connect(bob).claimWinnings(1);

            const aliceBalanceAfter = await mockToken.balanceOf(alice.address);
            const bobBalanceAfter = await mockToken.balanceOf(bob.address);

            // Verify they got exactly their stakes back
            expect(aliceBalanceAfter - aliceBalanceBefore).to.equal(FIVE_THOUSAND_TOKENS);
            expect(bobBalanceAfter - bobBalanceBefore).to.equal(ethers.parseEther("3000"));
        });
    });

    describe("isClaimable Function Tests", function () {
        beforeEach(async function () {
            const now = await time.latest();
            const stakingDeadline = now + 3600;
            const resolutionDeadline = stakingDeadline + 86400;

            // Create market
            await deluluMarket.connect(alice).createDelulu(
                "QmClaimTest",
                stakingDeadline,
                resolutionDeadline,
                FIVE_THOUSAND_TOKENS
            );

            // Bob stakes as Believer
            await deluluMarket.connect(bob).stakeOnDelulu(1, true, ethers.parseEther("3000"), 0);

            // Charlie stakes as Doubter
            await deluluMarket.connect(charlie).stakeOnDelulu(1, false, ethers.parseEther("2000"), 0);

            await time.increaseTo(stakingDeadline + 1);
        });

        it("Should return false before resolution", async function () {
            expect(await deluluMarket.isClaimable(1, alice.address)).to.be.false;
            expect(await deluluMarket.isClaimable(1, bob.address)).to.be.false;
            expect(await deluluMarket.isClaimable(1, charlie.address)).to.be.false;
        });

        it("Should return true only for winners after resolution", async function () {
            // Resolve: Believers win
            await deluluMarket.connect(owner).resolveDelulu(1, true);

            expect(await deluluMarket.isClaimable(1, alice.address)).to.be.true; // Winner
            expect(await deluluMarket.isClaimable(1, bob.address)).to.be.true; // Winner
            expect(await deluluMarket.isClaimable(1, charlie.address)).to.be.false; // Loser
        });

        it("Should return false after claiming", async function () {
            await deluluMarket.connect(owner).resolveDelulu(1, true);

            expect(await deluluMarket.isClaimable(1, alice.address)).to.be.true;

            // Alice claims
            await deluluMarket.connect(alice).claimWinnings(1);

            expect(await deluluMarket.isClaimable(1, alice.address)).to.be.false;
        });

        it("Should return false for users with no stake", async function () {
            await deluluMarket.connect(owner).resolveDelulu(1, true);

            expect(await deluluMarket.isClaimable(1, dave.address)).to.be.false; // Never staked
        });

        it("Should return false for cancelled markets", async function () {
            await deluluMarket.connect(owner).cancelDelulu(1);

            expect(await deluluMarket.isClaimable(1, alice.address)).to.be.false;
            expect(await deluluMarket.isClaimable(1, bob.address)).to.be.false;
        });
    });

    describe("Claim Function Security Tests", function () {
        beforeEach(async function () {
            const now = await time.latest();
            const stakingDeadline = now + 3600;
            const resolutionDeadline = stakingDeadline + 86400;

            await deluluMarket.connect(alice).createDelulu(
                "QmSecurityTest",
                stakingDeadline,
                resolutionDeadline,
                FIVE_THOUSAND_TOKENS
            );

            await deluluMarket.connect(bob).stakeOnDelulu(1, false, ethers.parseEther("2000"), 0);

            await time.increaseTo(stakingDeadline + 1);
            await deluluMarket.connect(owner).resolveDelulu(1, true); // Believers win
        });

        it("Should revert when loser tries to claim", async function () {
            await expect(
                deluluMarket.connect(bob).claimWinnings(1)
            ).to.be.revertedWithCustomError(deluluMarket, "UserIsNotWinner");
        });

        it("Should revert on double claim attempt", async function () {
            await deluluMarket.connect(alice).claimWinnings(1);

            await expect(
                deluluMarket.connect(alice).claimWinnings(1)
            ).to.be.revertedWithCustomError(deluluMarket, "AlreadyClaimed");
        });

        it("Should revert when claiming from unresolved market", async function () {
            const now = await time.latest();
            await deluluMarket.connect(alice).createDelulu(
                "QmUnresolved",
                now + 3600,
                now + 86400,
                THOUSAND_TOKENS
            );

            await expect(
                deluluMarket.connect(alice).claimWinnings(2)
            ).to.be.revertedWithCustomError(deluluMarket, "NotResolved");
        });

        it("Should revert when user never staked", async function () {
            await expect(
                deluluMarket.connect(dave).claimWinnings(1)
            ).to.be.revertedWithCustomError(deluluMarket, "NoStakeToRefund");
        });
    });

    describe("Complex Multi-User Payout Scenario", function () {
        it("Should handle 10 users with different stakes correctly", async function () {
            const now = await time.latest();
            const stakingDeadline = now + 3600;
            const resolutionDeadline = stakingDeadline + 86400;

            // Get more signers
            const signers = await ethers.getSigners();
            const users = signers.slice(0, 10);

            // Mint and approve for all users
            for (const user of users) {
                await mockToken.mint(user.address, ethers.parseEther("50000"));
                await mockToken.connect(user).approve(await deluluMarket.getAddress(), ethers.MaxUint256);
            }

            // User 0 creates with 1000
            await deluluMarket.connect(users[0]).createDelulu(
                "QmMultiUser",
                stakingDeadline,
                resolutionDeadline,
                THOUSAND_TOKENS
            );

            // Users 1-6 stake as Believers (different amounts)
            const believerStakes = [
                ethers.parseEther("500"),
                ethers.parseEther("1500"),
                ethers.parseEther("2000"),
                ethers.parseEther("3000"),
                ethers.parseEther("1000"),
                ethers.parseEther("2000")
            ];

            for (let i = 0; i < believerStakes.length; i++) {
                await deluluMarket.connect(users[i + 1]).stakeOnDelulu(
                    1,
                    true,
                    believerStakes[i],
                    0
                );
            }

            // Users 7-9 stake as Doubters
            const doubterStakes = [
                ethers.parseEther("3000"),
                ethers.parseEther("4000"),
                ethers.parseEther("3000")
            ];

            for (let i = 0; i < doubterStakes.length; i++) {
                await deluluMarket.connect(users[i + 7]).stakeOnDelulu(
                    1,
                    false,
                    doubterStakes[i],
                    0
                );
            }

            // Total: Believers = 11000, Doubters = 10000, Total = 21000

            await time.increaseTo(stakingDeadline + 1);
            await deluluMarket.connect(owner).resolveDelulu(1, true); // Believers win

            // Calculate expected multiplier: 21000 / 11000 ≈ 1.909x
            const totalPool = ethers.parseEther("21000");
            const believerPool = ethers.parseEther("11000");

            // Verify each believer gets correct payout
            const balancesBefore: bigint[] = [];
            for (let i = 0; i < 7; i++) {
                balancesBefore.push(await mockToken.balanceOf(users[i].address));
            }

            // All believers claim
            for (let i = 0; i < 7; i++) {
                await deluluMarket.connect(users[i]).claimWinnings(1);
            }

            const balancesAfter: bigint[] = [];
            for (let i = 0; i < 7; i++) {
                balancesAfter.push(await mockToken.balanceOf(users[i].address));
            }

            // Verify payouts
            const allStakes = [THOUSAND_TOKENS, ...believerStakes];
            for (let i = 0; i < 7; i++) {
                const payout = balancesAfter[i] - balancesBefore[i];
                const expectedPayout = (allStakes[i] * totalPool) / believerPool;
                
                // Allow small rounding error (< 1 token)
                const diff = payout > expectedPayout ? 
                    payout - expectedPayout : 
                    expectedPayout - payout;
                
                expect(diff).to.be.lessThan(ethers.parseEther("1"));
            }

            // Verify total paid out equals total pool
            let totalPaidOut = 0n;
            for (let i = 0; i < 7; i++) {
                totalPaidOut += balancesAfter[i] - balancesBefore[i];
            }
            
            // Should equal total pool (allow small rounding)
            const poolDiff = totalPaidOut > totalPool ? 
                totalPaidOut - totalPool : 
                totalPool - totalPaidOut;
            expect(poolDiff).to.be.lessThan(ethers.parseEther("1"));
        });
    });

    describe("getPotentialPayout View Function", function () {
        it("Should accurately predict payout before staking", async function () {
            const now = await time.latest();
            await deluluMarket.connect(alice).createDelulu(
                "QmPrediction",
                now + 3600,
                now + 86400,
                ethers.parseEther("5000")
            );

            await deluluMarket.connect(bob).stakeOnDelulu(
                1,
                false,
                ethers.parseEther("2000"),
                0
            );

            // Check potential payout for Charlie staking 3000 as Believer
            const potentialPayout = await deluluMarket.getPotentialPayout(
                1,
                ethers.parseEther("3000"),
                true // Believer
            );

            // Current: Believers 5000, Doubters 2000
            // After Charlie: Believers 8000, Doubters 2000, Total 10000
            // Charlie's payout: (3000/8000) * 10000 = 3750
            expect(potentialPayout).to.equal(ethers.parseEther("3750"));
        });

        it("Should return original stake when no opposition", async function () {
            const now = await time.latest();
            await deluluMarket.connect(alice).createDelulu(
                "QmNoOpposition2",
                now + 3600,
                now + 86400,
                FIVE_THOUSAND_TOKENS
            );

            // Only believers exist, check potential for another believer
            const potentialPayout = await deluluMarket.getPotentialPayout(
                1,
                ethers.parseEther("2000"),
                true
            );

            // Should return original stake (no profit)
            expect(potentialPayout).to.equal(ethers.parseEther("2000"));
        });
    });

    describe("getOddsMultiplier View Function", function () {
        it("Should return correct odds multiplier", async function () {
            const now = await time.latest();
            await deluluMarket.connect(alice).createDelulu(
                "QmOdds",
                now + 3600,
                now + 86400,
                TEN_THOUSAND_TOKENS // Believer
            );

            await deluluMarket.connect(bob).stakeOnDelulu(
                1,
                false,
                ethers.parseEther("2000"), // Doubter
                0
            );

            // Believers: 10000, Doubters: 2000, Total: 12000
            // Believer odds: 12000 / 10000 = 1.2x
            // Doubter odds: 12000 / 2000 = 6x

            const believerOdds = await deluluMarket.getOddsMultiplier(1, true);
            const doubterOdds = await deluluMarket.getOddsMultiplier(1, false);

            // Odds are returned in 18 decimals
            expect(believerOdds).to.equal(ethers.parseEther("1.2"));
            expect(doubterOdds).to.equal(ethers.parseEther("6"));
        });
    });
});