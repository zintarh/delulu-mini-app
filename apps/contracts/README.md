# delulu-v0 - Smart Contracts

This directory contains the smart contracts for Delulu, built with Hardhat and optimized for the Celo blockchain. The core contract, `Delulu-v3.sol`, is a UUPS-upgradeable contract implementing personal goals ("Delulus") with milestones, funder-backed Challenge pools, a bonding-curve share market, tipping/scouting, and goal-failure slashing with supporter refunds.

## Quick Start

```bash
# Install dependencies
pnpm install

# Compile contracts
pnpm compile

# Run the default test suite
pnpm test

# Validate a proposed upgrade against the deployed proxy
pnpm validate:upgrade

# Upgrade the live contract behind the proxy
pnpm upgrade:sepolia   # Celo Sepolia testnet
pnpm upgrade:celo      # Celo mainnet

# Verify contracts on Celoscan/Blockscout
pnpm verify
```

## Available Scripts

- `pnpm compile` — Compile smart contracts
- `pnpm test` — Run `test/Delulu.js` (the default suite configured in package.json)
- `pnpm validate:upgrade` — Validate a new implementation is upgrade-safe against the deployed proxy
- `pnpm simulate:upgrade` — Simulate a UUPS upgrade against a local Hardhat fork
- `pnpm upgrade:sepolia` / `pnpm upgrade:celo` — Run the upgrade script against Celo Sepolia / Celo mainnet
- `pnpm verify` — Verify contracts on Celoscan/Blockscout
- `pnpm clean` — Clean artifacts and cache
- `pnpm typechain` — Generate TypeChain bindings

For a fresh (non-upgrade) deployment, use `hardhat run scripts/deploy-delulu-v3.cjs --network <network> --config hardhat.config.cjs`. The `pnpm deploy*` scripts still point at the Hardhat Ignition sample module and are not the real deployment path for this contract.

## Networks

### Celo Mainnet
- **Chain ID**: 42220
- **RPC URL**: https://forno.celo.org
- **Explorer**: https://celoscan.io

### Celo Sepolia Testnet
- **Chain ID**: 11142220
- **RPC URL**: https://forno.celo-sepolia.celo-testnet.org
- **Explorer**: https://celo-sepolia.blockscout.com
- **Faucet**: https://faucet.celo.org/celo-sepolia

## Environment Setup

1. Copy the environment template:
   ```bash
   cp .env.example .env
   ```

2. Fill in your private key and API keys:
   ```env
   PRIVATE_KEY=your_private_key_without_0x_prefix
   CELOSCAN_API_KEY=your_celoscan_api_key
   ```

## Project Structure

```
contracts/             # Smart contract source files
├── Delulu-v3.sol      # Current production contract (UUPS-upgradeable)
├── Delulu.sol         # Earlier version, kept for reference/history
└── test/              # Test-only helper contracts (MockERC20, DeluluProxy)

test/                  # Hardhat/Mocha test suites
├── Delulu.js
├── Delulu-v3-delete-milestone.js
├── Delulu-v3-min-stake-decimals.js
└── Delulu-v3-refund-challenge-pool.js

scripts/               # Deployment and upgrade tooling
├── deploy-delulu-v3.cjs
├── upgrade-delulu-v3.cjs
├── validate-upgrade.cjs / validate-upgrade-from-proxy.cjs
├── simulate-uups-upgrade-hardhat.cjs
└── set-token-support.cjs

ignition/modules/Lock.ts  # Unused Hardhat Ignition sample, not part of the real deploy flow

hardhat.config.cjs / hardhat.config.ts  # Hardhat configuration
tsconfig.json          # TypeScript configuration
```

## Security Notes

- Never commit your `.env` file with real private keys
- Use a dedicated wallet for development/testing
- Run `pnpm validate:upgrade` before every `upgrade:sepolia`/`upgrade:celo` to catch storage-layout or initializer issues
- Test thoroughly on Celo Sepolia before mainnet deployment/upgrade
- Consider using a hardware wallet for mainnet deployments

## Learn More

- [Hardhat Documentation](https://hardhat.org/docs)
- [Celo Developer Documentation](https://docs.celo.org)
- [OpenZeppelin Upgrades Documentation](https://docs.openzeppelin.com/upgrades-plugins) (UUPS pattern used by `Delulu-v3.sol`)
- [Viem Documentation](https://viem.sh)
