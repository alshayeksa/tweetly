import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";

export default function ConnectXPage() {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === "ar";

  const { data: xStatus, isLoading } = useQuery<{ connected: boolean; username: string | null }>({
    queryKey: ["/api/x/status"],
    refetchInterval: 3000, // poll until connected
  });

  const handleConnect = async () => {
    const res = await fetch("/api/x/auth-url", { credentials: "include" });
    if (res.ok) {
      const { url } = await res.json();
      window.location.href = url;
    }
  };

  // If just connected (e.g. returning from OAuth), redirect to dashboard
  if (xStatus?.connected) {
    window.location.replace("/");
    return null;
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6"
      dir={isAr ? "rtl" : "ltr"}
    >
      <div className="max-w-md w-full text-center space-y-8">
        {/* Icon */}
        <div className="flex justify-center">
          <div className="w-20 h-20 bg-white/10 rounded-full flex items-center justify-center shadow-2xl">
            <svg viewBox="0 0 24 24" className="w-10 h-10 fill-white" aria-hidden="true">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.74l7.73-8.835L1.254 2.25H8.08l4.258 5.631zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
          </div>
        </div>

        {/* Heading */}
        <div className="space-y-3">
          <h1 className="text-3xl font-black text-white">
            {isAr ? "ربط حساب X" : "Connect your X account"}
          </h1>
          <p className="text-slate-400 text-lg leading-relaxed">
            {isAr
              ? "يجب ربط حساب X الخاص بك قبل البدء في النشر وإنشاء المحتوى."
              : "Connect your X account to start publishing and generating content."}
          </p>
        </div>

        {/* Feature bullets */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 text-left space-y-3" dir={isAr ? "rtl" : "ltr"}>
          {[
            isAr ? "نشر التغريدات مباشرة" : "Publish tweets instantly",
            isAr ? "جدولة المنشورات" : "Schedule posts in advance",
            isAr ? "توليد محتوى بالذكاء الاصطناعي" : "AI-powered content generation",
            isAr ? "25 تغريدة مجانية كل شهر" : "25 free tweets every month",
          ].map((feature) => (
            <div key={feature} className="flex items-center gap-3">
              <span className="text-emerald-400 text-lg">✓</span>
              <span className="text-slate-300 text-sm">{feature}</span>
            </div>
          ))}
        </div>

        {/* CTA */}
        <Button
          onClick={handleConnect}
          disabled={isLoading}
          size="lg"
          className="w-full bg-white text-black hover:bg-slate-100 font-bold text-base py-6 rounded-xl shadow-xl"
        >
          <svg viewBox="0 0 24 24" className="w-5 h-5 fill-black mr-2 flex-shrink-0" aria-hidden="true">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.74l7.73-8.835L1.254 2.25H8.08l4.258 5.631zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
          </svg>
          {isAr ? "ربط حساب X" : "Connect X Account"}
        </Button>

        {/* Free counter reminder */}
        <p className="text-slate-500 text-xs">
          {isAr
            ? "🆓 خطة مجانية · 25 تغريدة شهريًا · لا يلزم بطاقة ائتمان"
            : "🆓 Free plan · 25 tweets/month · No credit card required"}
        </p>
      </div>
    </div>
  );
}
