import {
  draftMilestonesToChainArgs,
  type DraftMilestoneRow,
} from "@/lib/community/draft-milestones-to-chain";
import { waitForGraphMilestoneCount } from "@/lib/community/campaign-subgraph";

export async function fetchDraftMilestones(campaignId: string): Promise<DraftMilestoneRow[]> {
  const res = await fetch(`/api/dashboard/campaigns/${campaignId}/milestones`);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((json as { error?: string }).error ?? "Failed to load milestones");
  }
  const rows = (json as { milestones?: DraftMilestoneRow[] }).milestones ?? [];
  return rows.map((m) => ({
    title: m.title,
    duration_days: Number(m.duration_days) || 1,
    order_index: m.order_index,
  }));
}

export async function publishDraftMilestonesOnChain(input: {
  campaignId: string;
  challengeId: number;
  durationDays: number;
  addOnChain: (args: {
    challengeId: number | bigint;
    mURIs: string[];
    mDurations: bigint[];
  }) => Promise<`0x${string}` | string>;
  draftRows?: DraftMilestoneRow[];
}): Promise<void> {
  const rows = input.draftRows ?? (await fetchDraftMilestones(input.campaignId));
  const { mURIs, mDurations } = draftMilestonesToChainArgs(rows, input.durationDays);

  const txHash = await input.addOnChain({
    challengeId: input.challengeId,
    mURIs,
    mDurations,
  });

  const res = await fetch(`/api/dashboard/campaigns/${input.campaignId}/confirm-milestones`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ txHash }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((json as { error?: string }).error ?? "Failed to confirm milestones");
  }

  await waitForGraphMilestoneCount(input.challengeId, 1);
}
