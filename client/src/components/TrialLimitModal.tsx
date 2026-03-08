import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import { X, Loader2 } from "lucide-react";
import { usePlanPrices } from "@/hooks/use-plan-prices";
import { usePlanConfig } from "@/hooks/use-plan-config";

interface TrialLimitModalProps {
  isOpen: boolean;
  onClose: () => void;
  message?: string;
  messageAr?: string;
  hideProgress?: boolean;
}

interface Accent {
  glow: string; badge: string; badgeBorder: string; badgeText: string;
  statValue: string; featureBg: string; primaryBtn: string; primaryShadow: string; progressBar: string;
}

interface PlanContent {
  emoji: string;
  badge: { en: string; ar: string };
  headline: { en: string; ar: string };
  subline: { en: string; ar: string };
  upgradeLabel: { en: string; ar: string };
  features: Array<{ icon: string; en: string; ar: string }>;
  stats: Array<{ value: string; label: string }>;
  accent: Accent;
}

function getPlanContent(plan: string, tweetsUsed: number, monthlyLimit: number | null, starterLimit = 300, creatorLimit = 600, proLimit = 1500): PlanContent {
  const used = tweetsUsed;
  switch (plan) {
    case "free": return {
      emoji: "🌱",
      badge: { en: "FREE PLAN LIMIT", ar: "حد الخطة المجانية" },
      headline: { en: "Ready to grow?", ar: "هل أنت مستعد للنمو؟" },
      subline: { en: `You've published ${used} tweets this month — great start!\n\nUpgrade to Starter (${starterLimit} tweets) or Creator (${creatorLimit} tweets) to keep going.`, ar: `نشرت ${used} تغريدة هذا الشهر — بداية رائعة!\n\nقم بالترقية إلى Starter (${starterLimit} تغريدة) أو Creator (${creatorLimit} تغريدة) للاستمرار.` },
      upgradeLabel: { en: "Creator unlocks:", ar: "Creator يتيح لك:" },
      features: [
        { icon: "📢", en: `${creatorLimit} tweets per month`, ar: `${creatorLimit} تغريدة شهرياً` },
        { icon: "✨", en: "AI tweet writing & optimization", ar: "كتابة وتحسين التغريدات بالذكاء الاصطناعي" },
        { icon: "🧵", en: "Unlimited threads", ar: "ثريدات غير محدودة" },
        { icon: "🗓️", en: "Advanced scheduling", ar: "جدولة متقدمة" },
      ],
      stats: [{ value: `${creatorLimit}`, label: "tweets/mo" }, { value: "AI", label: "writing" }, { value: "∞", label: "threads" }],
      accent: { glow: "rgba(52,211,153,0.12)", badge: "rgba(52,211,153,0.1)", badgeBorder: "rgba(52,211,153,0.3)", badgeText: "#34d399", statValue: "#34d399", featureBg: "rgba(52,211,153,0.05)", primaryBtn: "linear-gradient(135deg,#10b981,#059669)", primaryShadow: "rgba(16,185,129,0.35)", progressBar: "#34d399" },
    };
    case "starter": return {
      emoji: "⚡",
      badge: { en: "STARTER LIMIT REACHED", ar: "وصلت لحد Starter" },
      headline: { en: "You're on a roll!", ar: "أنت في قمة نشاطك!" },
      subline: { en: `You've published ${used} tweets this month — great momentum! Unlock ${creatorLimit} tweets and go further.`, ar: `نشرت ${used} تغريدة هذا الشهر — زخم رائع! افتح ${creatorLimit} تغريدة وتقدّم أكثر.` },
      upgradeLabel: { en: "Creator unlocks:", ar: "Creator يتيح لك:" },
      features: [
        { icon: "📢", en: `${creatorLimit} tweets per month`, ar: `${creatorLimit} تغريدة شهرياً` },
        { icon: "🧵", en: "Unlimited threads", ar: "ثريدات غير محدودة" },
        { icon: "✨", en: "AI rewriting & optimization", ar: "إعادة كتابة وتحسين بالذكاء الاصطناعي" },
        { icon: "🗓️", en: "Advanced scheduling", ar: "جدولة متقدمة" },
      ],
      stats: [{ value: `${creatorLimit}`, label: "tweets/mo" }, { value: "∞", label: "threads" }, { value: "AI", label: "optimizer" }],
      accent: { glow: "rgba(99,102,241,0.12)", badge: "rgba(99,102,241,0.1)", badgeBorder: "rgba(99,102,241,0.3)", badgeText: "#818cf8", statValue: "#818cf8", featureBg: "rgba(99,102,241,0.05)", primaryBtn: "linear-gradient(135deg,#6366f1,#4f46e5)", primaryShadow: "rgba(99,102,241,0.35)", progressBar: "#818cf8" },
    };
    case "creator": return {
      emoji: "🔥",
      badge: { en: "CREATOR LIMIT REACHED", ar: "وصلت لحد Creator" },
      headline: { en: "You're on fire!", ar: "أنت في قمة نشاطك!" },
      subline: { en: `You've published ${used} tweets this month — incredible! Take it further with Autopilot.`, ar: `نشرت ${used} تغريدة هذا الشهر — مذهل! انتقل إلى المستوى التالي مع Autopilot.` },
      upgradeLabel: { en: "Autopilot unlocks:", ar: "Autopilot يتيح لك:" },
      features: [
        { icon: "📢", en: `${proLimit} tweets per month`, ar: `${proLimit} تغريدة شهرياً` },
        { icon: "🤖", en: "Full autopilot automation 24/7", ar: "أتمتة تلقائية كاملة 24/7" },
        { icon: "🎯", en: "AI picks best posting times", ar: "الذكاء الاصطناعي يختار أفضل أوقات النشر" },
        { icon: "🏆", en: "Priority support", ar: "دعم ذو أولوية" },
      ],
      stats: [{ value: `${proLimit}`, label: "tweets/mo" }, { value: "24/7", label: "autopilot" }, { value: "∞", label: "automations" }],
      accent: { glow: "rgba(168,85,247,0.12)", badge: "rgba(168,85,247,0.1)", badgeBorder: "rgba(168,85,247,0.3)", badgeText: "#c084fc", statValue: "#c084fc", featureBg: "rgba(168,85,247,0.05)", primaryBtn: "linear-gradient(135deg,#a855f7,#7c3aed)", primaryShadow: "rgba(168,85,247,0.35)", progressBar: "#c084fc" },
    };
    case "autopilot": return {
      emoji: "🚀",
      badge: { en: "AUTOPILOT LIMIT REACHED", ar: "وصلت لحد Autopilot" },
      headline: { en: "Incredible consistency!", ar: "ثبات مذهل!" },
      subline: { en: `You've published ${used} tweets this month. Renew now and unlock a fresh ${proLimit} tweets instantly.`, ar: `نشرت ${used} تغريدة هذا الشهر. جدّد الآن واحصل على ${proLimit} تغريدة جديدة فوراً.` },
      upgradeLabel: { en: "Autopilot includes:", ar: "Autopilot يشمل:" },
      features: [
        { icon: "📢", en: `${proLimit} tweets per month`, ar: `${proLimit} تغريدة شهرياً` },
        { icon: "🤖", en: "Full autopilot automation", ar: "أتمتة تلقائية كاملة" },
        { icon: "🧵", en: "Unlimited threads", ar: "ثريدات غير محدودة" },
        { icon: "🏆", en: "Priority support", ar: "دعم ذو أولوية" },
      ],
      stats: [{ value: `${proLimit}`, label: "tweets/mo" }, { value: "24/7", label: "autopilot" }, { value: "∞", label: "threads" }],
      accent: { glow: "rgba(251,191,36,0.12)", badge: "rgba(251,191,36,0.1)", badgeBorder: "rgba(251,191,36,0.3)", badgeText: "#fbbf24", statValue: "#fbbf24", featureBg: "rgba(251,191,36,0.05)", primaryBtn: "linear-gradient(135deg,#f59e0b,#d97706)", primaryShadow: "rgba(251,191,36,0.35)", progressBar: "#fbbf24" },
    };
    default: return {
      emoji: "⏰",
      badge: { en: "LIMIT REACHED", ar: "تم الوصول إلى الحد" },
      headline: { en: "Upgrade your plan", ar: "قم بترقية خطتك" },
      subline: { en: "You've reached the limit of your current plan.", ar: "لقد وصلت إلى حد خطتك الحالية." },
      upgradeLabel: { en: "With a paid plan:", ar: "في الخطة المدفوعة:" },
      features: [
        { icon: "📢", en: "More tweets per month", ar: "المزيد من التغريدات شهرياً" },
        { icon: "📅", en: "Smart scheduling", ar: "جدولة ذكية" },
        { icon: "🧵", en: "Thread publishing", ar: "ثريدات احترافية" },
        { icon: "✨", en: "AI generation & optimization", ar: "توليد وتحسين بالذكاء الاصطناعي" },
      ],
      stats: [{ value: "300+", label: "tweets/mo" }, { value: "AI", label: "writing" }, { value: "∞", label: "scheduling" }],
      accent: { glow: "rgba(99,102,241,0.12)", badge: "rgba(99,102,241,0.1)", badgeBorder: "rgba(99,102,241,0.3)", badgeText: "#818cf8", statValue: "#818cf8", featureBg: "rgba(99,102,241,0.05)", primaryBtn: "linear-gradient(135deg,#6366f1,#4f46e5)", primaryShadow: "rgba(99,102,241,0.35)", progressBar: "#818cf8" },
    };
  }
}

