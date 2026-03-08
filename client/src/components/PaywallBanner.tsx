import { AlertCircle, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import { useSubscription } from "@/hooks/use-subscription";
import { Link } from "wouter";

export function PaywallBanner() {
  const { subscription, isLoading } = useSubscription();
  const { t } = useTranslation();

  if (isLoading || !subscription) return null;

  // Free plan users are never "expired" — skip all paywall banners for them.
  if (subscription.isFree) return null;

  // Subscription expired
  if (!subscription.isActive) {
    return (
      <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 flex items-start gap-2.5 mx-2 mb-2">
        <Zap className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-rose-800">{t("paywall.trialEnded")}</p>
          <p className="text-xs text-rose-600">{t("paywall.keepAccess")}</p>
          <Link href="/pricing">
            <Button size="sm" className="mt-1.5 h-6 text-xs w-full bg-rose-600 hover:bg-rose-700">
              Upgrade Now
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return null;
}
