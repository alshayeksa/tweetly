import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import { useSubscription } from "@/hooks/use-subscription";

export function TrialExpiredModal() {
  const { t, i18n } = useTranslation();
  const { subscription } = useSubscription();
  const isAr = i18n.language === "ar";

  // Only show modal if trial has actually expired.
  // Free plan users are NOT expired — they have an ongoing free plan.
  if (
    !subscription ||
    subscription.isFree ||
    subscription.isTrial ||
    subscription.isPaid ||
    subscription.status === "active"
  ) {
    return null;
  }

  // Respect "Maybe Later" dismissal
  if (typeof window !== "undefined" && sessionStorage.getItem("dismissTrialExpired") === "true") {
    return null;
  }

  const handleUpgrade = () => {
    window.location.href = "/pricing";
  };

  const handleLater = () => {
    // Close modal - user can dismiss it
    sessionStorage.setItem("dismissTrialExpired", "true");
    window.location.href = "/";
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" dir={isAr ? "rtl" : "ltr"}>
      <div className="bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 rounded-3xl p-8 max-w-md w-full shadow-2xl">
        {/* Icon */}
        <div className="text-6xl text-center mb-6">🚀</div>

        {/* Title */}
        <h2 className={`text-3xl font-black text-white text-center mb-4 ${isAr ? 'text-arabic-heading' : ''}`}>
          {isAr ? "لقد أبدعت اليوم!" : "You Did Amazing!"}
        </h2>

        {/* Description */}
        <p className={`text-gray-300 text-center mb-8 leading-relaxed ${isAr ? 'text-arabic-body' : ''}`}>
          {isAr
            ? "وصلت إلى نهاية الخطة المجانية. هل تريد الاستمرار في بناء جمهورك دون توقف؟"
            : "You've reached the end of your free trial. Ready to keep growing without limits?"}
        </p>

        {/* Features List */}
        <ul className="space-y-3 mb-8">
          <li className={`flex items-center gap-3 text-gray-200 ${isAr ? 'flex-row-reverse text-right' : ''}`}>
            <span className="text-lg">✅</span>
            <span className={isAr ? 'text-arabic-body' : ''}>{isAr ? "تغريدات غير محدودة" : "Unlimited tweets"}</span>
          </li>
          <li className={`flex items-center gap-3 text-gray-200 ${isAr ? 'flex-row-reverse text-right' : ''}`}>
            <span className="text-lg">✅</span>
            <span className={isAr ? 'text-arabic-body' : ''}>{isAr ? "جدولة ذكية" : "Smart scheduling"}</span>
          </li>
          <li className={`flex items-center gap-3 text-gray-200 ${isAr ? 'flex-row-reverse text-right' : ''}`}>
            <span className="text-lg">✅</span>
            <span className={isAr ? 'text-arabic-body' : ''}>{isAr ? "تحليلات متقدمة" : "Advanced analytics"}</span>
          </li>
        </ul>

        {/* Action Buttons */}
        <div className="space-y-3">
          <Button
            onClick={handleUpgrade}
            className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold py-3 rounded-xl transition-all"
          >
            {isAr ? "ترقية إلى Pro الآن ←" : "Upgrade to Pro Now →"}
          </Button>
          <button
            onClick={handleLater}
            className={`w-full bg-transparent text-gray-400 hover:text-gray-200 font-semibold py-3 rounded-xl transition-colors border border-gray-700 hover:border-gray-600 ${isAr ? 'text-arabic-body' : ''}`}
          >
            {isAr ? "ربما لاحقاً" : "Maybe Later"}
          </button>
        </div>

        {/* Bottom Text */}
        <p className={`text-xs text-gray-500 text-center mt-6 ${isAr ? 'text-arabic-body' : ''}`}>
          {isAr 
            ? "الدفع آمن عبر Paddle • إلغاء التجديد في أي وقت"
            : "Secure payments via Paddle • Cancel anytime"}
        </p>
      </div>
    </div>
  );
}
