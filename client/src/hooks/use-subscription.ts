import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

interface SubscriptionInfo {
  status: string; // trial | active | canceled | past_due | none
  isActive: boolean;
  isTrial: boolean;
  isPaid: boolean;
  isFree: boolean;
  plan: string; // "free" | "starter" | "creator" | "autopilot"
  daysLeft: number | null;
  trialEndsAt: string | null;
  subscriptionEndsAt: string | null;
  // Free plan tweet usage
  tweetsUsed: number;
  tweetsRemaining: number | null;
  monthlyLimit: number | null;
}

export function useSubscription() {
  const { toast } = useToast();
  const { data, isLoading, refetch } = useQuery<SubscriptionInfo>({
    queryKey: ["/api/subscription"],
    queryFn: async () => {
      const res = await fetch("/api/subscription", { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
    staleTime: 1000 * 10, // 10 seconds
  });

  const checkoutMutation = useMutation({
    mutationFn: async (args?: string | { plan?: string; voucherCode?: string }) => {
      const plan        = typeof args === "string" ? args : (args?.plan ?? "starter");
      const voucherCode = typeof args === "string" ? undefined : args?.voucherCode;
      const res = await fetch("/api/subscription/checkout", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: plan ?? "starter", ...(voucherCode ? { voucherCode } : {}) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to create checkout");
      window.location.href = data.url;
    },
    onError: (err: Error) => {
      toast({ title: "Checkout failed", description: err.message, variant: "destructive" });
    },
  });

  // Paylink does not have a customer portal — users contact support to manage subscription
  const portalMutation = { mutate: () => window.location.href = "/settings", isPending: false };

  return {
    subscription: data,
    isLoading,
    isActive: data?.isActive ?? false,
    isTrial: data?.isTrial ?? false,
    isPaid: data?.isPaid ?? false,
    isFree: data?.isFree ?? true,
    plan: data?.plan ?? "free",
    daysLeft: data?.daysLeft ?? null,
    tweetsUsed: data?.tweetsUsed ?? 0,
    tweetsRemaining: data?.tweetsRemaining ?? null,
    monthlyLimit: data?.monthlyLimit ?? null,
    refetch,
    subscribe: checkoutMutation.mutate,
    isSubscribing: checkoutMutation.isPending,
    openPortal: portalMutation.mutate,
    isOpeningPortal: portalMutation.isPending,
  };
}
