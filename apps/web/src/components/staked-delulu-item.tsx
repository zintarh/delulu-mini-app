"use client";

import { FormattedDelulu } from "@/hooks/use-delulus";
import { useUserPosition } from "@/hooks/use-user-position";
import { ProfileDeluluItem } from "@/components/profile-delulu-item";

interface StakedDeluluItemProps {
  delulu: FormattedDelulu;
}

export function StakedDeluluItem({ delulu }: StakedDeluluItemProps) {
  const { hasStaked } = useUserPosition(delulu.id);

  if (!hasStaked) return null;

  return <ProfileDeluluItem delulu={delulu} isCreator={false} />;
}

