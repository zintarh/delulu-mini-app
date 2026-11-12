import type { SupabaseClient } from "@supabase/supabase-js";
import {
  fetchBatchForfeitCommitmentState,
  type ForfeitCommitmentOnChainState,
} from "@/lib/forfeit/forfeit-subgraph";
import { capitalizeFirst } from "@/lib/utils";
import {
  computeEndsAt,
  isSupportCategory,
  supportEligibility,
  weiToWhole,
  type SupportCategory,
  type SupportEligibility,
} from "@/lib/support/rules";

/** Columns needed to judge/present a Delulu publicly. Never the private description or proofs. */
export const SUPPORT_COMMITMENT_SELECT =
  "id, on_chain_commitment_id, creator_wallet, title, public_description, category, is_private, status, public_since, ends_at, support_total_wei::text, supporter_count, last_supported_at, created_at, confirmed_at";

export type SupportCommitmentRow = {
  id: string;
  on_chain_commitment_id: number | null;
  creator_wallet: string;
  title: string;
  public_description: string | null;
  category: string | null;
  is_private: boolean | null;
  status: string;
  public_since: string | null;
  ends_at: string | null;
  support_total_wei: string | number | null;
  supporter_count: number | null;
  last_supported_at: string | null;
  created_at: string;
  confirmed_at: string | null;
};

export type PublicProfile = { username: string | null; pfpUrl: string | null; hasPhoto?: boolean };

/**
 * Public avatar URL. Stored images sit under a wallet-address path, so public
 * responses point at the username-keyed proxy instead. No username → initials.
 */
function publicPfp(username: string | null, pfpUrl: string | null): string | null {
  if (!pfpUrl || !username) return null;
  return `/api/support/avatar/${encodeURIComponent(username)}`;
}

/** Username + avatar only — emails and wallets never leave the server. */
export async function loadPublicProfiles(
  admin: SupabaseClient,
  wallets: string[],
): Promise<Map<string, PublicProfile>> {
  const lower = [...new Set(wallets.map((w) => w.toLowerCase()))];
  const map = new Map<string, PublicProfile>();
  if (lower.length === 0) return map;
  const { data } = await admin.from("profiles").select("address, username, pfp_url").in("address", lower);
  for (const p of data ?? []) {
    map.set(String(p.address).toLowerCase(), {
      username: p.username ?? null,
      pfpUrl: publicPfp(p.username ?? null, p.pfp_url ?? null),
      hasPhoto: !!p.pfp_url,
    });
  }
  const missing = lower.filter((w) => !map.has(w));
  await Promise.all(
    missing.map(async (addr) => {
      const { data: row } = await admin
        .from("profiles")
        .select("address, username, pfp_url")
        .ilike("address", addr)
        .maybeSingle();
      if (row) {
        map.set(addr, {
          username: row.username ?? null,
          pfpUrl: publicPfp(row.username ?? null, row.pfp_url ?? null),
          hasPhoto: !!row.pfp_url,
        });
      }
    }),
  );
  return map;
}

export async function loadChainState(
  ids: number[],
): Promise<Map<number, ForfeitCommitmentOnChainState>> {
  return fetchBatchForfeitCommitmentState(ids).catch(() => new Map());
}

export function eligibilityFor(
  row: SupportCommitmentRow,
  chain: ForfeitCommitmentOnChainState | null | undefined,
  supporterWallet?: string | null,
): SupportEligibility {
  const endsAt = chain ? computeEndsAt(chain) : row.ends_at ? new Date(row.ends_at) : null;
  return supportEligibility({
    isPrivate: row.is_private,
    status: row.status,
    onChain: chain ?? null,
    endsAt,
    now: new Date(),
    creatorWallet: row.creator_wallet,
    supporterWallet,
  });
}

/** Kept period indexes per commitment (indexes only — proof images stay private). */
export async function loadKeptPeriods(
  admin: SupabaseClient,
  commitmentIds: string[],
): Promise<Map<string, Set<number>>> {
  const map = new Map<string, Set<number>>();
  if (commitmentIds.length === 0) return map;
  const { data } = await admin
    .from("forfeit_periods")
    .select("commitment_id, period_index, proof_url, verifier_action")
    .in("commitment_id", commitmentIds);
  for (const p of data ?? []) {
    if (!p.proof_url || p.verifier_action === "rejected" || p.verifier_action === "timed_out") continue;
    const set = map.get(p.commitment_id) ?? new Set<number>();
    set.add(Number(p.period_index));
    map.set(p.commitment_id, set);
  }
  return map;
}

/** Consecutive kept periods ending now (today not proven yet doesn't break it). */
export function streakFor(kept: Set<number> | undefined, currentIndex: number): number {
  if (!kept || kept.size === 0) return 0;
  let i = kept.has(currentIndex) ? currentIndex : currentIndex - 1;
  let n = 0;
  while (i >= 0 && kept.has(i)) {
    n++;
    i--;
  }
  return n;
}

