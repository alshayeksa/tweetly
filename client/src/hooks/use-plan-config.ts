import { useQuery } from "@tanstack/react-query";

export interface PlanConfig {
  key: string;
  label: string;
  tweetLimit: number;
  threadLimit: number;
  autopilot: boolean;
  advancedScheduling: boolean;
  aiWrite: boolean;
  aiRewrite: boolean;
  aiToneTraining: boolean;
  prioritySupport: boolean;
  usd: number;
  sar: number;
}

export type PlansConfig = Record<string, PlanConfig>;

const FALLBACK: PlansConfig = {
  free: {
    key: "free", label: "Free", tweetLimit: 30, threadLimit: 3,
    autopilot: false, advancedScheduling: false, aiWrite: true,
    aiRewrite: false, aiToneTraining: false, prioritySupport: false,
    usd: 0, sar: 0,
  },
  starter: {
    key: "starter", label: "Starter", tweetLimit: 300, threadLimit: 6,
    autopilot: false, advancedScheduling: false, aiWrite: true,
    aiRewrite: false, aiToneTraining: false, prioritySupport: false,
    usd: 15, sar: 55,
  },
  creator: {
    key: "creator", label: "Creator", tweetLimit: 600, threadLimit: 999,
    autopilot: false, advancedScheduling: true, aiWrite: true,
    aiRewrite: true, aiToneTraining: false, prioritySupport: false,
    usd: 29, sar: 109,
  },
  pro: {
    key: "pro", label: "Autopilot", tweetLimit: 1500, threadLimit: 999,
    autopilot: true, advancedScheduling: true, aiWrite: true,
    aiRewrite: true, aiToneTraining: true, prioritySupport: true,
    usd: 69, sar: 259,
  },
};

export function usePlanConfig() {
  const { data, isLoading } = useQuery<PlansConfig>({
    queryKey: ["/api/plans/config"],
    queryFn: async () => {
      const res = await fetch("/api/plans/config");
      if (!res.ok) return FALLBACK;
      return res.json();
    },
    staleTime: 1000 * 60 * 10, // 10 minutes
  });

  return { plans: data ?? FALLBACK, isLoading };
}
