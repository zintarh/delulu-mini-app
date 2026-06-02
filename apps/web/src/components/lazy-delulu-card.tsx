"use client";

import dynamic from "next/dynamic";
import { DeluluCardSkeleton } from "@/components/delulu-skeleton";
import type { ComponentProps } from "react";

const DeluluCardInner = dynamic(
  () => import("@/components/delulu-card").then((m) => m.DeluluCard),
  {
    loading: () => <DeluluCardSkeleton className="mb-0" />,
  },
);

export function LazyDeluluCard(props: ComponentProps<typeof DeluluCardInner>) {
  return <DeluluCardInner {...props} />;
}
