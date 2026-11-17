"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, ChevronLeft, Copy, ExternalLink, KeyRound, Vote, Wallet } from "lucide-react";
import { GameButton, Lulu } from "@/components/ds";
import { MainPage } from "@/components/main-app-header";
import { ICON_BUTTON_CLASS } from "@/components/page-back-header";
import { ExportKeySheet } from "@/components/wallet/export-key-sheet";
import { useAuth } from "@/hooks/use-auth";
import { FLOW_STATE } from "@/lib/flow-state";
import { cn } from "@/lib/utils";

function Step({ n, icon: Icon, title, children }: { n: number; icon: typeof Vote; title: string; children: React.ReactNode }) {
  return (
    <section className="animate-rise rounded-[20px] border-2 border-line bg-white p-4 shadow-edge-sm">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink font-display text-lg font-extrabold text-white">{n}</span>
        <h2 className="m-0 flex-1 text-[17px] font-extrabold leading-tight">{title}</h2>
        <Icon className="h-5 w-5 text-muted-foreground" />
      </div>
      <div className="mt-3 flex flex-col gap-2.5 text-[14px] leading-snug">{children}</div>
    </section>
  );
}

const Li = ({ children }: { children: React.ReactNode }) => <li className="pl-1">{children}</li>;

/** Support Delulu on Flow State: take your wallet to MetaMask, then vote. */
export default function FlowStateGuidePage() {
  const { address } = useAuth();
  const [exportOpen, setExportOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const short = address ? `${address.slice(0, 6)}…${address.slice(-4)}` : null;

  return (
    <MainPage>
      <div className="mx-auto flex max-w-md flex-col gap-4 px-5 pb-16 pt-4">
        <Link href="/home" aria-label="Home" className={ICON_BUTTON_CLASS}>
          <ChevronLeft className="h-5 w-5" strokeWidth={2} />
        </Link>

        <header className="flex items-center gap-3">
          <Lulu size={64} mood="kept" />
          <div>
            <p className="label-mono m-0 text-[11px] text-orange">Urgent · 3 quick steps</p>
            <h1 className="m-0 mt-1 font-display text-[28px] font-extrabold uppercase leading-[0.95]">Vote for Delulu on Flow State</h1>
          </div>
        </header>
        <p className="m-0 text-[14px] font-semibold text-muted-foreground">
          Your vote keeps G$ flowing to Delulu this season — that&apos;s what pays for Bingo rewards, gifts and everything we run for you.
          {FLOW_STATE.endsOn ? <b className="text-ink"> Voting ends {FLOW_STATE.endsOn}.</b> : null}
        </p>

        <Step n={1} icon={KeyRound} title="Get your Delulu wallet key">
          <p className="m-0">Flow State works with MetaMask, so you&apos;ll bring your Delulu wallet there — same address, same G$.</p>
          {short ? (
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard.writeText(address!);
                setCopied(true);
                window.setTimeout(() => setCopied(false), 1800);
              }}
              className="flex items-center justify-between rounded-xl bg-paper px-3 py-2 text-left"
            >
              <span className="text-[13px]">
                Your Delulu address: <b className="font-mono">{short}</b>
              </span>
              {copied ? <Check className="h-4 w-4 text-green-edge" /> : <Copy className="h-4 w-4 text-muted-foreground" />}
            </button>
          ) : null}
          <GameButton variant="ink" full onClick={() => setExportOpen(true)} disabled={!address}>
            <KeyRound className="h-4 w-4" /> Show my wallet key
          </GameButton>
        </Step>

        <Step n={2} icon={Wallet} title="Add it to MetaMask">
          <ol className="m-0 flex list-decimal flex-col gap-1.5 pl-5">
            <Li>
              Install <b>MetaMask</b> from the Play Store or App Store and open it (create a quick password if it&apos;s new).
            </Li>
            <Li>
              Tap your <b>account name</b> at the top → <b>Add account or hardware wallet</b> → <b>Import account</b>.
            </Li>
            <Li>
              Paste your key and tap <b>Import</b>. (Not &ldquo;Import wallet&rdquo; — that&apos;s for 12-word phrases.)
            </Li>
            <Li>
              Check the address starts with <b className="font-mono">{short ?? "your Delulu address"}</b> — then it&apos;s the same wallet.
            </Li>
          </ol>
        </Step>

        <Step n={3} icon={Vote} title="Vote on Flow State">
          <ol className="m-0 flex list-decimal flex-col gap-1.5 pl-5">
            <Li>
              In MetaMask, open the <b>Browser</b> tab and go to Delulu&apos;s Flow State page (button below).
            </Li>
            <Li>
              Tap <b>Connect Wallet</b> → <b>MetaMask</b>, and allow the <b>Celo</b> network if asked.
            </Li>
            <Li>
              If you see <b>Check Voter Eligibility</b>, tap it, then <b>Claim votes</b> and sign.
            </Li>
            <Li>
              Find <b>Delulu</b>, add it to your ballot, give it your votes and <b>submit</b>. Fees are usually covered for you.
            </Li>
          </ol>
          {FLOW_STATE.voteUrl ? (
            <a
              href={FLOW_STATE.voteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="press-edge inline-flex h-[52px] items-center justify-center gap-2 rounded-2xl bg-yellow text-[15px] font-extrabold uppercase tracking-[0.06em] text-ink shadow-edge-yellow no-underline"
            >
              Open Delulu on Flow State <ExternalLink className="h-4 w-4" />
            </a>
          ) : (
            <p className={cn("m-0 rounded-xl bg-yellow-soft px-3 py-2 text-[13px] font-semibold text-[#8a6a00]")}>The voting link goes live here shortly.</p>
          )}
        </Step>

        <p className="m-0 text-center text-[12px] font-semibold text-muted-foreground">
          After voting, tap <b>Post to X</b> on Flow State to bring your friends along. 💛
        </p>
      </div>
      <ExportKeySheet open={exportOpen} onOpenChange={setExportOpen} />
    </MainPage>
  );
}
