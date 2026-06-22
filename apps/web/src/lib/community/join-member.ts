import type { SupabaseClient } from "@supabase/supabase-js";

export type CommunityJoinVia = "invite_code" | "onboarding" | "admin_added";

export class CommunityJoinError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export async function lookupCommunityByInviteCode(
  admin: SupabaseClient,
  inviteCode: string,
) {
  const code = inviteCode.trim().toUpperCase();
  const { data: community, error } = await admin
    .from("communities")
    .select("id, name, slug, status")
    .eq("member_invite_code", code)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!community) return null;
  return community;
}

/** Upsert member; first joined_via wins (do not overwrite on re-join). */
export async function upsertCommunityMember(
  admin: SupabaseClient,
  params: {
    communityId: string;
    walletAddress: string;
    joinedVia: CommunityJoinVia;
  },
) {
  const wallet = params.walletAddress.trim().toLowerCase();

  const { data: existing } = await admin
    .from("community_members")
    .select("id, joined_via, status")
    .eq("community_id", params.communityId)
    .eq("wallet_address", wallet)
    .maybeSingle();

  if (existing?.status === "banned") {
    throw new CommunityJoinError("You are not allowed to join this community.", 403);
  }

  const payload: Record<string, unknown> = {
    community_id: params.communityId,
    wallet_address: wallet,
    status: "active",
  };

  if (!existing?.joined_via) {
    payload.joined_via = params.joinedVia;
  }

  const { error } = await admin.from("community_members").upsert(payload, {
    onConflict: "community_id,wallet_address",
  });

  if (error) throw new Error(error.message);
}

async function incrementDailyClaimRpc(
  admin: SupabaseClient,
  communityId: string,
  wallet: string,
  claimDate: string,
): Promise<boolean> {
  const { error } = await admin.rpc("increment_community_daily_claim", {
    p_community_id: communityId,
    p_wallet: wallet,
    p_claim_date: claimDate,
  });
  return !error;
}

async function incrementDailyClaimFallback(
  admin: SupabaseClient,
  member: { id: string; community_id: string; gd_claim_count: number | null; gd_first_claimed_at: string | null },
  wallet: string,
  claimDate: string,
  nowIso: string,
) {
  const { data: existingDaily, error: selectError } = await admin
    .from("community_member_daily_claims")
    .select("id, claim_count")
    .eq("community_id", member.community_id)
    .eq("wallet_address", wallet)
    .eq("claim_date", claimDate)
    .maybeSingle();

  if (selectError) throw new Error(selectError.message);

  if (existingDaily) {
    const { error: updateDailyError } = await admin
      .from("community_member_daily_claims")
      .update({ claim_count: (existingDaily.claim_count ?? 0) + 1 })
      .eq("id", existingDaily.id);
    if (updateDailyError) throw new Error(updateDailyError.message);
  } else {
    const { error: insertError } = await admin.from("community_member_daily_claims").insert({
      community_id: member.community_id,
      wallet_address: wallet,
      claim_date: claimDate,
      claim_count: 1,
    });
    if (insertError) {
      if (insertError.code === "23505") {
        const { data: retryDaily } = await admin
          .from("community_member_daily_claims")
          .select("id, claim_count")
          .eq("community_id", member.community_id)
          .eq("wallet_address", wallet)
          .eq("claim_date", claimDate)
          .maybeSingle();
        if (retryDaily) {
          const { error: retryUpdateError } = await admin
            .from("community_member_daily_claims")
            .update({ claim_count: (retryDaily.claim_count ?? 0) + 1 })
            .eq("id", retryDaily.id);
          if (retryUpdateError) throw new Error(retryUpdateError.message);
        }
      } else {
        throw new Error(insertError.message);
      }
    }
  }

  const { error: memberUpdateError } = await admin
    .from("community_members")
    .update({
      gd_claim_count: (member.gd_claim_count ?? 0) + 1,
      gd_first_claimed_at: member.gd_first_claimed_at ?? nowIso,
    })
    .eq("id", member.id);

  if (memberUpdateError) throw new Error(memberUpdateError.message);
}

export async function logCommunityMemberDailyClaim(
  admin: SupabaseClient,
  walletAddress: string,
) {
  const wallet = walletAddress.trim().toLowerCase();
  const claimDate = new Date().toISOString().slice(0, 10);

  const { data: memberships, error: memberError } = await admin
    .from("community_members")
    .select("id, community_id, gd_claim_count, gd_first_claimed_at")
    .eq("wallet_address", wallet)
    .eq("status", "active");

  if (memberError) throw new Error(memberError.message);
  if (!memberships?.length) return;

  const nowIso = new Date().toISOString();

  for (const member of memberships) {
    const usedRpc = await incrementDailyClaimRpc(admin, member.community_id, wallet, claimDate);
    if (!usedRpc) {
      await incrementDailyClaimFallback(admin, member, wallet, claimDate, nowIso);
    }
  }
}
