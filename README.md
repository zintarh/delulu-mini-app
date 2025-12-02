

## Delulu: The Decentralized Prediction Market of Conviction

Delulu is a groundbreaking Celo Mini App that transforms personal goals, opinions, and viral topics into high-stakes, on-chain prediction markets. By integrating with Farcaster for social reach and leveraging SelfProtocol for robust Sybil resistance, Delulu pioneers a new model of decentralized social finance where personal ambition and community consensus are monetized.

### Core Concept

Delulu allows users to create a "Delusion"—a public, verifiable claim about a future outcome—and stake collateral to back it. The community acts as the market by staking capital to publicly Believe or Doubt the Delusion. The fluctuating Believe:Doubt ratio represents the collective "Price of Conviction." Winners take the staked pot, gaining both financial profit and powerful social validation.

Badge | Status
Status | In Development
Platform | Celo Mini App (Mobile First)
Identity | Farcaster / SelfProtocol


### Technology Stack

Delulu is built as a modern Celo blockchain application using a monorepo structure managed by Turborepo.

Component | Technology | Role
Blockchain | Celo | Fast, low-cost, mobile-first transactions.
Frontend Framework | Next.js 14 (App Router) | Sleek, component-based user interface and routing.
Language | TypeScript | Strong typing for scalable and robust development.
Styling | Tailwind CSS / shadcn/ui | Utility-first framework for rapid, responsive design and professional UI components.
Smart Contracts | Hardhat with Viem | Development environment for contracts.
Monorepo | Turborepo / PNPM | High-performance monorepo management.

Getting Started

This project is a monorepo managed by Turborepo with the following structure:

  * apps/web - Next.js application (the Delulu frontend) with embedded UI components and utilities.

  * apps/hardhat - Smart contract development environment.

### Prerequisites

  * Node.js (LTS version)

  * PNPM (required package manager for Turborepo monorepo)

  * A Celo wallet (e.g., Valora) or local testnet setup.

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

#### Script | Description
pnpm dev | Start development servers for all apps.
pnpm build | Build all packages and apps for production.
pnpm lint | Lint all packages and apps.
pnpm type-check | Run TypeScript type checking across all packages.

Smart Contract Scripts

#### Script | Description
pnpm contracts:compile | Compile smart contracts in apps/hardhat.
pnpm contracts:test | Run smart contract tests.
pnpm contracts:deploy | Deploy contracts to local network.
pnpm contracts:deploy:alfajores | Deploy to Celo Alfajores testnet.
pnpm contracts:deploy:sepolia | Deploy to Celo Sepolia testnet.
pnpm contracts:deploy:celo | Deploy to Celo mainnet.

### Contributing

We welcome contributions from the community\! Please refer to the CONTRIBUTING.md (to be created) for guidelines on submitting issues and pull requests.

#### Security and Integrity

#### Market integrity is paramount for Delulu.

  * Celo: Transactions utilize Celo's fast, secure blockchain infrastructure.

  * SelfProtocol: Mandatory integration ensures robust Sybil resistance, guaranteeing all participants are verified human users.

  * Collateral: All predictions are backed by collateral, ensuring high-stakes and legitimate convictions.

#### Learn More

  * Next.js Documentation

  * Celo Documentation

  * Turborepo Documentation

  * shadcn/ui Documentation