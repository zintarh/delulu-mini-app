import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";

export function useDeluluStakes(deluluId: string | null) {
  return useQuery({
    queryKey: ["delulu-stakes", deluluId],
    queryFn: async () => {
      if (!deluluId) return [];
      return api.getDeluluStakes(deluluId);
    },
    enabled: !!deluluId,
    staleTime: 30 * 1000,
  });
}
