"use client";

import { useMemo, useEffect, useState, useCallback } from "react";
import { gql } from "@apollo/client";
import { useQuery, useApolloClient } from "@apollo/client/react";
import {
  transformSubgraphDelulu,
  timestampToDate,
  type SubgraphDeluluRaw,
} from "@/lib/graph/transformers";
import {
  batchResolveIPFS,
  getCachedContent,
} from "@/lib/graph/ipfs-cache";
import type { FormattedDelulu } from "@/lib/types";
import {
  isDeluluResolutionActiveOnFeed,
  isDeluluResolutionEndedOnFeed,
} from "@/lib/delulu-feed-status";

/** Enriched row for admin Active tab (full snapshot, not user-intersection). */
export type EmailDeluluDebugRow = {
  id: string;
  creatorAddress: string;
  contentHash: string;
  resolutionDeadline: string;
  milestoneCount?: string;
  /** Same rule as `DeluluCard` / `delulu-feed-status`. */
  cardActive: boolean;
  goal: string;
};

const ADMIN_DELULUS_LIMIT = 400;
const PENDING_MILESTONES_LIMIT = 200;

const GET_ADMIN_DELULUS = gql`
  query GetAdminDelulus($first: Int!) {
    delulus(
      first: $first
      orderBy: createdAt
      orderDirection: desc
      where: { isCancelled: false }
    ) {
      id
      onChainId
      token
      creator {
        id
        username
      }
      creatorAddress
      contentHash
      stakingDeadline
      resolutionDeadline
      createdAt
      creatorStake
      totalSupportCollected
      totalSupporters
      challengeId
      isResolved
      isCancelled
    }
  }
`;

const GET_PENDING_MILESTONES = gql`
  query GetPendingMilestones($first: Int!) {
    milestones(
      first: $first
      orderBy: id
      orderDirection: desc
      where: {
        isSubmitted: true
        isVerified: false
        isDeleted: false
      }
    ) {
      id
      milestoneId
      milestoneURI
      proofLink
      deadline
      submittedAt
      delulu {
        id
        onChainId
        contentHash
        creator {
          id
          username
        }
      }
    }
  }
`;

export type PendingMilestoneRow = {
  id: string;
  milestoneId: string;
  milestoneURI: string | null;
  proofLink: string | null;
  deadline: Date;
  submittedAt: Date | null;
  delulu: {
    id: string;
    onChainId: string;
    contentHash: string;
    creator: { id: string; username?: string | null };
  };
};

export function useAdminDelulus() {
  const [ipfsTick, setIpfsTick] = useState(0);
  const { data, loading, error, refetch } = useQuery<{
    delulus: SubgraphDeluluRaw[];
  }>(GET_ADMIN_DELULUS, {
    variables: { first: ADMIN_DELULUS_LIMIT },
    fetchPolicy: "cache-and-network",
  });

  const rows = data?.delulus ?? [];

  useEffect(() => {
    if (rows.length === 0) return;
    const hashes = rows.map((d) => d.contentHash);
    batchResolveIPFS(hashes).finally(() => setIpfsTick((t) => t + 1));
  }, [rows]);

  const delulus = useMemo<FormattedDelulu[]>(() => {
    if (rows.length === 0) return [];
    return rows
      .map((d) => {
        try {
          const cached = getCachedContent(d.contentHash);
          return transformSubgraphDelulu(d, cached);
        } catch {
          return null;
        }
      })
      .filter((d): d is FormattedDelulu => d !== null);
  }, [rows, ipfsTick]);

  return {
    delulus,
    isLoading: loading && rows.length === 0,
    error: error ?? null,
    refetch,
  };
}

const GET_ALL_MILESTONE_DELULU_IDS = gql`
  query GetAllMilestoneDeluluIds($first: Int!) {
    milestones(first: $first) {
      id
      delulu {
        id
        onChainId
      }
    }
  }
`;

