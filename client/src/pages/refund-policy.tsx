import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { LanguageToggle } from "@/components/LanguageToggle";
import { ArrowLeft } from "lucide-react";

export default function RefundPolicyPage() {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === "ar";

  return (
    <div className="min-h-screen bg-white" dir={isAr ? "rtl" : "ltr"}>
      {/* NAV */}
      <nav className="fixed top-0 inset-x-0 z-50 flex items-center justify-between px-6 md:px-12 h-16 bg-white/80 backdrop-blur border-b border-blue-50">
        <Link href="/">
          <div className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
            <span className="font-black text-xl text-gray-900">Tweetly<span className="text-[#007AFF]">.ai</span></span>
          </div>
        </Link>
        <LanguageToggle />
      </nav>

      {/* Content */}
      <div className="pt-24 pb-20 px-6 md:px-12 max-w-3xl mx-auto">
        <div className="space-y-8">
          <div className="space-y-4">
            <h1 className={`text-4xl md:text-5xl font-black text-gray-900 ${isAr ? 'text-arabic-heading' : ''}`}>
              {isAr ? "سياسة الاسترجاع" : "Refund Policy"}
            </h1>
            <p className={`text-gray-600 ${isAr ? 'text-arabic-body' : ''}`}>
              {isAr ? "تم آخر تحديث: فبراير 2026" : "Last updated: February 2026"}
            </p>
          </div>

          <div className="space-y-8 prose prose-lg max-w-none">
            {/* Section 1 */}
            <div className="space-y-3">
              <h2 className={`text-2xl font-bold text-gray-900 ${isAr ? 'text-arabic-heading' : ''}`}>
                {isAr ? "1. النسخة التجريبية المجانية" : "1. Free Trial"}
              </h2>
              <p className={`text-gray-700 leading-relaxed ${isAr ? 'text-arabic-body' : ''}`}>
                {isAr 
                  ? "نحن نوفر نسخة تجريبية مجانية لمدة 7 أيام للسماح للمستخدمين باختبار الخدمة بالكامل قبل الالتزام بخطة مدفوعة."
                  : "We provide a 7-day free trial to allow users to fully test the service before committing to a paid plan."}
              </p>
            </div>

            {/* Section 2 */}
            <div className="space-y-3">
              <h2 className={`text-2xl font-bold text-gray-900 ${isAr ? 'text-arabic-heading' : ''}`}>
                {isAr ? "2. السياسة العامة" : "2. General Policy"}
              </h2>
              <p className={`text-gray-700 leading-relaxed ${isAr ? 'text-arabic-body' : ''}`}>
                {isAr 
                  ? "نظراً للطبيعة الرقمية لخدماتنا القائمة على الذكاء الاصطناعي وتوفر نسخة تجريبية مجانية، لا نقدم عادةً استرجاعات بمجرد بدء فترة الاشتراك المدفوع."
                  : "Due to the digital nature of our AI services and the availability of a free trial, we generally do not offer refunds once a paid subscription period has started."}
              </p>
            </div>

            {/* Section 3 */}
            <div className="space-y-3">
              <h2 className={`text-2xl font-bold text-gray-900 ${isAr ? 'text-arabic-heading' : ''}`}>
                {isAr ? "3. الإلغاء" : "3. Cancellations"}
              </h2>
              <p className={`text-gray-700 leading-relaxed ${isAr ? 'text-arabic-body' : ''}`}>
                {isAr 
                  ? "يمكنك إلغاء اشتراكك في أي وقت عبر لوحة تحكم المستخدم لمنع فترات الفواتير المستقبلية."
                  : "You may cancel your subscription at any time via the user dashboard to prevent future billing."}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-gray-900 py-8 px-6 text-center text-gray-400 text-sm">
        © 2026 Tweetly.ai — {isAr ? "جميع الحقوق محفوظة" : "All rights reserved"}
      </footer>
    </div>
  );
}
