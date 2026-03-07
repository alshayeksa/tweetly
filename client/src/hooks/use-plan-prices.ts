import { useQuery } from "@tanstack/react-query";

export interface PlanPrice {
  sar: number;
  usd: number;
}

export type PlanPrices = Record<string, PlanPrice>;

const FALLBACK: PlanPrices = {
  starter: { sar: 55,  usd: 15 },
  creator: { sar: 109, usd: 29 },
  pro:     { sar: 259, usd: 69 },
};

export function usePlanPrices() {
  const { data, isLoading } = useQuery<PlanPrices>({
    queryKey: ["/api/plans/prices"],
    queryFn: async () => {
      const res = await fetch("/api/plans/prices");
      if (!res.ok) return FALLBACK;
      return res.json();
    },
    staleTime: 1000 * 60 * 2, // 2 minutes
  });

  return { prices: data ?? FALLBACK, isLoading };
}
