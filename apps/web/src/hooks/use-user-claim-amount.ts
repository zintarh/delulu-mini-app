import { useQuery } from "@apollo/client/react";
import { useAccount } from "wagmi";
import { formatUnits } from "viem";
import type {
  GetUserClaimForDeluluQuery,
  GetUserClaimForDeluluQueryVariables,
} from "@/generated/graphql";
import { GetUserClaimForDeluluDocument } from "@/generated/graphql";

/**
 * Hook to get the amount a user claimed for a specific delulu from The Graph
 */
export function useUserClaimAmount(deluluId: string | null) {
  const { address } = useAccount();

  const { data, loading, error } = useQuery<
    GetUserClaimForDeluluQuery,
    GetUserClaimForDeluluQueryVariables
  >(GetUserClaimForDeluluDocument, {
    variables: {
      userId: address?.toLowerCase() ?? "",
      deluluId: deluluId ?? "",
    },
    skip: !address || !deluluId,
    fetchPolicy: "cache-and-network",
  });

  const claimedAmount =
    data?.claims && data.claims.length > 0
      ? Number(formatUnits(BigInt(data.claims[0].amount), 18))
      : null;

  return {
    claimedAmount,
    isLoading: loading,
    error: error ?? null,
  };
}