export function TrialLimitModal({ isOpen, onClose, message, messageAr, hideProgress }: TrialLimitModalProps) {
  const { i18n } = useTranslation();
  const isAr = i18n.language === "ar";
  const { prices } = usePlanPrices();
  const { plans: planConfig } = usePlanConfig();
  const [showSar, setShowSar] = useState(false);
  const [isVisible, setIsVisible] = useState(isOpen);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [checkingPlan, setCheckingPlan] = useState<string | null>(null);
  const [voucherInput, setVoucherInput] = useState("");
  const [voucherStatus, setVoucherStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [voucherError, setVoucherError] = useState("");
  const [appliedVoucher, setAppliedVoucher] = useState<{ code: string; discountPercent: number; voucherPlan: string | null } | null>(null);

  const { data: subscription } = useQuery<{ plan: string; tweetsUsed: number; monthlyLimit: number | null; isTrial: boolean }>({
    queryKey: ["/api/subscription"],
    enabled: isOpen,
  });

  useEffect(() => {
    setIsVisible(isOpen);
    if (isOpen) { setVoucherInput(""); setVoucherStatus("idle"); setVoucherError(""); setAppliedVoucher(null); setShowSar(false); }
  }, [isOpen]);

  if (!isVisible) return null;

  const handleClose = () => { setIsVisible(false); onClose(); };

  const handleCheckout = async (planKey: string) => {
    setIsCheckingOut(true); setCheckingPlan(planKey);
    try {
      const res = await fetch("/api/subscription/checkout", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plan: planKey, ...(appliedVoucher ? { voucherCode: appliedVoucher.code } : {}) }) });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch { } finally { setIsCheckingOut(false); setCheckingPlan(null); }
  };

  async function applyVoucher() {
    const code = voucherInput.trim().toUpperCase();
    if (!code) return;
    setVoucherStatus("loading");
    try {
      const res = await fetch("/api/voucher/validate", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) });
      const data = await res.json();
      if (data.valid) { setAppliedVoucher({ code, discountPercent: data.discountPercent, voucherPlan: data.voucherPlan }); setVoucherStatus("success"); setVoucherError(""); }
      else { setAppliedVoucher(null); setVoucherStatus("error"); setVoucherError(data.message || (isAr ? "كود غير صالح" : "Invalid voucher code")); }
    } catch { setVoucherStatus("error"); setVoucherError(isAr ? "فشل التحقق من الكوبون" : "Failed to validate voucher"); }
  }

  function getPriceDisplay(planKey: string): string {
    const p = prices[planKey]; if (!p) return "";
    let usd = p.usd, sar = p.sar;
    if (appliedVoucher) { usd = Math.round(usd * (1 - appliedVoucher.discountPercent / 100)); sar = Math.round(sar * (1 - appliedVoucher.discountPercent / 100)); }
    return showSar ? (isAr ? `${sar} ر.س` : `${sar} SAR`) : `$${usd}`;
  }

  const plan = subscription?.plan ?? "free";
  const tweetsUsed = subscription?.tweetsUsed ?? 0;
  const monthlyLimit = subscription?.monthlyLimit ?? null;
  const starterLimit = planConfig.starter?.tweetLimit ?? 300;
  const creatorLimit = planConfig.creator?.tweetLimit ?? 600;
  const proLimit = planConfig.autopilot?.tweetLimit ?? 1500;
  const content = getPlanContent(plan, tweetsUsed, monthlyLimit, starterLimit, creatorLimit, proLimit);
  const { accent } = content;
  const bodyText = isAr ? (messageAr || content.subline.ar) : (message || content.subline.en);
  const pct = monthlyLimit ? Math.min(100, Math.round((tweetsUsed / monthlyLimit) * 100)) : 100;

  const renderActionButtons = () => {
    const busy = (p: string) => isCheckingOut && checkingPlan === p;
    const primaryBtn = (planKey: string, label: { en: string; ar: string }) => (
      <button key={`primary-${planKey}`} onClick={() => handleCheckout(planKey)} disabled={isCheckingOut}
        className="w-full py-3.5 rounded-xl font-bold text-sm transition-all active:scale-95 disabled:opacity-60 text-black"
        style={{ background: accent.primaryBtn, boxShadow: `0 4px 20px ${accent.primaryShadow}` }}>
        {busy(planKey) ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : (isAr ? label.ar : label.en)}
      </button>
    );
    const outlineBtn = (planKey: string, label: { en: string; ar: string }) => (
      <button key={`outline-${planKey}`} onClick={() => handleCheckout(planKey)} disabled={isCheckingOut}
        className="w-full py-3 rounded-xl font-semibold text-sm transition-all active:scale-95 disabled:opacity-60 text-zinc-200"
        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)" }}>
        {busy(planKey) ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : (isAr ? label.ar : label.en)}
      </button>
    );
    const linkBtn = (planKey: string, label: { en: string; ar: string }) => (
      <button key={`link-${planKey}`} onClick={() => handleCheckout(planKey)} disabled={isCheckingOut}
        className="w-full text-xs text-zinc-600 hover:text-zinc-400 underline underline-offset-2 py-1 transition-colors disabled:opacity-50">
        {busy(planKey) ? "..." : (isAr ? label.ar : label.en)}
      </button>
    );
    if (plan === "free") return [
      primaryBtn("creator", { en: `✨ Upgrade to Creator – ${getPriceDisplay("creator")}`, ar: `✨ الترقية إلى Creator – ${getPriceDisplay("creator")}` }),
      outlineBtn("starter", { en: `🚀 Upgrade to Starter – ${getPriceDisplay("starter")}`, ar: `🚀 الترقية إلى Starter – ${getPriceDisplay("starter")}` }),
    ];
    if (plan === "starter") return [
      primaryBtn("creator", { en: `🚀 Upgrade to Creator – ${getPriceDisplay("creator")}`, ar: `🚀 الترقية إلى Creator – ${getPriceDisplay("creator")}` }),
      outlineBtn("starter", { en: `🔁 Renew Starter – ${getPriceDisplay("starter")}`, ar: `🔁 تجديد Starter – ${getPriceDisplay("starter")}` }),
    ];
    if (plan === "creator") return [
      primaryBtn("autopilot", { en: `🚀 Upgrade to Autopilot – ${getPriceDisplay("autopilot")}`, ar: `🚀 الترقية إلى Autopilot – ${getPriceDisplay("autopilot")}` }),
      outlineBtn("creator", { en: `🔁 Renew Creator – ${getPriceDisplay("creator")}`, ar: `🔁 تجديد Creator – ${getPriceDisplay("creator")}` }),
      linkBtn("starter", { en: `Switch to Starter – ${getPriceDisplay("starter")}`, ar: `التحويل إلى Starter – ${getPriceDisplay("starter")}` }),
    ];
    return [
      primaryBtn("autopilot", { en: `🔁 Renew Autopilot – ${getPriceDisplay("autopilot")}`, ar: `🔁 تجديد Autopilot – ${getPriceDisplay("autopilot")}` }),
      outlineBtn("creator", { en: `⬇️ Switch to Creator – ${getPriceDisplay("creator")}`, ar: `⬇️ التحويل إلى Creator – ${getPriceDisplay("creator")}` }),
    ];
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" dir={isAr ? "rtl" : "ltr"}>
      <div className="relative w-full max-w-sm overflow-hidden rounded-2xl"
        style={{ background: "linear-gradient(145deg,#0f0f0f 0%,#141414 50%,#0f0f0f 100%)", border: "1px solid rgba(255,255,255,0.08)", boxShadow: `0 0 60px ${accent.glow},0 25px 50px rgba(0,0,0,0.7)` }}>

        {/* Top glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-56 h-28 pointer-events-none"
          style={{ background: `radial-gradient(ellipse,${accent.glow} 0%,transparent 70%)`, filter: "blur(20px)" }} />

        {/* Close */}
        <button onClick={handleClose} className="absolute top-3 right-3 z-10 text-zinc-600 hover:text-zinc-300 transition-colors">
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="relative pt-4 pb-2 px-6 text-center">
          <div className="inline-block text-xs font-bold tracking-widest uppercase mb-3 px-3 py-1 rounded-full"
            style={{ background: accent.badge, color: accent.badgeText, border: `1px solid ${accent.badgeBorder}` }}>
            {isAr ? content.badge.ar : content.badge.en}
          </div>
          <h2 className="text-xl font-bold text-white mb-1.5">{isAr ? content.headline.ar : content.headline.en}</h2>
          <p className="text-sm text-zinc-400 leading-relaxed">{bodyText}</p>
        </div>

        {/* Progress */}
        {!hideProgress && subscription && monthlyLimit !== null && (
          <div className="px-6 mb-2 space-y-1">
            <div className="flex justify-between text-xs text-zinc-500">
              <span>{isAr ? "التغريدات المستخدمة" : "Tweets used"}</span>
              <span className="font-semibold text-zinc-300">{tweetsUsed} / {monthlyLimit}</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-zinc-800 overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: accent.progressBar }} />
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="mx-6 mb-2 grid grid-cols-3 gap-1.5 rounded-lg p-2"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
          {content.stats.map((s) => (
            <div key={s.label} className="text-center">
              <div className="text-sm font-bold" style={{ color: accent.statValue }}>{s.value}</div>
              <div className="text-xs text-zinc-600">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Features */}
        <div className="px-6 mb-2">
          <p className="text-xs font-semibold text-zinc-400 mb-1.5">{isAr ? content.upgradeLabel.ar : content.upgradeLabel.en}</p>
          <div className="space-y-1">
            {content.features.map((f) => (
              <div key={f.en} className="flex items-center gap-2">
                <span className="text-xs font-bold flex-shrink-0" style={{ color: accent.statValue }}>✓</span>
                <span className="text-xs text-zinc-300">{isAr ? f.ar : f.en}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Voucher */}
        <div className="px-6 mb-3">
          {appliedVoucher ? (
            <div className="flex items-center justify-between bg-emerald-900/30 border border-emerald-700/40 rounded-xl px-3 py-2">
              <span className="text-emerald-400 text-sm font-semibold">
                {isAr ? `✓ خصم ${appliedVoucher.discountPercent}% مطبّق` : `✓ ${appliedVoucher.discountPercent}% discount applied`}
              </span>
              <button onClick={() => { setAppliedVoucher(null); setVoucherInput(""); setVoucherStatus("idle"); setVoucherError(""); }}
                className="text-zinc-400 hover:text-zinc-200 text-xs underline ms-2">
                {isAr ? "إزالة" : "Remove"}
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <input type="text" value={voucherInput} onChange={(e) => setVoucherInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && applyVoucher()}
                placeholder={isAr ? "كود الخصم (اختياري)" : "Voucher code (optional)"}
                className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-600"
                dir={isAr ? "rtl" : "ltr"} />
              <button onClick={applyVoucher} disabled={voucherStatus === "loading" || !voucherInput.trim()}
                className="bg-zinc-800 hover:bg-zinc-700 text-white text-sm font-semibold px-3 py-2 rounded-xl transition-colors disabled:opacity-50">
                {voucherStatus === "loading" ? "..." : (isAr ? "تطبيق" : "Apply")}
              </button>
            </div>
          )}
          {voucherStatus === "error" && <p className="text-red-400 text-xs mt-1.5">{voucherError}</p>}
        </div>

        {/* Currency toggle */}
        <div className="flex items-center justify-center gap-1 mb-3 text-xs">
          <button onClick={() => setShowSar(false)} className="px-2 py-0.5 rounded transition-colors"
            style={{ background: !showSar ? "rgba(255,255,255,0.1)" : "transparent", color: !showSar ? "#fff" : "#71717a" }}>$ USD</button>
          <span className="text-zinc-700">|</span>
          <button onClick={() => setShowSar(true)} className="px-2 py-0.5 rounded transition-colors"
            style={{ background: showSar ? "rgba(255,255,255,0.1)" : "transparent", color: showSar ? "#fff" : "#71717a" }}>﷼ SAR</button>
        </div>

        {/* Buttons */}
        <div className="px-6 pb-4 space-y-2">
          {renderActionButtons()}
          <button onClick={handleClose} className="w-full text-xs text-zinc-600 hover:text-zinc-400 py-2 transition-colors">
            {isAr ? "ربما لاحقاً" : "Maybe Later"}
          </button>
        </div>
      </div>
    </div>
  );
}
