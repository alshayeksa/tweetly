import { Link } from "wouter";
import { useSubscription } from "@/hooks/use-subscription";
import { useTranslation } from "react-i18next";

/**
 * Shows a contextual upgrade banner for free plan users based on how many
 * tweets they've used this month.
 *
 * Milestones (relative to monthlyLimit):
 *   ≥ 50%  of limit  → "Halfway there" info banner
 *   ≥ 80%  of limit  → "Almost out" warning banner
 *   ≥ 100% of limit  → hidden here (blocked at publish level)
 */
export function TweetLimitBanner() {
  const { isFree, tweetsUsed, monthlyLimit, isLoading } = useSubscription();
  const { i18n } = useTranslation();
  const isAr = i18n.language === "ar";

  if (isLoading || !isFree || monthlyLimit === null) return null;

  const limit = monthlyLimit;
  const used = tweetsUsed;
  const pct = limit > 0 ? (used / limit) * 100 : 0;

  // Don't show below 50% or when fully exhausted (blocked at publish level)
  if (pct < 50 || used >= limit) return null;

  const isWarning = pct >= 80;

  return (
    <div
      dir={isAr ? "rtl" : "ltr"}
      className={`border rounded-xl p-3 flex items-center gap-3 mx-2 mb-3 ${
        isWarning
          ? "bg-amber-950/40 border-amber-500/30"
          : "bg-blue-950/40 border-blue-500/30"
      }`}
    >
      <span className="text-lg flex-shrink-0">{isWarning ? "⚠️" : "🚀"}</span>
      <p className={`text-xs flex-1 min-w-0 ${isWarning ? "text-amber-300" : "text-blue-300"}`}>
        {isWarning
          ? isAr
            ? `تحذير: استخدمت ${used} من ${limit} تغريدة هذا الشهر — اقتربت من الحد!`
            : `Heads up — ${used}/${limit} tweets used this month. Almost at your limit!`
          : isAr
            ? `لقد استخدمت ${used} من ${limit} تغريدة هذا الشهر — في منتصف الطريق!`
            : `You're halfway to your monthly limit — ${used}/${limit} tweets used.`
        }
        {" "}
        <Link href="/pricing" className="underline font-semibold hover:opacity-80">
          {isAr ? "ترقية للنمو اللامحدود" : "Unlock unlimited growth"}
        </Link>
      </p>
    </div>
  );
}
