import { useWriteContract, useWaitForTransactionReceipt, useReadContract, useAccount } from "wagmi";
import { parseUnits } from "viem";
import { DELULU_CONTRACT_ADDRESS } from "@/lib/constant";
import { DELULU_ABI } from "@/lib/abi";

const ERC20_ABI = [
  {
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    name: "approve",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    name: "allowance",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

export function useTokenApproval() {
  const { address } = useAccount();
  
  const { data: tokenAddress } = useReadContract({
    address: DELULU_CONTRACT_ADDRESS,
    abi: DELULU_ABI,
    functionName: "stablecoin",
  });

  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess, error: receiptError } = useWaitForTransactionReceipt({
    hash,
  });

  const { data: allowance, refetch: refetchAllowance, isLoading: isLoadingAllowance } = useReadContract({
    address: tokenAddress as `0x${string}`,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: address && tokenAddress ? [address, DELULU_CONTRACT_ADDRESS] : undefined,
    query: { enabled: !!tokenAddress && !!address },
  });


  const approve = async (amount: number) => {
    if (!tokenAddress) {
      throw new Error("Token address not available");
    }
    if (!isFinite(amount) || isNaN(amount) || amount <= 0) {
      throw new Error("Invalid amount");
    }
    
    const bufferMultiplier = 1.1; // 10% buffer
    const amountWithBuffer = amount * bufferMultiplier;
    const amountWei = parseUnits(amountWithBuffer.toString(), 18);
    
    writeContract({
      address: tokenAddress as `0x${string}`,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [DELULU_CONTRACT_ADDRESS, amountWei],
    });
  };


  const needsApproval = (amount: number): boolean => {
    // Safe handling of invalid inputs
    if (!allowance || !tokenAddress) return true;
    if (!amount || isNaN(amount) || amount <= 0) return true;
    
    try {
      const amountWei = parseUnits(amount.toString(), 18);
      return allowance < amountWei;
    } catch (error) {
      // If parsing fails, assume approval is needed
      console.warn("[useTokenApproval] Error parsing amount in needsApproval:", error);
      return true;
    }
  };



  return {
    approve,
    needsApproval,
    tokenAddress,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error: error || receiptError,
    refetchAllowance,
    isLoadingAllowance,
  };
}

