"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Building2, Plus, Users, Loader2 } from "lucide-react";
import {
  DashboardPage,
  DashboardPageHeader,
  DashboardCardGrid,
  DashboardCard,
  DashboardCardAvatar,
  DashboardEmpty,
  DashboardPrimaryButton,
  StatusChip,
  useDashboardToast,
} from "@/components/dashboard/dashboard-ui";
import { CreateCommunityModal } from "@/components/dashboard/create-community-modal";
import {
  useDashboardCommunities,
  type DashboardCommunity,
} from "@/hooks/dashboard/use-dashboard-communities";

export type CommunityRow = DashboardCommunity;

export function CommunitiesPageClient({
  communities: initialCommunities,
  isPlatformAdmin,
}: {
  communities: DashboardCommunity[];
  isPlatformAdmin: boolean;
}) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const { show } = useDashboardToast();
  const { data: communities = initialCommunities, isLoading, isFetching } =
    useDashboardCommunities(initialCommunities);

  useEffect(() => {
    if (searchParams.get("new") === "1" && isPlatformAdmin) {
      setCreateOpen(true);
      router.replace("/dashboard/communities", { scroll: false });
    }
  }, [searchParams, isPlatformAdmin, router]);

  const handleCreated = (community: DashboardCommunity) => {
    show(`${community.name} created`);
    router.push(`/dashboard/communities/${community.id}`);
  };

  return (
    <DashboardPage>
      <DashboardPageHeader
        title="Communities"
        action={
          isPlatformAdmin ? (
            <DashboardPrimaryButton onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" />
              New
            </DashboardPrimaryButton>
          ) : undefined
        }
      />

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
        </div>
      ) : communities.length === 0 ? (
        <DashboardEmpty
          icon={Building2}
          title="No communities yet"
          action={
            isPlatformAdmin ? (
              <DashboardPrimaryButton onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4" />
                New community
              </DashboardPrimaryButton>
            ) : undefined
          }
        />
      ) : (
        <DashboardCardGrid className={isFetching && !isLoading ? "opacity-80" : undefined}>
          {communities.map((c) => (
            <DashboardCard key={c.id} href={`/dashboard/communities/${c.id}`}>
              <div className="flex items-start justify-between gap-2 mb-3">
                <DashboardCardAvatar label={c.name} />
                <StatusChip status={c.status} />
              </div>
              <h3 className="font-semibold text-foreground line-clamp-1">{c.name}</h3>
              <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Users className="h-3.5 w-3.5" />
                <span>{c.member_count}</span>
              </div>
            </DashboardCard>
          ))}
        </DashboardCardGrid>
      )}

      {isPlatformAdmin ? (
        <CreateCommunityModal
          open={createOpen}
          onOpenChange={setCreateOpen}
          onSuccess={handleCreated}
        />
      ) : null}
    </DashboardPage>
  );
}
