import { useAccount, useBalance, useReadContract } from "wagmi";
import { DELULU_CONTRACT_ADDRESS } from "@/lib/constant";
import { DELULU_ABI } from "@/lib/abi";
import { useEffect } from "react";

export function useCUSDBalance() {
  const { address } = useAccount();
  
  const { data: tokenAddress } = useReadContract({
    address: DELULU_CONTRACT_ADDRESS,
    abi: DELULU_ABI,
    functionName: "stablecoin",
  });

  const { data: balance, isLoading, error } = useBalance({
    address,
    token: tokenAddress as `0x${string}` | undefined,
    query: { enabled: !!tokenAddress && !!address },
  });

  useEffect(() => {
    if (balance && tokenAddress) {
      console.log("=== Celo Chain Balances ===");
      console.log("cUSD Token Address:", tokenAddress);
      console.log("cUSD Balance (wei):", balance.value.toString());
      console.log("cUSD Balance (formatted):", balance.formatted);
      console.log("cUSD Symbol:", balance.symbol);
      console.log("Decimals:", balance.decimals);
      console.log("=========================");
    }
    if (error) {
      console.error("Error fetching cUSD balance:", error);
    }
  }, [balance, tokenAddress, error]);

  return {
    balance,
    isLoading,
    error,
    tokenAddress,
  };
}

