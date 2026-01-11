import { useAccount, useBalance, useReadContract, useChainId } from "wagmi";
import { CUSD_ADDRESSES, DELULU_CONTRACT_ADDRESS } from "@/lib/constant";
import { DELULU_ABI } from "@/lib/abi";

export function useCUSDBalance() {
  const { address } = useAccount();
  const chainId = useChainId();

  const {
    data: tokenAddress,
    isLoading: isLoadingTokenAddress,
    error: tokenAddressError,
  } = useReadContract({
    address: DELULU_CONTRACT_ADDRESS ,
    abi: DELULU_ABI,
    functionName: "stablecoin",
  });



  // Fallback: use known cUSD addresses based on chain
  const fallbackTokenAddress =
    chainId === 44787
      ? CUSD_ADDRESSES.alfajores
      : chainId === 42220
      ? CUSD_ADDRESSES.mainnet
      : undefined;


  const finalTokenAddress = tokenAddress || fallbackTokenAddress;

  const {
    data: balance,
    isLoading,
    error,
  } = useBalance({
    address,
    token: finalTokenAddress as `0x${string}` | undefined,
    query: { enabled: !!finalTokenAddress && !!address },
  });

  console.log(tokenAddress, balance, "token address")


  return {
    balance,
    isLoading: isLoading || isLoadingTokenAddress,
    error: error || tokenAddressError,
    tokenAddress: finalTokenAddress,
  };
}
