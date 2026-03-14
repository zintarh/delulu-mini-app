"use client";

import { useCallback, useEffect, useRef } from "react";
import { usePrivy, useSigners } from "@privy-io/react-auth";

const STORAGE_KEY_DELEGATED = "delulu_session_signer_delegated";

/**
 * One-time setup: add the app's session signer to the user's embedded wallet
 * so the server can send transactions on their behalf without prompting every time.
 * Requires Privy Dashboard: Server-side access enabled + key quorum created.
 * signerKeyQuorumId is passed from the server (PRIVY_SIGNER_KEY_QUORUM_ID) so it is not exposed in the client bundle.
 * See apps/web/docs/PRIVY_SESSION_KEYS.md.
 */
export function useSessionSigner(signerKeyQuorumId?: string) {
  const { user, authenticated } = usePrivy();
  const signers = useSigners();
  const attemptedRef = useRef(false);

  const tryAddSessionSigner = useCallback(async () => {
    const addSigners = signers?.addSigners;
    if (!signerKeyQuorumId || !user || !addSigners) return;

    try {
      const delegated = typeof window !== "undefined" && sessionStorage.getItem(STORAGE_KEY_DELEGATED);
      if (delegated === "true") return;

      const linkedAccounts = user.linkedAccounts ?? [];
      const embeddedWallet = linkedAccounts.find(
        (a: { type: string; walletClientType?: string; address?: string }) =>
          a.type === "wallet" && a.walletClientType === "privy"
      );
      const address = embeddedWallet && "address" in embeddedWallet ? (embeddedWallet as { address: string }).address : undefined;

      if (!address) return;

      await addSigners({
        address,
        signers: [{ signerId: signerKeyQuorumId, policyIds: [] }],
      });

      if (typeof window !== "undefined") sessionStorage.setItem(STORAGE_KEY_DELEGATED, "true");
    } catch {
      // Ignore (e.g. already added, or signers not enabled in dashboard)
    }
  }, [signerKeyQuorumId, user, signers?.addSigners]);

  useEffect(() => {
    if (!authenticated || !user || attemptedRef.current) return;
    attemptedRef.current = true;
    tryAddSessionSigner();
  }, [authenticated, user, tryAddSessionSigner]);
}
