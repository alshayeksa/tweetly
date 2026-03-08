import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import { useLocation } from "wouter";

interface DailyLimitModalProps {
  isOpen: boolean;
  onClose: () => void;
  retryAfterMs?: number;
}

function getResetInfo(retryAfterMs?: number): { hours: number; resetTimeUTC: string } {
  const midnight = new Date();
  midnight.setUTCHours(24, 0, 0, 0);
  const now = Date.now();
  const msUntil = retryAfterMs && retryAfterMs > 0 ? retryAfterMs : midnight.getTime() - now;
  const hours = Math.ceil(msUntil / (1000 * 60 * 60));
  // Format midnight UTC as "12:00 AM UTC"
  const resetTime = new Date(now + msUntil);
  const h = resetTime.getUTCHours();
  const m = resetTime.getUTCMinutes().toString().padStart(2, "0");
  const ampm = h < 12 ? "AM" : "PM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  const resetTimeUTC = `${h12}:${m} ${ampm} UTC`;
  return { hours, resetTimeUTC };
}

const accent = {
  glow: "rgba(245,158,11,0.14)",
  badge: "rgba(245,158,11,0.1)",
  badgeBorder: "rgba(245,158,11,0.35)",
  badgeText: "#fbbf24",
  primaryBtn: "linear-gradient(135deg,#f59e0b,#d97706)",
  primaryShadow: "rgba(245,158,11,0.35)",
};

export function DailyLimitModal({ isOpen, onClose, retryAfterMs }: DailyLimitModalProps) {
  const { i18n } = useTranslation();
  const isAr = i18n.language === "ar";
  const [isVisible, setIsVisible] = useState(isOpen);
  const [, navigate] = useLocation();

  useEffect(() => {
    setIsVisible(isOpen);
  }, [isOpen]);

  if (!isVisible) return null;

  const { hours, resetTimeUTC } = getResetInfo(retryAfterMs);
  const handleClose = () => { setIsVisible(false); onClose(); };
  const handleUpgrade = () => { handleClose(); navigate("/pricing"); };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" dir={isAr ? "rtl" : "ltr"}>
      <div
        className="relative w-full max-w-sm overflow-hidden rounded-2xl"
        style={{
          background: "linear-gradient(145deg,#0f0f0f 0%,#141414 50%,#0f0f0f 100%)",
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: `0 0 60px ${accent.glow},0 25px 50px rgba(0,0,0,0.7)`,
        }}
      >
        {/* Top glow */}
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-56 h-28 pointer-events-none"
          style={{ background: `radial-gradient(ellipse,${accent.glow} 0%,transparent 70%)`, filter: "blur(20px)" }}
        />

        {/* Close */}
        <button
          onClick={handleClose}
          className="absolute top-3 right-3 z-10 text-zinc-600 hover:text-zinc-300 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="relative pt-8 pb-4 px-6 text-center">
          <div className="text-4xl mb-3">⏳</div>
          <div
            className="inline-block text-xs font-bold tracking-widest uppercase mb-3 px-3 py-1 rounded-full"
            style={{ background: accent.badge, color: accent.badgeText, border: `1px solid ${accent.badgeBorder}` }}
          >
            {isAr ? "تم الوصول للحد اليومي" : "DAILY LIMIT REACHED"}
          </div>
          <h2 className="text-xl font-bold text-white mb-3">
            {isAr ? "وصلت للحد اليومي للذكاء الاصطناعي" : "Daily AI Limit Reached"}
          </h2>
          <p className="text-sm text-zinc-400 leading-relaxed">
            {isAr
              ? `لقد وصلت إلى الحد اليومي لتوليد التغريدات بالذكاء الاصطناعي.\nسيتم إعادة الحد خلال ${hours} ${hours === 1 ? "ساعة" : "ساعات"}.`
              : `You've reached your daily AI generation limit.\nYour limit will reset in ${hours} ${hours === 1 ? "hour" : "hours"}.`}
          </p>
        </div>

        {/* Info card */}
        <div
          className="mx-6 mb-5 rounded-xl px-4 py-3 text-center"
          style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.15)" }}
        >
          <div className="text-2xl font-bold" style={{ color: accent.badgeText }}>
            {hours}h
          </div>
          <div className="text-xs text-zinc-500 mt-0.5">
            {isAr ? "حتى إعادة الضبط" : "until reset"}
          </div>
          <div className="text-xs mt-1.5" style={{ color: accent.badgeText }}>
            {resetTimeUTC}
          </div>
        </div>

        {/* Buttons */}
        <div className="px-6 pb-5 space-y-2.5">
          <button
            onClick={handleUpgrade}
            className="w-full py-3.5 rounded-xl font-bold text-sm transition-all active:scale-95 text-black"
            style={{ background: accent.primaryBtn, boxShadow: `0 4px 20px ${accent.primaryShadow}` }}
          >
            {isAr ? "🚀 الترقية إلى Pro الآن" : "Upgrade to Pro Now 🚀"}
          </button>
          <button
            onClick={handleClose}
            className="w-full py-3 rounded-xl font-semibold text-sm transition-all active:scale-95 text-zinc-200"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)" }}
          >
            {isAr ? "حسناً، سأحاول غداً" : "Try Again Tomorrow"}
          </button>
        </div>
      </div>
    </div>
  );
}
