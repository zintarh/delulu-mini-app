"use client";

import dynamic from "next/dynamic";
import { SocialFeedCardSkeleton } from "@/components/delulu-skeleton";
import type { ComponentProps } from "react";

const ExplorePinCardInner = dynamic(
  () => import("@/components/explore-pin-card").then((m) => m.ExplorePinCard),
  {
    loading: () => <SocialFeedCardSkeleton />,
  },
);

export function LazyExplorePinCard(
  props: ComponentProps<typeof ExplorePinCardInner>,
) {
  return <ExplorePinCardInner {...props} />;
}
