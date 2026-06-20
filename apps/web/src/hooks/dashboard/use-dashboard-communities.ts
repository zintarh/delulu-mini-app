"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export type DashboardCommunity = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  member_invite_code: string;
  status: string;
  created_at: string;
  member_count: number;
};

export const dashboardCommunityKeys = {
  all: ["dashboard", "communities"] as const,
  list: () => [...dashboardCommunityKeys.all, "list"] as const,
  detail: (id: string) => [...dashboardCommunityKeys.all, "detail", id] as const,
};

function normalizeCommunity(
  row: Partial<DashboardCommunity> & Pick<DashboardCommunity, "id" | "name">,
): DashboardCommunity {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug ?? "",
    description: row.description ?? null,
    member_invite_code: row.member_invite_code ?? "",
    status: row.status ?? "active",
    created_at: row.created_at ?? new Date().toISOString(),
    member_count: row.member_count ?? 0,
  };
}

async function fetchCommunities(): Promise<DashboardCommunity[]> {
  const res = await fetch("/api/dashboard/communities");
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json?.error ?? "Failed to load communities");
  }
  return (json.communities ?? []).map((c: DashboardCommunity) => normalizeCommunity(c));
}

export function useDashboardCommunities(initialData?: DashboardCommunity[]) {
  return useQuery({
    queryKey: dashboardCommunityKeys.list(),
    queryFn: fetchCommunities,
    initialData,
    staleTime: 30_000,
  });
}

export function useCreateCommunity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { name: string; description?: string }) => {
      const res = await fetch("/api/dashboard/communities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: input.name.trim(),
          description: input.description?.trim() ?? "",
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error ?? "Failed to create community");
      }
      return normalizeCommunity(json.community);
    },
    onSuccess: (community) => {
      queryClient.setQueryData<DashboardCommunity[]>(
        dashboardCommunityKeys.list(),
        (current) => {
          const next = community;
          if (!current?.length) return [next];
          if (current.some((c) => c.id === next.id)) return current;
          return [next, ...current];
        },
      );
      void queryClient.invalidateQueries({ queryKey: dashboardCommunityKeys.list() });
    },
  });
}

export function useInviteSubAdmin(communityId: string) {
  return useMutation({
    mutationFn: async (email: string) => {
      const res = await fetch(`/api/dashboard/communities/${communityId}/invites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error ?? "Failed to send invite");
      }
      return email.trim();
    },
  });
}
