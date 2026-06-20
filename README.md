## Delulu: Stake Your Goals, Prove Your Progress

Delulu is a Celo-based web app (an installable, mobile-first PWA, not a Farcaster/MiniPay Mini App) where users turn personal goals into on-chain commitments. You create a "Delulu" — a goal with a deadline and a self-funded stake, paid in G$ (GoodDollar) or USDT — break it into milestones, and submit AI-screened proof as you complete them. Friends and supporters can tip you to grow your claimable pot, or your goal can join an admin-run Campaign (prize pool) for a share of pooled rewards. Miss a milestone deadline and your stake is slashed and refunded pro-rata to your supporters; finish on time and you keep your stake plus everything tipped to you.

Status | In Development
Platform | Web app on Celo (Next.js PWA, mobile-first)
Identity | GoodDollar Face Verification

### Core Concept

- **Delulu** — a personal goal a user creates by escrowing a stake (minimum 100 whole token units) in a supported token (currently G$ or USDT in the app) with a `resolutionDeadline`. A username is required before you can create one.
- **Milestones** — sequential checkpoints a creator schedules toward their deadline (one milestone per remaining day, at most). Proof submissions go through an AI check (`/api/ai/verify-milestone`) before being recorded on-chain, and award points — 1000 per milestone, +500 if submitted before the milestone's halfway point, +250 if the previous milestone was also verified on time.
- **Tipping** — anyone can tip an active goal at any time (no windows); tips add to the creator's claimable pot, give the creator 100 points per tip, and are tracked per-supporter so they can be refunded pro-rata if the goal later fails.
- **Campaigns (on-chain "Challenges")** — prize pools funded by whoever calls `createChallenge`; creation is admin-only in the app UI. Goal creators join an open campaign with `joinChallenge`; an admin allocates points per participant; after the campaign window closes, participants claim a pro-rata share of the pool, and the funder can withdraw any amount left unclaimed.
- **Goal failure & slashing** — if a milestone deadline passes unsubmitted, the goal can be marked failed by an admin, or permissionlessly by anyone who proves the missed deadline (earning a 1% keeper bounty from the stake). The remaining stake becomes a refund pool that supporters claim from pro-rata to what they tipped.
- **Successful resolution** — once the deadline passes without failure, the creator claims their original stake back plus all tips collected (minus a 1% protocol fee).
- **Streaks & leaderboard** — points from milestones and tips roll up into a per-user score shown on the leaderboard and streaks page.
- **UBI** — wallets that pass GoodDollar's Face Verification flow can claim a daily G$ entitlement in-app; the same whitelist check also gates creating a goal or tipping with G$ if the wallet has a zero G$ balance.

The deployed contract (`Delulu-v3.sol`) also implements a Friend.tech-style bonding-curve share market (`buyShares`/`sellShares`) and a "Scout" bonus for early tippers — both are present on-chain but are **not yet wired into the web app UI**, so don't expect to see them in the product today.

### Technology Stack

Delulu is built as a Celo blockchain application using a monorepo structure managed by Turborepo.

Component | Technology | Role
Blockchain | Celo (mainnet 42220, Sepolia testnet 11142220) | Fast, low-cost, mobile-first transactions.
Frontend Framework | Next.js 14 (App Router) | UI, routing, and API routes.
Language | TypeScript | Strong typing across web and contracts.
Wallets / Auth | Web3Auth, wagmi, viem | Wallet connection and on-chain reads/writes.
Identity & UBI | GoodDollar SDKs (`@goodsdks/identity-sdk`, `@goodsdks/citizen-sdk`) | Face Verification gating + daily G$ claim entitlement.
Styling | Tailwind CSS / shadcn/ui | Utility-first styling and UI components.
Smart Contracts | Hardhat, Solidity (UUPS upgradeable), OpenZeppelin | `Delulu-v3.sol` — goals, milestones, challenges, shares, tipping.
Indexing | The Graph (subgraph), deployed via Goldsky | Indexes on-chain events for fast reads on the frontend.
Backend services | Supabase, OpenAI | Admin auth/session storage; AI milestone verification, goal/milestone generation, and "Wrapped" recaps.
Monorepo | Turborepo / PNPM | Workspace and task orchestration.

### Getting Started

This project is a monorepo managed by Turborepo with the following structure:

  * `apps/web` — Next.js application (the Delulu frontend, plus API routes, cron jobs, and the admin dashboard).
  * `apps/contracts` — Smart contract development environment (Hardhat). The package itself is named `hardhat`.
  * `apps/delulu-subgraph` — The Graph subgraph that indexes on-chain Delulu events, deployed via Goldsky.

### Prerequisites

  * Node.js (LTS version)
  * PNPM (required package manager for the Turborepo monorepo)
  * A Celo wallet or local testnet setup

### Installation and Setup

1.  Install dependencies:

    ```
    pnpm install
    ```

2.  Start the development server:

    ```
    pnpm dev
    ```

3.  Open http://localhost:3000 in your browser.

### Available Scripts

All commands should be run from the root of the monorepo using pnpm.

Script | Description
pnpm dev | Start development servers for all apps.
pnpm build | Build all packages and apps for production.
pnpm lint | Lint all packages and apps.
pnpm type-check | Run TypeScript type checking across all packages.

Smart Contract Scripts

Script | Description
pnpm contracts:compile | Compile smart contracts in apps/contracts.
pnpm contracts:test | Run smart contract tests.
pnpm contracts:deploy | Run the Hardhat Ignition deploy task (see apps/contracts/README.md for the real deployment/upgrade flow).
pnpm contracts:deploy:sepolia | Deploy to Celo Sepolia testnet.
pnpm contracts:deploy:celo | Deploy to Celo mainnet.

### Contributing

We welcome contributions from the community! Please refer to the CONTRIBUTING.md (to be created) for guidelines on submitting issues and pull requests.

### Security and Integrity

Goal integrity is paramount for Delulu.

  * **Celo**: Transactions run on Celo's fast, low-cost blockchain.
  * **GoodDollar Face Verification**: Identity verification gates UBI claims (and G$-denominated creation/tipping for zero-balance wallets) to help prevent Sybil abuse.
  * **Collateral & slashing**: Every Delulu is backed by a creator stake that is slashed and redistributed to supporters if a milestone deadline is missed and the goal is abandoned.
  * **Upgradeable contracts**: `Delulu-v3.sol` follows the UUPS proxy pattern; upgrades are validated with Hardhat scripts before being applied on-chain.

### Learn More

  * Next.js Documentation
  * Celo Documentation
  * Turborepo Documentation
  * GoodDollar Developer Documentation
  * shadcn/ui Documentation
