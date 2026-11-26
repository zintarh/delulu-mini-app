"use client";

import { useState } from "react";
import { ArrowUpRight, KeyRound } from "lucide-react";
import { ResponsiveSheet } from "@/components/ui/responsive-sheet";
import { GameButton } from "@/components/ds";
import { ExportKeySheet } from "@/components/wallet/export-key-sheet";
import { GOODDOLLAR_ADDRESSES } from "@/lib/constant";
import { cn } from "@/lib/utils";

/**
 * Rewards → Swap: there's no swap inside Delulu, so this shows the two ways
 * out. Send the G$ to a wallet you already use and swap there, or open your
 * Delulu wallet in MetaMask (same address, same G$) and swap on a DEX.
 */
const APP_STORE = "https://apps.apple.com/app/metamask/id1438144202";
const PLAY_STORE = "https://play.google.com/store/apps/details?id=io.metamask";
/** Uniswap on Celo with G$ as what you're selling. */
const UNISWAP_SELL_GD = `https://app.uniswap.org/swap?chain=celo&inputCurrency=${GOODDOLLAR_ADDRESSES.mainnet}`;
const UBESWAP = "https://app.ubeswap.org/#/swap";
/** Opens a page inside MetaMask's own browser, where the imported wallet is connected. */
const inMetaMask = (url: string) => `https://metamask.app.link/dapp/${url.replace(/^https?:\/\//, "")}`;

const linkBtn =
  "inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl border-2 border-ink bg-white px-3 text-[12px] font-extrabold text-ink no-underline";

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink text-[12px] font-extrabold text-yellow">{n}</span>
      <div className="min-w-0 flex-1">
        <p className="m-0 text-[14px] font-extrabold leading-tight">{title}</p>
        <div className="mt-1.5 flex flex-col gap-2 text-[12px] font-semibold leading-snug text-muted-foreground">{children}</div>
      </div>
    </li>
  );
}

export function SwapGuideSheet({ open, onOpenChange, onSend }: { open: boolean; onOpenChange: (open: boolean) => void; onSend: () => void }) {
  const [way, setWay] = useState<"send" | "metamask">("metamask");
  const [keyOpen, setKeyOpen] = useState(false);

  return (
    <>
      <ResponsiveSheet open={open} onOpenChange={onOpenChange} title="Swap your G$" sheetClassName="rounded-t-3xl pb-10" modalClassName="max-w-md">
        <div className="flex flex-col gap-4 px-5 pt-1 text-ink">
          <p className="m-0 text-[13px] font-semibold text-muted-foreground">
            Swaps happen outside Delulu, on a DEX like Uniswap. Pick a way:
          </p>

          <div className="grid grid-cols-2 gap-2" role="tablist" aria-label="How to swap">
            {(
              [
                ["metamask", "🦊 Use MetaMask"],
                ["send", "↗ Send out"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={way === id}
                onClick={() => setWay(id)}
                className={cn(
                  "h-10 rounded-xl border-2 text-[13px] font-extrabold",
                  way === id ? "border-ink bg-ink text-white" : "border-line bg-white text-ink",
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {way === "metamask" ? (
            <ol className="m-0 flex list-none flex-col gap-4 p-0">
              <Step n={1} title="Get MetaMask">
                <div className="flex gap-2">
                  <a href={APP_STORE} target="_blank" rel="noopener noreferrer" className={linkBtn}>
                    App Store
                  </a>
                  <a href={PLAY_STORE} target="_blank" rel="noopener noreferrer" className={linkBtn}>
                    Google Play
                  </a>
                </div>
              </Step>
              <Step n={2} title="Import your Delulu wallet">
                <span>
                  Copy your key → in MetaMask tap your <b className="text-ink">account name</b> → <b className="text-ink">Add account</b> →{" "}
                  <b className="text-ink">Import account</b> → paste. Same address, same G$.
                </span>
                <GameButton variant="ink" full onClick={() => setKeyOpen(true)}>
                  <KeyRound className="h-4 w-4" /> Show my wallet key
                </GameButton>
              </Step>
              <Step n={3} title="Swap on a DEX">
                <span>Open one in MetaMask, pick the Celo network, and swap G$ for what you want.</span>
                <div className="flex gap-2">
                  <a href={inMetaMask(UNISWAP_SELL_GD)} className={linkBtn}>
                    🦄 Uniswap
                  </a>
                  <a href={inMetaMask(UBESWAP)} className={linkBtn}>
                    Ubeswap
                  </a>
                </div>
              </Step>
            </ol>
          ) : (
            <ol className="m-0 flex list-none flex-col gap-4 p-0">
              <Step n={1} title="Send your G$ to a wallet you use">
                <span>MetaMask, MiniPay, Valora or another Celo wallet. Use your Celo address there.</span>
                <GameButton variant="ink" full onClick={onSend}>
                  <ArrowUpRight className="h-4 w-4" /> Send G$
                </GameButton>
              </Step>
              <Step n={2} title="Swap there">
                <span>In that wallet, swap G$ on a DEX like Uniswap or Ubeswap (Celo network).</span>
              </Step>
            </ol>
          )}

          <p className="m-0 rounded-xl bg-paper px-3 py-2 text-center text-[11px] font-bold text-muted-foreground">
            Never share your key. Delulu will never ask for it.
          </p>
        </div>
      </ResponsiveSheet>
      <ExportKeySheet open={keyOpen} onOpenChange={setKeyOpen} />
    </>
  );
}
