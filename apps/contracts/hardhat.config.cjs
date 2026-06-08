require("@nomicfoundation/hardhat-toolbox-viem");
require("@nomicfoundation/hardhat-chai-matchers");
require("@openzeppelin/hardhat-upgrades");

try {
  require("dotenv").config();
} catch {
  // dotenv optional — use `source .env` or export PRIVATE_KEY when absent
}

/** Prefer PRIVATE_KEY; apps/web/.env.local often uses CELO_FAUCET_PRIVATE_KEY for scripts. */
function celoDeployerAccounts() {
  const key =
    process.env.PRIVATE_KEY ||
    process.env.CELO_FAUCET_PRIVATE_KEY ||
    process.env.CELO_DEPLOYER_PRIVATE_KEY ||
    "";
  return key ? [key] : [];
}

const config = {
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      viaIR: true,
    },
  },
  networks: {
    celo: {
      url: "https://forno.celo.org",
      accounts: celoDeployerAccounts(),
      chainId: 42220,
    },
    sepolia: {
      url: "https://forno.celo-sepolia.celo-testnet.org",
      accounts: celoDeployerAccounts(),
      chainId: 11142220,
    },
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 31337,
    },
  },
  etherscan: {
    apiKey: {
      celo: process.env.CELOSCAN_API_KEY || "",
      sepolia: process.env.CELOSCAN_API_KEY || "",
    },
    customChains: [
      {
        network: "celo",
        chainId: 42220,
        urls: {
          apiURL: "https://api.celoscan.io/api",
          browserURL: "https://celoscan.io",
        },
      },
      {
        network: "sepolia",
        chainId: 11142220,
        urls: {
          apiURL: "https://api-celo-sepolia.blockscout.com/api",
          browserURL: "https://celo-sepolia.blockscout.com",
        },
      },
    ],
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    currency: "USD",
  },
  paths: {
    tests: "./test",
  },
  mocha: {
    require: ["ts-node/register"],
  },
};

module.exports = config;
