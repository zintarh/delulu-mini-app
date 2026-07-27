import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/push/supabase";
import { fetchBatchForfeitCommitmentState } from "@/lib/forfeit/forfeit-subgraph";
import { resolveUsernameForAddress } from "@/lib/resolve-username";

export const dynamic = "force-dynamic";

type CommitmentRow = {
  id: string;
  on_chain_commitment_id: number | null;
  creator_wallet: string;
  title: string;
  evidence_type: string;
  verification_method: string;
  verifier_wallet: string | null;
  is_charity_intent: boolean | null;
  stake_amount_wei: string | null;
  token: string | null;
  destination_type: number | null;
  destination_addr: string | null;
  destination_friend_username: string | null;
  destination_friend_email: string | null;
  status: string;
  created_at: string;
};

/** Only fields the home/profile forfeit card actually renders. */
const FEED_SELECT =
  "id, on_chain_commitment_id, creator_wallet, title, evidence_type, verification_method, verifier_wallet, is_charity_intent, stake_amount_wei, token, destination_type, destination_addr, destination_friend_username, destination_friend_email, status, created_at";

const LEGACY_SELECT =
  "id, on_chain_commitment_id, creator_wallet, title, evidence_type, verification_method, verifier_wallet, status, created_at";

const FEED_LIMIT = 12;

function emptySnapshotFields() {
  return {
    is_charity_intent: null as boolean | null,
    stake_amount_wei: null as string | null,
    token: null as string | null,
    destination_type: null as number | null,
    destination_addr: null as string | null,
    destination_friend_username: null as string | null,
    destination_friend_email: null as string | null,
  };
}