export function useDelulusWithoutMilestones(allDelulus: FormattedDelulu[]) {
  const { data, loading } = useQuery<{
    milestones: Array<{ delulu: { onChainId: string } }>;
  }>(GET_ALL_MILESTONE_DELULU_IDS, {
    variables: { first: 1000 },
    fetchPolicy: "cache-and-network",
  });

  const idsWithMilestones = useMemo(() => {
    const s = new Set<string>();
    for (const m of data?.milestones ?? []) {
      if (m.delulu?.onChainId) s.add(String(m.delulu.onChainId));
    }
    return s;
  }, [data]);

  const delulusWithoutMilestones = useMemo(() => {
    if (loading && !data) return [];
    const nowMs = Date.now();
    return allDelulus.filter((d) => {
      if (d.isCancelled) return false;
      if (!isDeluluResolutionActiveOnFeed(d.resolutionDeadline, nowMs)) return false;
      const id = d.onChainId ?? String(d.id);
      return !idsWithMilestones.has(id);
    });
  }, [allDelulus, idsWithMilestones, loading, data]);

  return { delulusWithoutMilestones, isLoading: loading && !data };
}

/* ── Email filters: paginated subgraph snapshot (`isCancelled: false` only — no `milestoneCount_gt`
    so delulus still appear if subgraph count lags v3 `MilestoneCreatedDetailed`). Partition uses
    DeluluCard deadline rules in JS. ── */

const EMAIL_SNAPSHOT_CHUNK = 1000;
/** Upper bound on how many delulus we scan (25 × 1000). Stops early when a chunk is short. */
const EMAIL_SNAPSHOT_MAX = 25_000;

const ENDING_SOON_WINDOW_SEC = 7 * 24 * 60 * 60;

const GET_DELULUS_EMAIL_SNAPSHOT = gql`
  query GetDelulusEmailSnapshot($first: Int!, $skip: Int!) {
    delulus(
      first: $first
      skip: $skip
      orderBy: createdAt
      orderDirection: desc
      where: { isCancelled: false }
    ) {
      id
      creatorAddress
      contentHash
      resolutionDeadline
      milestoneCount
    }
  }
`;

type EmailDeluluSnapshotRow = {
  id: string;
  creatorAddress: string;
  contentHash: string;
  resolutionDeadline: string;
  milestoneCount?: string;
};

