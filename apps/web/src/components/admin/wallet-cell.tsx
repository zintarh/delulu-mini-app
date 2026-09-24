"use client";

import { ExternalLink } from "lucide-react";
import { formatAddress } from "@/lib/utils";

/** @username (or short address) with the address underneath and a Celoscan link. */
export function WalletCell({
  address,
  username,
}: {
  address: string;
  username: string | null;
}) {
  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <div className="min-w-0">
        <p className="truncate font-semibold text-foreground">
          {username ? `@${username}` : formatAddress(address as `0x${string}`)}
        </p>
        {username ? (
          <p className="font-mono text-[11px] text-muted-foreground">
            {formatAddress(address as `0x${string}`)}
          </p>
        ) : null}
      </div>
      <a
        href={`https://celoscan.io/address/${address}`}
        target="_blank"
        rel="noopener noreferrer"
        className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
        title="View on Celoscan"
      >
        <ExternalLink className="h-3.5 w-3.5" />
      </a>
    </div>
  );
}
