// This setup uses Hardhat Ignition to manage smart contract deployments.
// Learn more about it at https://hardhat.org/ignition

import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

// cUSD Token Addresses on different Celo networks
const CUSD_ADDRESSES = {
  // Celo Mainnet
  celo: "0x765DE816845861e75A25fCA122bb6898B8B1282a",
  // Celo Alfajores Testnet
  alfajores: "0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1",
  // Celo Sepolia Testnet
  sepolia: "0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1",
  // For localhost, we'll use Alfajores address (can be changed as needed)
  localhost: "0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1",
};

const DeluluModule = buildModule("DeluluModule", (m) => {
  // Get network name from Hardhat config (defaults to alfajores for testing)
  const networkName = m.getParameter("network", "alfajores");
  
  // Get cUSD address based on network, with fallback to alfajores
  const cUSDAddress = m.getParameter(
    "cUSDAddress",
    CUSD_ADDRESSES[networkName as keyof typeof CUSD_ADDRESSES] || CUSD_ADDRESSES.alfajores
  );

  // Deploy the Delulu contract with the cUSD token address
  const delulu = m.contract("Delulu", [cUSDAddress]);

  return { delulu };
});

export default DeluluModule;