export function useEmailFilterData() {
  const client = useApolloClient();
  const [ipfsTick, setIpfsTick] = useState(0);
  const [snapshotRows, setSnapshotRows] = useState<EmailDeluluSnapshotRow[]>([]);
  const [loadingSnapshot, setLoadingSnapshot] = useState(true);

  const [nowSec, setNowSec] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    setNowSec(Math.floor(Date.now() / 1000));
    const id = setInterval(() => setNowSec(Math.floor(Date.now() / 1000)), 60_000);
    return () => clearInterval(id);
  }, []);

  const loadEmailSnapshot = useCallback(async () => {
    setLoadingSnapshot(true);
    const merged: EmailDeluluSnapshotRow[] = [];
    const seenId = new Set<string>();
    try {
      for (let skip = 0; skip < EMAIL_SNAPSHOT_MAX; skip += EMAIL_SNAPSHOT_CHUNK) {
        const { data, error } = await client.query<{
          delulus: EmailDeluluSnapshotRow[];
        }>({
          query: GET_DELULUS_EMAIL_SNAPSHOT,
          variables: { first: EMAIL_SNAPSHOT_CHUNK, skip },
          fetchPolicy: "network-only",
        });
        if (error) throw error;
        const batch = data?.delulus ?? [];
        for (const row of batch) {
          if (seenId.has(row.id)) continue;
          seenId.add(row.id);
          merged.push(row);
        }
        if (batch.length < EMAIL_SNAPSHOT_CHUNK) break;
      }
      setSnapshotRows(merged);
    } catch {
      setSnapshotRows(merged.length > 0 ? merged : []);
    } finally {
      setLoadingSnapshot(false);
    }
  }, [client]);

  useEffect(() => {
    void loadEmailSnapshot();
  }, [loadEmailSnapshot]);
  const nowMs = nowSec * 1000;
  const cutoffMs = nowSec * 1000 + ENDING_SOON_WINDOW_SEC * 1000;

  const { activeRows, endedRows, soonRows } = useMemo(() => {
    const active: EmailDeluluSnapshotRow[] = [];
    const ended: EmailDeluluSnapshotRow[] = [];
    const soon: EmailDeluluSnapshotRow[] = [];
    for (const d of snapshotRows) {
      const rd = timestampToDate(d.resolutionDeadline);
      if (isDeluluResolutionEndedOnFeed(rd, nowMs)) {
        ended.push(d);
        continue;
      }
      active.push(d);
      const rms = rd.getTime();
      if (rms > 0 && rms > nowMs && rms <= cutoffMs) {
        soon.push(d);
      }
    }
    active.sort(
      (a, b) =>
        timestampToDate(a.resolutionDeadline).getTime() -
        timestampToDate(b.resolutionDeadline).getTime(),
    );
    ended.sort(
      (a, b) =>
        timestampToDate(b.resolutionDeadline).getTime() -
        timestampToDate(a.resolutionDeadline).getTime(),
    );
    soon.sort(
      (a, b) =>
        timestampToDate(a.resolutionDeadline).getTime() -
        timestampToDate(b.resolutionDeadline).getTime(),
    );
    return { activeRows: active, endedRows: ended, soonRows: soon };
  }, [snapshotRows, nowMs, cutoffMs]);

  useEffect(() => {
    const hashes = snapshotRows.map((d) => d.contentHash).filter(Boolean);
    if (hashes.length === 0) return;
    const MAX_HASHES = 3000;
    batchResolveIPFS(hashes.length > MAX_HASHES ? hashes.slice(0, MAX_HASHES) : hashes).finally(
      () => setIpfsTick((t) => t + 1),
    );
  }, [snapshotRows]);

  const activeTabDeluluRows = useMemo<EmailDeluluDebugRow[]>(() => {
    return snapshotRows
      .map((d) => {
        const rd = timestampToDate(d.resolutionDeadline);
        const cached = getCachedContent(d.contentHash);
        return {
          id: d.id,
          creatorAddress: d.creatorAddress,
          contentHash: d.contentHash,
          resolutionDeadline: d.resolutionDeadline,
          milestoneCount: d.milestoneCount,
          cardActive: isDeluluResolutionActiveOnFeed(rd, nowMs),
          goal: cached?.text ?? "",
        };
      })
      .sort((a, b) => {
        const na = Number(a.id);
        const nb = Number(b.id);
        if (Number.isFinite(na) && Number.isFinite(nb) && na !== nb) return nb - na;
        return String(b.id).localeCompare(String(a.id), undefined, { numeric: true });
      });
  }, [snapshotRows, nowMs, ipfsTick]);

  /** Same as DeluluCard “ended”: `!cardActive` ⇔ `isDeluluResolutionEndedOnFeed`. */
  const endedTabDeluluRows = useMemo<EmailDeluluDebugRow[]>(() => {
    return activeTabDeluluRows
      .filter((r) => !r.cardActive)
      .sort((a, b) => {
        const ta = timestampToDate(a.resolutionDeadline).getTime();
        const tb = timestampToDate(b.resolutionDeadline).getTime();
        if (tb !== ta) return tb - ta;
        const na = Number(a.id);
        const nb = Number(b.id);
        if (Number.isFinite(na) && Number.isFinite(nb) && na !== nb) return nb - na;
        return String(b.id).localeCompare(String(a.id), undefined, { numeric: true });
      });
  }, [activeTabDeluluRows]);

  // Sets used for filter membership checks
  const activeDeluluAddresses = useMemo(
    () => new Set(activeRows.map((d) => d.creatorAddress.toLowerCase()).filter(Boolean)),
    [activeRows],
  );

  const endedDeluluAddresses = useMemo(
    () =>
      new Set(endedTabDeluluRows.map((d) => d.creatorAddress.toLowerCase()).filter(Boolean)),
    [endedTabDeluluRows],
  );

  const endingSoonAddresses = useMemo(
    () => new Set(soonRows.map((d) => d.creatorAddress.toLowerCase()).filter(Boolean)),
    [soonRows],
  );

  // Per-address metadata for table display (first/soonest entry per creator wins)
  const activeDeluluMeta = useMemo(() => {
    const map = new Map<string, { goal: string; deadline: Date }>();
    for (const d of activeRows) {
      const addr = d.creatorAddress.toLowerCase();
      if (map.has(addr)) continue;
      const cached = getCachedContent(d.contentHash);
      map.set(addr, {
        goal: cached?.text ?? "",
        deadline: timestampToDate(d.resolutionDeadline),
      });
    }
    return map;
  }, [activeRows, ipfsTick]);

  const endedDeluluMeta = useMemo(() => {
    const map = new Map<string, { goal: string; deadline: Date }>();
    for (const d of endedTabDeluluRows) {
      const addr = d.creatorAddress.toLowerCase();
      if (map.has(addr)) continue;
      map.set(addr, {
        goal: d.goal,
        deadline: timestampToDate(d.resolutionDeadline),
      });
    }
    return map;
  }, [endedTabDeluluRows]);

  const endingSoonMeta = useMemo(() => {
    const map = new Map<string, { goal: string; deadline: Date }>();
    for (const d of soonRows) {
      const addr = d.creatorAddress.toLowerCase();
      if (map.has(addr)) continue;
      const cached = getCachedContent(d.contentHash);
      map.set(addr, {
        goal: cached?.text ?? "",
        deadline: timestampToDate(d.resolutionDeadline),
      });
    }
    return map;
  }, [soonRows, ipfsTick]);

  return {
    activeDeluluAddresses,
    /** Creators with at least one delulu whose resolution deadline is in the past. */
    endedDeluluAddresses,
    endingSoonAddresses,
    activeDeluluMeta,
    endedDeluluMeta,
    endingSoonMeta,
    /** Full loaded snapshot with Card active Yes/No (every non-cancelled delulu). */
    activeTabDeluluRows,
    /** Card-ended delulus (inverse of “Card active” on the feed card). */
    endedTabDeluluRows,
    isLoading: loadingSnapshot,
    refetchEmailSnapshot: loadEmailSnapshot,
  };
}

export function usePendingMilestones() {
  const { data, loading, error, refetch } = useQuery<{
    milestones: Array<{
      id: string;
      milestoneId: string;
      milestoneURI?: string | null;
      proofLink?: string | null;
      deadline: string;
      submittedAt?: string | null;
      delulu: PendingMilestoneRow["delulu"];
    }>;
  }>(GET_PENDING_MILESTONES, {
    variables: { first: PENDING_MILESTONES_LIMIT },
    fetchPolicy: "cache-and-network",
  });

  const milestones = useMemo<PendingMilestoneRow[]>(() => {
    const raw = data?.milestones ?? [];
    return raw.map((m) => ({
      id: m.id,
      milestoneId: m.milestoneId,
      milestoneURI: m.milestoneURI ?? null,
      proofLink: m.proofLink ?? null,
      deadline: timestampToDate(m.deadline),
      submittedAt: m.submittedAt ? timestampToDate(m.submittedAt) : null,
      delulu: m.delulu,
    }));
  }, [data?.milestones]);

  return {
    milestones,
    isLoading: loading && !data?.milestones,
    error: error ?? null,
    refetch,
  };
}
