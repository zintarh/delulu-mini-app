"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, ExternalLink, Globe2, Lock } from "lucide-react";
import { Coin, Lulu, Segmented, gameButtonClass } from "@/components/ds";
import { UserAvatar } from "@/components/ui/user-avatar";
import { useAuth } from "@/hooks/use-auth";
import { useRedirectToSignIn } from "@/hooks/use-redirect-to-sign-in";
import { useGoodDollarPrice } from "@/hooks/use-gooddollar-price";
import { compactCount } from "@/lib/rewards/public-stats";
import { formatUsdFromG } from "@/lib/rewards/summary";
import { timeAgo } from "@/lib/support/format";
import type { MySupportDto, SupportTxItem } from "@/app/api/support/mine/route";
import { cn } from "@/lib/utils";

const STATUS: Record<SupportTxItem["status"], { label: string; cls: string }> = {
  confirmed: { label: "Sent", cls: "bg-green-soft text-green-edge" },
  submitted: { label: "Confirming", cls: "bg-yellow-soft text-ink" },
  failed: { label: "Failed", cls: "bg-orange-soft text-orange" },
};

function useMySupport(enabled: boolean) {
  return useQuery<MySupportDto>({
    queryKey: ["my-support"],
    enabled,
    staleTime: 15_000,
    // Keep checking while something is still confirming.
    refetchInterval: (q) => (q.state.data?.sent.items.some((i) => i.status === "submitted") ? 8_000 : false),
    queryFn: async () => {
      const res = await fetch("/api/support/mine", { credentials: "same-origin" });
      if (!res.ok) throw new Error("Failed to load");
      return res.json();
    },
  });
}

function Total({ value, label, usd }: { value: number; label: string; usd: string | null }) {
  return (
    <div className="min-w-0 flex-1 rounded-[20px] border-2 border-line bg-white px-3.5 py-3 shadow-edge">
      <div className="flex items-center gap-1.5 font-display text-[24px] font-extrabold uppercase leading-none tabular-nums">
        <Coin size={20} /> {compactCount(value)}
      </div>
      <div className="label-mono mt-1.5 truncate text-[9px] text-muted-foreground">{label}</div>
      {usd ? <div className="mt-0.5 text-[11px] font-semibold text-muted-foreground">≈ {usd}</div> : null}
    </div>
  );
}

function TxRow({ item, direction }: { item: SupportTxItem; direction: "sent" | "received" }) {
  const s = STATUS[item.status];
  const who = item.person.username ? `@${item.person.username}` : "Someone";
  return (
    <div className="flex items-center gap-3 px-3.5 py-3">
      <UserAvatar address="0x0000" username={item.person.username} pfpUrl={item.person.pfpUrl} size={34} />
      <div className="min-w-0 flex-1">
        <Link href={`/support/${item.deluluId}`} className="block truncate text-sm font-bold text-ink no-underline">
          {direction === "sent" ? `To ${who}` : `From ${who}`}
        </Link>
        <div className="truncate text-[12px] text-muted-foreground">
          {item.deluluTitle} · {timeAgo(item.at)}
        </div>
        {item.error ? <div className="truncate text-[11px] font-semibold text-orange">{item.error}</div> : null}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <span className="text-sm font-extrabold tabular-nums">
          {direction === "sent" ? "−" : "+"}
          {item.amountG.toLocaleString("en-US")} G$
        </span>
        <span className="flex items-center gap-1.5">
          {direction === "sent" ? <span className={cn("label-mono rounded-full px-2 py-0.5 text-[9px]", s.cls)}>{s.label}</span> : null}
          {item.txHash ? (
            <a
              href={`https://celoscan.io/tx/${item.txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="View on CeloScan"
              className="text-muted-foreground"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          ) : null}
        </span>
      </div>
    </div>
  );
}

/** "My support" tab on /support: sent, received, and your Delulus' totals. */
export function MySupportPanel() {
  const { authenticated, isReady } = useAuth();
  const { redirectToSignIn } = useRedirectToSignIn();
  const { data, isLoading, isError, refetch } = useMySupport(authenticated);
  const { usd } = useGoodDollarPrice();
  const [view, setView] = useState<"sent" | "received">("sent");

  if (isReady && !authenticated) {
    return (
      <div className="flex flex-col items-center py-12 text-center">
        <Lulu size={72} />
        <button type="button" onClick={() => redirectToSignIn()} className={gameButtonClass({ className: "mt-4" })}>
          Sign in to see your support
        </button>
      </div>
    );
  }
  if (isLoading || !isReady) {
    return (
      <div className="flex flex-col gap-3">
        <div className="h-[92px] animate-pulse rounded-[20px] bg-line/70" />
        <div className="h-[180px] animate-pulse rounded-[20px] bg-line/70" />
      </div>
    );
  }
  if (isError || !data) {
    return (
      <div className="py-12 text-center">
        <p className="m-0 font-bold">Couldn&apos;t load your support</p>
        <button type="button" onClick={() => void refetch()} className={gameButtonClass({ variant: "line", size: "sm", className: "mt-3" })}>
          Try again
        </button>
      </div>
    );
  }

  const items = view === "sent" ? data.sent.items : data.received.items;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2.5">
        <Total
          value={data.sent.totalG}
          label={`Sent · ${data.sent.delulus} Delulu${data.sent.delulus === 1 ? "" : "s"}`}
          usd={formatUsdFromG(data.sent.totalG, usd)}
        />
        <Total
          value={data.received.totalG}
          label={`Received · ${data.received.supporters} ${data.received.supporters === 1 ? "person" : "people"}`}
          usd={formatUsdFromG(data.received.totalG, usd)}
        />
      </div>

      {data.myDelulus.length > 0 ? (
        <section>
          <h2 className="m-0 mb-2 text-[16px] font-extrabold">Your Delulus</h2>
          <div className="flex flex-col gap-2">
            {data.myDelulus.map((d) => (
              <Link
                key={d.id}
                href={d.isPublic ? `/support/${d.id}` : `/forfeit/${d.id}`}
                className="press-edge flex items-center gap-3 rounded-2xl border-2 border-line bg-white px-3.5 py-2.5 text-ink no-underline shadow-edge-sm"
              >
                {d.isPublic ? (
                  <Globe2 className="h-4 w-4 shrink-0 text-green-edge" strokeWidth={2.4} />
                ) : (
                  <Lock className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={2.4} />
                )}
                <span className="min-w-0 flex-1 truncate text-sm font-bold">{d.title}</span>
                <span className="shrink-0 text-[13px] font-extrabold tabular-nums">
                  {compactCount(d.totalG)} G$ · {d.supporters}
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <Segmented
        ariaLabel="Support history"
        value={view}
        onChange={setView}
        options={[
          { value: "sent", label: "Sent" },
          { value: "received", label: "Received" },
        ]}
      />

      {items.length === 0 ? (
        <div className="flex flex-col items-center py-8 text-center">
          <p className="m-0 font-extrabold">{view === "sent" ? "You haven't supported anyone yet" : "No support yet"}</p>
          {view === "sent" ? (
            <Link href="/support" className={gameButtonClass({ size: "sm", className: "mt-3 no-underline" })}>
              Discover Delulus
            </Link>
          ) : (
            <p className="m-0 mt-1 text-sm text-muted-foreground">Make a Delulu public so people can back you.</p>
          )}
        </div>
      ) : (
        <div className="divide-y divide-line/70 overflow-hidden rounded-[20px] border-2 border-line bg-white shadow-edge">
          {items.map((i) => (
            <TxRow key={i.id} item={i} direction={view} />
          ))}
        </div>
      )}
    </div>
  );
}
