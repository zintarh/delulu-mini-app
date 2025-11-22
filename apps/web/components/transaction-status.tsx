"use client";

import { useEffect } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, XCircle, ExternalLink } from "lucide-react";
import { useChainId } from "wagmi";

interface TransactionStatusProps {
  isPending?: boolean;
  isConfirming?: boolean;
  isSuccess?: boolean;
  error?: Error | null;
  hash?: `0x${string}`;
  successMessage?: string;
  errorMessage?: string;
  onSuccess?: () => void;
}

export function TransactionStatus({
  isPending,
  isConfirming,
  isSuccess,
  error,
  hash,
  successMessage = "Transaction successful!",
  errorMessage = "Transaction failed",
  onSuccess,
}: TransactionStatusProps) {
  const chainId = useChainId();
  
  useEffect(() => {
    if (isSuccess && onSuccess) {
      onSuccess();
    }
  }, [isSuccess, onSuccess]);

  // Get explorer URL based on chain
  const getExplorerUrl = (txHash: string) => {
    if (chainId === 42220) {
      // Celo Mainnet
      return `https://celoscan.io/tx/${txHash}`;
    } else {
      // Celo Alfajores Testnet (default)
      return `https://alfajores.celoscan.io/tx/${txHash}`;
    }
  };

  if (isPending && !isConfirming) {
    return (
      <Alert className="border-delulu-yellow bg-delulu-yellow/5">
        <Loader2 className="h-4 w-4 animate-spin text-delulu-yellow" />
        <AlertTitle>Waiting for approval</AlertTitle>
        <AlertDescription>Please confirm the transaction in your wallet...</AlertDescription>
      </Alert>
    );
  }

  if (isConfirming) {
    return (
      <Alert className="border-delulu-yellow bg-delulu-yellow/5">
        <Loader2 className="h-4 w-4 animate-spin text-delulu-yellow" />
        <AlertTitle>Transaction pending</AlertTitle>
        <AlertDescription>
          Your transaction is being confirmed on the blockchain...
          {hash && (
            <Button
              variant="link"
              className="h-auto p-0 ml-2 text-delulu-yellow"
              onClick={() => window.open(getExplorerUrl(hash), "_blank")}
            >
              View on Explorer <ExternalLink className="ml-1 h-3 w-3" />
            </Button>
          )}
        </AlertDescription>
      </Alert>
    );
  }

  if (isSuccess) {
    return (
      <Alert className="border-delulu-green bg-delulu-green/5">
        <CheckCircle2 className="h-4 w-4 text-delulu-green" />
        <AlertTitle>Success!</AlertTitle>
        <AlertDescription>
          {successMessage}
          {hash && (
            <Button
              variant="link"
              className="h-auto p-0 ml-2 text-delulu-green"
              onClick={() => window.open(getExplorerUrl(hash), "_blank")}
            >
              View on Explorer <ExternalLink className="ml-1 h-3 w-3" />
            </Button>
          )}
        </AlertDescription>
      </Alert>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive" className="border-red-500 bg-red-500/5">
        <XCircle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>
          {errorMessage}: {error.message?.split("\n")[0]}
        </AlertDescription>
      </Alert>
    );
  }

  return null;
}

/**
 * Approval flow component - shows approval button and status
 */
interface ApprovalFlowProps {
  needsApproval: boolean;
  hasInfiniteApproval: boolean;
  isPending?: boolean;
  isConfirming?: boolean;
  isSuccess?: boolean;
  error?: Error | null;
  hash?: `0x${string}`;
  onApprove: () => void;
  onApproveMax: () => void;
}

export function ApprovalFlow({
  needsApproval,
  hasInfiniteApproval,
  isPending,
  isConfirming,
  isSuccess,
  error,
  hash,
  onApprove,
  onApproveMax,
}: ApprovalFlowProps) {
  if (!needsApproval && !isPending && !isConfirming) {
    return null;
  }

  return (
    <div className="space-y-3">
      {!hasInfiniteApproval && !isSuccess && (
        <div className="flex gap-2">
          <Button
            onClick={onApprove}
            disabled={isPending || isConfirming}
            className="flex-1 bg-delulu-yellow hover:bg-delulu-yellow/90 text-delulu-dark"
          >
            {isPending || isConfirming ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Approving...
              </>
            ) : (
              "Approve cUSD"
            )}
          </Button>
          <Button
            onClick={onApproveMax}
            disabled={isPending || isConfirming}
            variant="outline"
            className="border-delulu-yellow text-delulu-yellow hover:bg-delulu-yellow/10"
          >
            Approve Max
          </Button>
        </div>
      )}

      <TransactionStatus
        isPending={isPending && !isConfirming}
        isConfirming={isConfirming}
        isSuccess={isSuccess}
        error={error}
        hash={hash}
        successMessage="cUSD approval successful! You can now proceed with the transaction."
        errorMessage="Approval failed"
      />
    </div>
  );
}