/** Up to `per` most recent distinct supporters per commitment (avatars only). */
export async function loadSupporterFaces(
  admin: SupabaseClient,
  commitmentIds: string[],
  per = 3,
): Promise<Map<string, PublicProfile[]>> {
  const out = new Map<string, PublicProfile[]>();
  if (commitmentIds.length === 0) return out;
  const { data } = await admin
    .from("delulu_supports")
    .select("commitment_id, supporter_wallet")
    .in("commitment_id", commitmentIds)
    .eq("status", "confirmed")
    .order("confirmed_at", { ascending: false })
    .limit(Math.min(1000, commitmentIds.length * 30));
  const wallets = new Map<string, string[]>();
  for (const r of data ?? []) {
    const list = wallets.get(r.commitment_id) ?? [];
    const w = String(r.supporter_wallet).toLowerCase();
    if (list.length < per && !list.includes(w)) list.push(w);
    wallets.set(r.commitment_id, list);
  }
  const profiles = await loadPublicProfiles(admin, [...wallets.values()].flat());
  for (const [id, list] of wallets) {
    out.set(id, list.map((w) => profiles.get(w) ?? { username: null, pfpUrl: null }));
  }
  return out;
}

export type PublicDeluluDto = {
  id: number;
  title: string;
  description: string | null;
  category: SupportCategory | null;
  creator: PublicProfile;
  progress: { kept: number; total: number; currentDay: number; streak: number };
  cadence: "daily" | "weekly" | "once";
  startsAt: string;
  endsAt: string | null;
  support: { totalG: number; supporters: number; lastAt: string | null; faces: PublicProfile[] };
  accepting: boolean;
  isOwn: boolean;
};

export function toPublicDelulu(
  row: SupportCommitmentRow,
  opts: {
    profile: PublicProfile | undefined;
    chain: ForfeitCommitmentOnChainState | null | undefined;
    kept: Set<number> | undefined;
    faces?: PublicProfile[];
    viewer?: string | null;
  },
): PublicDeluluDto {
  const { chain } = opts;
  const total = Math.max(1, chain?.totalPeriods ?? 1);
  const endsAt = chain ? computeEndsAt(chain) : row.ends_at ? new Date(row.ends_at) : null;
  const periodSeconds = Number(chain?.periodSeconds ?? 0);
  const cadence = total <= 1 ? "once" : periodSeconds >= 6 * 86_400 ? "weekly" : "daily";
  const isOwn = !!opts.viewer && opts.viewer.toLowerCase() === row.creator_wallet.toLowerCase();
  const currentIndex = chain?.currentPeriodIndex ?? 0;
  return {
    id: Number(row.on_chain_commitment_id),
    title: capitalizeFirst(row.title ?? ""),
    description: row.public_description,
    category: isSupportCategory(row.category) ? row.category : null,
    // Creator photo keyed by the (public) goal, so it works without a username too.
    creator: {
      username: opts.profile?.username ?? null,
      pfpUrl: opts.profile?.hasPhoto ? `/api/support/avatar/~d${Number(row.on_chain_commitment_id)}` : null,
    },
    progress: {
      kept: Math.min(opts.kept?.size ?? 0, total),
      total,
      currentDay: Math.min(total, currentIndex + 1),
      streak: streakFor(opts.kept, currentIndex),
    },
    cadence,
    startsAt: row.confirmed_at ?? row.created_at,
    endsAt: endsAt ? endsAt.toISOString() : null,
    support: {
      totalG: weiToWhole(row.support_total_wei != null ? String(row.support_total_wei) : "0"),
      supporters: row.supporter_count ?? 0,
      lastAt: row.last_supported_at,
      faces: opts.faces ?? [],
    },
    // Without live chain state (RPC hiccup) trust the DB; the send path re-checks on-chain.
    accepting: chain
      ? eligibilityFor(row, chain).ok
      : row.is_private === false && row.status === "active" && (!endsAt || endsAt > new Date()),
    isOwn,
  };
}

/**
 * Rows → public DTOs with everything a card needs, in a handful of batched
 * queries. Drops anything the chain says is no longer live (DB status lags).
 */
export async function buildPublicDelulus(
  admin: SupabaseClient,
  rows: SupportCommitmentRow[],
  viewer: string | null,
): Promise<PublicDeluluDto[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => Number(r.on_chain_commitment_id));
  const [chain, profiles, kept, faces] = await Promise.all([
    loadChainState(ids),
    loadPublicProfiles(admin, rows.map((r) => r.creator_wallet)),
    loadKeptPeriods(admin, rows.map((r) => r.id)),
    loadSupporterFaces(admin, rows.map((r) => r.id)),
  ]);
  return rows
    .filter((r) => {
      const c = chain.get(Number(r.on_chain_commitment_id));
      return !c || eligibilityFor(r, c).ok;
    })
    .map((r) =>
      toPublicDelulu(r, {
        profile: profiles.get(r.creator_wallet.toLowerCase()),
        chain: chain.get(Number(r.on_chain_commitment_id)),
        kept: kept.get(r.id),
        faces: faces.get(r.id),
        viewer,
      }),
    );
}
