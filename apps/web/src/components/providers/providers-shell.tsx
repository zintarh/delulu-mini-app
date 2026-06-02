import Providers from "@/components/providers";

/**
 * Server wrapper: reads Privy env at request time without forcing the entire app dynamic.
 * Also supports NEXT_PUBLIC_* via the client fallback inside AppWithPrivy.
 */
export function ProvidersShell({ children }: { children: React.ReactNode }) {
  const privyAppIdRaw =
    process.env.PRIVY_APP_ID ?? process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? "";
  const privyAppId =
    typeof privyAppIdRaw === "string" && privyAppIdRaw.trim()
      ? privyAppIdRaw.trim()
      : undefined;
  const signerKeyQuorumIdRaw =
    process.env.PRIVY_SIGNER_KEY_QUORUM_ID ??
    process.env.NEXT_PUBLIC_PRIVY_SIGNER_KEY_QUORUM_ID ??
    "";
  const signerKeyQuorumId =
    typeof signerKeyQuorumIdRaw === "string" && signerKeyQuorumIdRaw.trim()
      ? signerKeyQuorumIdRaw.trim()
      : undefined;

  return (
    <Providers privyAppId={privyAppId} signerKeyQuorumId={signerKeyQuorumId}>
      {children}
    </Providers>
  );
}
