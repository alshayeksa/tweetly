import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { LanguageToggle } from "@/components/LanguageToggle";
import { ArrowLeft } from "lucide-react";

export default function TermsPage() {
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
              {isAr ? "شروط الخدمة لـ Tweetly.ai" : "Terms of Service for Tweetly.ai"}
            </h1>
            <p className={`text-gray-600 ${isAr ? 'text-arabic-body' : ''}`}>
              {isAr ? "تم آخر تحديث: مارس 1, 2026" : "Last updated: March 1, 2026"}
            </p>
          </div>

          <div className="space-y-8 prose prose-lg max-w-none">
            {/* Section 1 */}
            <div className="space-y-3">
              <h2 className={`text-2xl font-bold text-gray-900 ${isAr ? 'text-arabic-heading' : ''}`}>
                {isAr ? "1. قبول الشروط" : "1. Acceptance of Terms"}
              </h2>
              <p className={`text-gray-700 leading-relaxed ${isAr ? 'text-arabic-body' : ''}`}>
                {isAr
                  ? "بالوصول إلى Tweetly.ai أو استخدامه، فإنك توافق على الالتزام بشروط الخدمة هذه وجميع القوانين واللوائح المعمول بها. إذا كنت لا توافق على أي من هذه الشروط، فإنك ممنوع من استخدام هذا الموقع أو الوصول إليه."
                  : "By accessing or using Tweetly.ai, you agree to be bound by these Terms of Service, all applicable laws, and regulations. If you do not agree with any of these terms, you are prohibited from using or accessing this site."}
              </p>
            </div>

            {/* Section 2 */}
            <div className="space-y-3">
              <h2 className={`text-2xl font-bold text-gray-900 ${isAr ? 'text-arabic-heading' : ''}`}>
                {isAr ? "2. وصف الخدمة" : "2. Service Description"}
              </h2>
              <p className={`text-gray-700 leading-relaxed ${isAr ? 'text-arabic-body' : ''}`}>
                {isAr
                  ? "Tweetly.ai هي منصة SaaS توفر أدوات إنشاء محتوى وجدولة وأتمتة مدعومة بالذكاء الاصطناعي لـ X (المعروف سابقاً بـ Twitter). نستخدم Google OAuth للمصادقة الآمنة وواجهة برمجة تطبيقات X الرسمية لتقديم الخدمة."
                  : "Tweetly.ai is a SaaS platform that provides AI-driven content creation, scheduling, and automation tools for X (formerly Twitter). We utilize Google OAuth for secure authentication and X's official API for service delivery."}
              </p>
            </div>

            {/* Section 3 */}
            <div className="space-y-3">
              <h2 className={`text-2xl font-bold text-gray-900 ${isAr ? 'text-arabic-heading' : ''}`}>
                {isAr ? "3. حسابات المستخدمين والمصادقة" : "3. User Accounts & Authentication"}
              </h2>
              <div className="space-y-3">
                <p className={`text-gray-700 leading-relaxed ${isAr ? 'text-arabic-body' : ''}`}>
                  <strong>{isAr ? "تسجيل الدخول بـ Google:" : "Google Sign-In:"}</strong>{" "}
                  {isAr
                    ? "باستخدام تسجيل الدخول بـ Google، فإنك تمنح Tweetly.ai إذناً للوصول إلى معلومات ملفك الشخصي الأساسية (الاسم والبريد الإلكتروني) كما تسمح بذلك خدمات OAuth من Google."
                    : "By using Google Sign-In, you authorize Tweetly.ai to access your basic profile information (name and email) as permitted by Google's OAuth services."}
                </p>
                <p className={`text-gray-700 leading-relaxed ${isAr ? 'text-arabic-body' : ''}`}>
                  <strong>{isAr ? "ربط حساب X (تويتر):" : "X (Twitter) Connection:"}</strong>{" "}
                  {isAr
                    ? "يجب ربط حساب X الخاص بك عبر OAuth الرسمي لاستخدام ميزات الأتمتة لدينا. لا تقوم Tweetly.ai بتخزين كلمات مرورك أو الوصول إليها."
                    : "You must connect your X account via official OAuth to use our automation features. Tweetly.ai does not store or access your passwords."}
                </p>
                <p className={`text-gray-700 leading-relaxed ${isAr ? 'text-arabic-body' : ''}`}>
                  <strong>{isAr ? "المسؤولية:" : "Responsibility:"}</strong>{" "}
                  {isAr
                    ? "أنت مسؤول عن الحفاظ على أمان حسابك وأي أنشطة تحدث تحت بيانات اعتمادك."
                    : "You are responsible for maintaining the security of your account and any activities that occur under your credentials."}
                </p>
              </div>
            </div>

            {/* Section 4 */}
            <div className="space-y-3">
              <h2 className={`text-2xl font-bold text-gray-900 ${isAr ? 'text-arabic-heading' : ''}`}>
                {isAr ? "4. سلوك المستخدم والامتثال" : "4. User Conduct & Compliance"}
              </h2>
              <div className="space-y-3">
                <p className={`text-gray-700 leading-relaxed ${isAr ? 'text-arabic-body' : ''}`}>
                  <strong>{isAr ? "سياسات X:" : "X Policies:"}</strong>{" "}
                  {isAr
                    ? "يجب على المستخدمين الامتثال الصارم لقواعد الأتمتة وسياسات المطورين الخاصة بـ X. يجب ألا ينتهك أي محتوى يتم إنشاؤه أو نشره عبر Tweetly.ai شروط X (مثل البريد العشوائي أو المضايقة أو الممارسات المضللة)."
                    : "Users must strictly comply with X's Automation Rules and Developer Policies. Any content generated or posted through Tweetly.ai must not violate X's terms (e.g., spam, harassment, or deceptive practices)."}
                </p>
                <p className={`text-gray-700 leading-relaxed ${isAr ? 'text-arabic-body' : ''}`}>
                  <strong>{isAr ? "محتوى الذكاء الاصطناعي:" : "AI Content:"}</strong>{" "}
                  {isAr
                    ? "أنت المسؤول الوحيد عن المحتوى الذي تولده أدوات الذكاء الاصطناعي لدينا. يجب عليك مراجعة جميع المنشورات والتحقق من دقتها وقانونيتها قبل نشرها."
                    : "You are solely responsible for the content generated by our AI tools. You must review and ensure the accuracy and legality of all posts before they are published."}
                </p>
              </div>
            </div>

            {/* Section 5 */}
            <div className="space-y-3">
              <h2 className={`text-2xl font-bold text-gray-900 ${isAr ? 'text-arabic-heading' : ''}`}>
                {isAr ? "5. الاشتراك والمدفوعات" : "5. Subscription & Payments"}
              </h2>
              <div className="space-y-3">
                <p className={`text-gray-700 leading-relaxed ${isAr ? 'text-arabic-body' : ''}`}>
                  <strong>{isAr ? "الفوترة:" : "Billing:"}</strong>{" "}
                  {isAr
                    ? "تتم معالجة المدفوعات بشكل آمن بواسطة Paddle (تاجر السجل لدينا). بالاشتراك، فإنك توافق على شروط وأحكام Paddle."
                    : "Payments are securely processed by Paddle (our Merchant of Record). By subscribing, you agree to Paddle's terms and conditions."}
                </p>
                <p className={`text-gray-700 leading-relaxed ${isAr ? 'text-arabic-body' : ''}`}>
                  <strong>{isAr ? "الإلغاء:" : "Cancellations:"}</strong>{" "}
                  {isAr
                    ? "يمكنك إلغاء اشتراكك في أي وقت من خلال لوحة التحكم الخاصة بك."
                    : "You may cancel your subscription at any time through your dashboard."}
                </p>
                <p className={`text-gray-700 leading-relaxed ${isAr ? 'text-arabic-body' : ''}`}>
                  <strong>{isAr ? "استرداد الأموال:" : "Refunds:"}</strong>{" "}
                  {isAr
                    ? "يرجى الرجوع إلى سياسة الاسترداد الخاصة بنا للحصول على معلومات تفصيلية حول عمليات عكس الاشتراك."
                    : "Please refer to our Refund Policy for detailed information on subscription reversals."}
                </p>
              </div>
            </div>

            {/* Section 6 */}
            <div className="space-y-3">
              <h2 className={`text-2xl font-bold text-gray-900 ${isAr ? 'text-arabic-heading' : ''}`}>
                {isAr ? "6. حدود المسؤولية" : "6. Limitations of Liability"}
              </h2>
              <p className={`text-gray-700 leading-relaxed ${isAr ? 'text-arabic-body' : ''}`}>
                {isAr
                  ? "لن تكون Tweetly.ai ومنشئوها مسؤولين عن أي أضرار تنشأ عن استخدام الخدمات أو عدم القدرة على استخدامها، بما في ذلك على سبيل المثال لا الحصر تعليق الحساب من قبل X (تويتر) بسبب محتوى من إنشاء المستخدم أو انتهاكات السياسة."
                  : "Tweetly.ai and its creators shall not be held liable for any damages arising out of the use or inability to use the services, including but not limited to account suspension by X (Twitter) due to user-generated content or policy violations."}
              </p>
            </div>

            {/* Section 7 */}
            <div className="space-y-3">
              <h2 className={`text-2xl font-bold text-gray-900 ${isAr ? 'text-arabic-heading' : ''}`}>
                {isAr ? "7. التغييرات على الشروط" : "7. Changes to Terms"}
              </h2>
              <p className={`text-gray-700 leading-relaxed ${isAr ? 'text-arabic-body' : ''}`}>
                {isAr
                  ? "نحتفظ بالحق في تعديل هذه الشروط في أي وقت. سنُبلغ المستخدمين بأي تغييرات جوهرية عبر البريد الإلكتروني المرتبط بحساب Google الخاص بهم."
                  : "We reserve the right to modify these terms at any time. We will notify users of any significant changes via the email associated with their Google account."}
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