/**
 * Merges Supabase (card metadata + stake/destination snapshot) with
 * subgraph/RPC (live deadline / active state). Kept lean for home feed speed.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get("address")?.trim().toLowerCase();
  const roleParam = searchParams.get("role");
  const role =
    roleParam === "verifier" ? "verifier" : roleParam === "destination" ? "destination" : "creator";

  if (!address) {
    return NextResponse.json({ error: "address is required" }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "DB unavailable" }, { status: 500 });

  // "destination" = forfeits where I'm the friend a creator's stake goes to on
  // a miss — matched on destination_addr (case-insensitive; snapshotted/on-chain
  // addresses aren't guaranteed lowercase) plus destination_type = 2 (Friend),
  // since that's the only type that ever stores a real user wallet there.
  // Supabase's chainable filter-builder type narrows per call in a way plain
  // generics can't express here, so this stays loosely typed.
  const applyRoleFilter = (query: any) =>
    role === "verifier"
      ? // Case-insensitive: verifier_wallet may be checksummed in older rows.
        query.ilike("verifier_wallet", address)
      : role === "destination"
        ? query.ilike("destination_addr", address).eq("destination_type", 2)
        : query.ilike("creator_wallet", address);

  let commitments: CommitmentRow[] = [];

  {
    const full = await applyRoleFilter(
      admin
        .from("forfeit_commitments")
        .select(FEED_SELECT)
        .in("status", ["active", "pending_verifier"])
        .order("created_at", { ascending: false })
        .limit(FEED_LIMIT),
    );

    if (
      full.error &&
      /is_charity_intent|stake_amount_wei|destination_type|destination_addr|destination_friend|column .* does not exist/i.test(
        full.error.message,
      )
    ) {
      // "destination" inherently needs destination_addr/destination_type — if
      // those columns don't exist yet, there's nothing to query for this role.
      if (role === "destination") {
        return NextResponse.json({ items: [] });
      }
      const legacy = await applyRoleFilter(
        admin
          .from("forfeit_commitments")
          .select(LEGACY_SELECT)
          .order("created_at", { ascending: false })
          .limit(FEED_LIMIT),
      );
      if (legacy.error) {
        return NextResponse.json({ error: legacy.error.message }, { status: 500 });
      }
      commitments = ((legacy.data ?? []) as Omit<
        CommitmentRow,
        keyof ReturnType<typeof emptySnapshotFields>
      >[]).map((c) => ({
        ...c,
        ...emptySnapshotFields(),
      }));
    } else if (full.error) {
      // status filter may fail on older schemas — retry without it
      if (/status|check/i.test(full.error.message)) {
        const retry = await applyRoleFilter(
          admin
            .from("forfeit_commitments")
            .select(FEED_SELECT)
            .order("created_at", { ascending: false })
            .limit(FEED_LIMIT),
        );
        if (retry.error) {
          return NextResponse.json({ error: retry.error.message }, { status: 500 });
        }
        commitments = (retry.data ?? []) as CommitmentRow[];
      } else {
        return NextResponse.json({ error: full.error.message }, { status: 500 });
      }
    } else {
      commitments = (full.data ?? []) as CommitmentRow[];
    }
  }

  if (commitments.length === 0) {
    return NextResponse.json({ items: [] });
  }

  const onChainIds = commitments
    .map((c) => c.on_chain_commitment_id)
    .filter((id): id is number => id != null);

  // Always lowercase — profiles rows may be checksummed, and `.in("address", …)`
  // is case-sensitive, which previously dropped friend destinations and forced
  // the card to show `0x5057…113f` instead of `@username`.
  const otherWallets = Array.from(
    new Set(
      [
        ...commitments.map((c) =>
          role === "verifier" ? c.creator_wallet : c.verifier_wallet,
        ),
        ...commitments.map((c) => c.destination_addr),
      ]
        .filter((w): w is string => !!w && w !== "0x0000000000000000000000000000000000000000")
        .map((w) => w.toLowerCase()),
    ),
  );

  const commitmentIds = commitments.map((c) => c.id);

  // Independent: profiles + on-chain state + periods in parallel (no waterfall).
  const [profilesExact, onChainState, periodRowsResult] = await Promise.all([
    otherWallets.length
      ? admin
          .from("profiles")
          .select("address, username, pfp_url, email")
          .in("address", otherWallets)
      : Promise.resolve({
          data: [] as {
            address: string;
            username: string | null;
            pfp_url: string | null;
            email: string | null;
          }[],
        }),
    fetchBatchForfeitCommitmentState(onChainIds).catch(
      () => new Map<number, never>(),
    ),
    admin
      .from("forfeit_periods")
      .select("commitment_id, period_index, proof_url, verifier_action, resolved_at")
      .in("commitment_id", commitmentIds),
  ]);

  const profileByAddress = new Map(
    (profilesExact.data ?? []).map((p) => [p.address.toLowerCase(), p]),
  );

  // Fill case-mismatch misses (checksummed profile.address vs lowercased query).
  const missingProfileAddrs = otherWallets.filter((w) => !profileByAddress.has(w));
  if (missingProfileAddrs.length > 0) {
    await Promise.all(
      missingProfileAddrs.map(async (addr) => {
        const { data: row } = await admin
          .from("profiles")
          .select("address, username, pfp_url, email")
          .ilike("address", addr)
          .maybeSingle();
        if (row) profileByAddress.set(addr, row);
      }),
    );
  }

  const periodByCommitment = new Map<
    string,
    {
      period_index: number;
      proof_url: string | null;
      verifier_action: string | null;
      resolved_at: string | null;
    }[]
  >();
  for (const p of periodRowsResult.data ?? []) {
    const list = periodByCommitment.get(p.commitment_id) ?? [];
    list.push(p);
    periodByCommitment.set(p.commitment_id, list);
  }

  const items = await Promise.all(
    commitments.map(async (c) => {
      const chain =
        c.on_chain_commitment_id != null
          ? onChainState.get(c.on_chain_commitment_id)
          : undefined;

      const stakeAmount = c.stake_amount_wei || chain?.stakeAmount || null;
      const token = (c.token || chain?.token || null)?.toLowerCase() ?? null;
      const destinationType =
        c.destination_type != null
          ? Number(c.destination_type)
          : chain?.destinationType != null
            ? Number(chain.destinationType)
            : null;
      const destinationAddr = (
        c.destination_addr ||
        chain?.destinationAddr ||
        null
      )?.toLowerCase() ?? null;

      const periodIndex = chain?.currentPeriodIndex ?? 0;
      const periodList = periodByCommitment.get(c.id) ?? [];
      // Card only navigates past → current → +1 upcoming — don't ship every historical period.
      const periods = periodList
        .filter((p) => {
          const idx = Number(p.period_index);
          return (
            Boolean(p.proof_url) ||
            (idx >= Math.max(0, periodIndex - 1) && idx <= periodIndex + 1)
          );
        })
        .map((p) => ({
          periodIndex: Number(p.period_index),
          proofUrl: p.proof_url,
          verifierAction: p.verifier_action,
          resolvedAt: p.resolved_at,
        }));
      const currentPeriodRow = periodList.find(
        (p) => Number(p.period_index) === periodIndex,
      );
      const currentPeriod = currentPeriodRow
        ? {
            periodIndex: Number(currentPeriodRow.period_index),
            proofUrl: currentPeriodRow.proof_url,
            verifierAction: currentPeriodRow.verifier_action,
            resolvedAt: currentPeriodRow.resolved_at,
          }
        : null;

      // "Whose forfeit is this" for the card header: the creator for both the
      // verifier and destination roles — only my own "creator" role shows the
      // other side (the friend I tagged as my verifier).
      const otherWallet = role === "creator" ? c.verifier_wallet : c.creator_wallet;
      const otherProfile = otherWallet
        ? profileByAddress.get(otherWallet.toLowerCase())
        : undefined;
      let otherPartyUsername = otherProfile?.username?.trim() || null;
      if (!otherPartyUsername && otherWallet) {
        otherPartyUsername = await resolveUsernameForAddress(admin, otherWallet);
      }

      const destinationProfile = destinationAddr
        ? profileByAddress.get(destinationAddr)
        : undefined;
      let destinationFriendUsername =
        c.destination_friend_username ||
        destinationProfile?.username ||
        null;
      const destinationFriendEmail =
        c.destination_friend_email ||
        (destinationProfile?.email &&
        !destinationProfile.email.endsWith("@wallet.local")
          ? destinationProfile.email
          : null);

      // Friend stake destination with no snapshot/username yet — resolve now so
      // the card never shows a raw truncated address when a username exists.
      if (
        !destinationFriendUsername &&
        destinationType === 2 &&
        destinationAddr &&
        destinationAddr !== "0x0000000000000000000000000000000000000000"
      ) {
        destinationFriendUsername = await resolveUsernameForAddress(
          admin,
          destinationAddr,
        );
      }

      const onChain =
        stakeAmount && token
          ? {
              stakeAmount,
              token,
              destinationType: destinationType ?? undefined,
              destinationAddr,
              cadence: chain?.cadence ?? 0,
              periodSeconds: chain?.periodSeconds,
              totalPeriods: chain?.totalPeriods ?? 1,
              currentPeriodIndex: periodIndex,
              currentPeriodDeadline:
                chain?.currentPeriodDeadline ??
                String(Math.floor(Date.now() / 1000) + 86400),
              active: chain?.active ?? true,
              cancelled: chain?.cancelled ?? false,
              hasPendingVerifierInvite: chain?.hasPendingVerifierInvite,
            }
          : chain
            ? {
                stakeAmount: chain.stakeAmount,
                token: chain.token,
                destinationType: Number(chain.destinationType),
                destinationAddr:
                  chain.destinationAddr?.toLowerCase() ?? chain.destinationAddr,
                cadence: chain.cadence,
                periodSeconds: chain.periodSeconds,
                totalPeriods: chain.totalPeriods,
                currentPeriodIndex: chain.currentPeriodIndex,
                currentPeriodDeadline: chain.currentPeriodDeadline,
                active: chain.active,
                cancelled: chain.cancelled,
                hasPendingVerifierInvite: chain.hasPendingVerifierInvite,
              }
            : null;

      return {
        id: c.id,
        onChainCommitmentId: c.on_chain_commitment_id,
        title: c.title,
        description: null,
        evidenceType: c.evidence_type,
        verificationMethod: c.verification_method,
        creatorWallet: c.creator_wallet,
        verifierWallet: c.verifier_wallet,
        otherPartyUsername,
        otherPartyPfpUrl: otherProfile?.pfp_url ?? null,
        destinationFriendUsername,
        destinationFriendEmail,
        status: c.status,
        createdAt: c.created_at,
        isCharityIntent: Boolean(c.is_charity_intent),
        currentPeriod,
        periods,
        onChain,
      };
    }),
  );

  return NextResponse.json({ items });
}
