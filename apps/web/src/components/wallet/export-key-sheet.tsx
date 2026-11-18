"use client";

import { useState } from "react";
import { Check, Copy, Eye, ShieldAlert } from "lucide-react";
import { useWeb3Auth } from "@web3auth/modal/react";
import { useExportWallet, useWallets } from "@privy-io/react-auth";
import { ResponsiveSheet } from "@/components/ui/responsive-sheet";
import { GameButton, HoldToSign } from "@/components/ds";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

/**
 * Lets someone take their Delulu wallet to MetaMask (same address, same G$,
 * same GoodDollar verification). Privy users get Privy's own export window —
 * the key never touches Delulu's code. Web3Auth users reveal it by holding a
 * button. Warnings and a confirm come first, every time.
 */
export function ExportKeySheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { provider: authProvider, address } = useAuth();
  const { web3Auth } = useWeb3Auth();
  const { wallets } = useWallets();
  const { exportWallet } = useExportWallet();
  const [agreed, setAgreed] = useState(false);
  const [key, setKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const privyWallet = wallets.find((w) => w.address.toLowerCase() === address?.toLowerCase());
  const privyEmbedded = !!privyWallet && privyWallet.walletClientType.startsWith("privy");
  const externalWallet = authProvider === "privy" && !!privyWallet && !privyEmbedded;

  const close = (o: boolean) => {
    if (!o) {
      setKey(null);
      setAgreed(false);
      setError(null);
      setCopied(false);
    }
    onOpenChange(o);
  };

  const reveal = async () => {
    setError(null);
    try {
      if (authProvider === "privy") {
        await exportWallet({ address: address! });
        return;
      }
      // Web3Auth's method is "private_key" (no "eth_" prefix in this SDK version).
      const provider = web3Auth?.provider as { request: (a: { method: string }) => Promise<unknown> } | null | undefined;
      if (!provider) throw new Error("no provider");
      const raw = (await provider.request({ method: "private_key" })) as string | undefined;
      if (!raw) throw new Error("empty");
      setKey(raw.startsWith("0x") ? raw : `0x${raw}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[export-key]", e);
      setError(
        /not (allowed|enabled)|disabled|export/i.test(msg) || msg === "empty"
          ? "Exporting your key isn't switched on yet. We're on it — try again soon."
          : msg === "no provider"
            ? "Your wallet is still loading. Wait a second and try again."
            : `Couldn't open your key (${msg.slice(0, 80)}). Try again, or reach out to us.`,
      );
    }
  };

  const copy = async () => {
    if (!key) return;
    await navigator.clipboard.writeText(key);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <ResponsiveSheet open={open} onOpenChange={close} title="Your wallet key" sheetClassName="rounded-t-3xl pb-10" modalClassName="max-w-md">
      <div className="flex flex-col gap-4 px-5 pt-1">
        {externalWallet ? (
          <p className="m-0 rounded-2xl bg-green-soft px-3.5 py-3 text-[13px] font-semibold text-green-edge">
            You signed in with your own wallet, so it already works in MetaMask — no key to export.
          </p>
        ) : key ? (
          <>
            <div className="break-all rounded-2xl border-2 border-ink bg-paper px-3.5 py-3 font-mono text-[12px] leading-relaxed">{key}</div>
            <GameButton variant="ink" full onClick={() => void copy()}>
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copied ? "Copied" : "Copy key"}
            </GameButton>
            <p className="m-0 text-center text-[12px] font-semibold text-muted-foreground">
              Paste it into MetaMask, then close this. Don&apos;t save it in notes or chats.
            </p>
          </>
        ) : (
          <>
            <div className="flex gap-3 rounded-2xl bg-orange-soft px-3.5 py-3 text-orange">
              <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />
              <ul className="m-0 flex list-none flex-col gap-1.5 p-0 text-[13px] font-semibold leading-snug">
                <li>Anyone with this key controls all your money.</li>
                <li>Delulu will never ask you for it — not on chat, email or calls.</li>
                <li>Only paste it into MetaMask on your own phone.</li>
              </ul>
            </div>
            <label className="flex cursor-pointer items-start gap-2.5 text-[13px] font-semibold">
              <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5 h-4 w-4 accent-ink" />I understand. I&apos;ll keep my key private.
            </label>
            {error ? <p className="m-0 rounded-xl bg-orange-soft px-3 py-2 text-[13px] font-semibold text-orange">{error}</p> : null}
            <div className={cn(!agreed && "pointer-events-none opacity-40")}>
              {authProvider === "privy" ? (
                <GameButton variant="ink" full onClick={() => void reveal()} disabled={!agreed}>
                  <Eye className="h-4 w-4" /> Show my key
                </GameButton>
              ) : (
                <HoldToSign onComplete={() => void reveal()} label="Hold to show my key" />
              )}
            </div>
          </>
        )}
      </div>
    </ResponsiveSheet>
  );
}
