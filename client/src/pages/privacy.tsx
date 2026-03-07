import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { LanguageToggle } from "@/components/LanguageToggle";
import { ArrowLeft } from "lucide-react";

export default function PrivacyPage() {
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
              {isAr ? "سياسة الخصوصية" : "Privacy Policy for Tweetly.ai"}
            </h1>
            <p className={`text-gray-600 ${isAr ? 'text-arabic-body' : ''}`}>
              {isAr ? "تم آخر تحديث: مارس 1, 2026" : "Last updated: March 1, 2026"}
            </p>
          </div>

          <div className="space-y-8 prose prose-lg max-w-none">
            {/* Section 1 */}
            <div className="space-y-3">
              <h2 className={`text-2xl font-bold text-gray-900 ${isAr ? 'text-arabic-heading' : ''}`}>
                {isAr ? "1. المعلومات التي نجمعها" : "1. Information We Collect"}
              </h2>
              <div className="space-y-3">
                <p className={`text-gray-700 leading-relaxed ${isAr ? 'text-arabic-body' : ''}`}>
                  <strong>{isAr ? "بيانات حساب Google:" : "Google Account Data:"}</strong>{" "}
                  {isAr
                    ? "عند تسجيل الدخول عبر Google، نتلقى عنوان بريدك الإلكتروني واسمك وصورة ملفك الشخصي. يُستخدم ذلك فقط لإنشاء حساب Tweetly.ai الخاص بك والتعرف عليه."
                    : "When you sign in via Google, we receive your email address, name, and profile picture URL. This is used solely to create and identify your Tweetly.ai account."}
                </p>
                <p className={`text-gray-700 leading-relaxed ${isAr ? 'text-arabic-body' : ''}`}>
                  <strong>{isAr ? "بيانات X (تويتر):" : "X (Twitter) Data:"}</strong>{" "}
                  {isAr
                    ? "نستخدم OAuth الرسمي للاتصال بحساب X الخاص بك. نجمع اسم المستخدم وبيانات الملف الشخصي العامة لتسهيل الأتمتة المدعومة بالذكاء الاصطناعي. لا نخزن كلمات المرور الخاصة بك أو نطلع عليها أبداً."
                    : "We use official OAuth to connect your X account. We collect your handle and public profile data to facilitate AI-driven automation. We never store or see your passwords."}
                </p>
              </div>
            </div>

            {/* Section 2 */}
            <div className="space-y-3">
              <h2 className={`text-2xl font-bold text-gray-900 ${isAr ? 'text-arabic-heading' : ''}`}>
                {isAr ? "2. كيف نستخدم معلوماتك" : "2. How We Use Your Information"}
              </h2>
              <div className="space-y-3">
                <p className={`text-gray-700 leading-relaxed ${isAr ? 'text-arabic-body' : ''}`}>
                  <strong>{isAr ? "المصادقة:" : "Authentication:"}</strong>{" "}
                  {isAr
                    ? "لتوفير تجربة تسجيل دخول آمنة وسلسة عبر Google."
                    : "To provide a secure and seamless login experience via Google."}
                </p>
                <p className={`text-gray-700 leading-relaxed ${isAr ? 'text-arabic-body' : ''}`}>
                  <strong>{isAr ? "تقديم الخدمة:" : "Service Delivery:"}</strong>{" "}
                  {isAr
                    ? "لإنشاء محتوى الذكاء الاصطناعي وإدارة جدول النشر الخاص بك على X وفقاً لتفضيلاتك."
                    : "To generate AI content and manage your X posting schedule as per your preferences."}
                </p>
                <p className={`text-gray-700 leading-relaxed ${isAr ? 'text-arabic-body' : ''}`}>
                  <strong>{isAr ? "التواصل:" : "Communication:"}</strong>{" "}
                  {isAr
                    ? "قد نستخدم بريدك الإلكتروني المقدم من Google لتحديثات الخدمة الأساسية وإيصالات الفوترة عبر Paddle."
                    : "We may use your Google-provided email for essential service updates and billing receipts via Paddle."}
                </p>
              </div>
            </div>

            {/* Section 3 */}
            <div className="space-y-3">
              <h2 className={`text-2xl font-bold text-gray-900 ${isAr ? 'text-arabic-heading' : ''}`}>
                {isAr ? "3. إفصاح Google API (سياسة الاستخدام المحدود)" : "3. Google API Disclosure (Limited Use Policy)"}
              </h2>
              <div className="space-y-3">
                <p className={`text-gray-700 leading-relaxed ${isAr ? 'text-arabic-body' : ''}`}>
                  {isAr
                    ? "سيلتزم استخدام Tweetly.ai ونقل المعلومات المستلمة من Google APIs إلى أي تطبيق آخر بـ سياسة بيانات مستخدم خدمة Google API، بما في ذلك متطلبات الاستخدام المحدود."
                    : "Tweetly.ai's use and transfer to any other app of information received from Google APIs will adhere to Google API Service User Data Policy, including the Limited Use requirements."}
                </p>
                <p className={`text-gray-700 leading-relaxed ${isAr ? 'text-arabic-body' : ''}`}>
                  {isAr
                    ? "نحن لا نستخدم بيانات مستخدمي Google لعرض الإعلانات."
                    : "We do not use Google user data to serve advertisements."}
                </p>
                <p className={`text-gray-700 leading-relaxed ${isAr ? 'text-arabic-body' : ''}`}>
                  {isAr
                    ? "لا نسمح للبشر بقراءة بيانات مستخدمي Google الخاصة بك إلا إذا كان ذلك مطلوباً لأغراض أمنية أو للامتثال للقانون المعمول به."
                    : "We do not allow humans to read your Google user data unless required for security purposes or to comply with applicable law."}
                </p>
              </div>
            </div>

            {/* Section 4 */}
            <div className="space-y-3">
              <h2 className={`text-2xl font-bold text-gray-900 ${isAr ? 'text-arabic-heading' : ''}`}>
                {isAr ? "4. مشاركة البيانات والأطراف الثالثة" : "4. Data Sharing & Third Parties"}
              </h2>
              <div className="space-y-3">
                <p className={`text-gray-700 leading-relaxed ${isAr ? 'text-arabic-body' : ''}`}>
                  <strong>{isAr ? "عدم بيع البيانات:" : "No Data Selling:"}</strong>{" "}
                  {isAr
                    ? "نحن لا نبيع أو نؤجر أو نتاجر بمعلوماتك الشخصية أو بيانات حساب Google/X لأطراف ثالثة."
                    : "We do not sell, rent, or trade your personal information or Google/X account data to third parties."}
                </p>
                <p className={`text-gray-700 leading-relaxed ${isAr ? 'text-arabic-body' : ''}`}>
                  <strong>{isAr ? "مزودو الخدمة:" : "Service Providers:"}</strong>{" "}
                  {isAr
                    ? "نشارك البيانات الضرورية مع Paddle لمعالجة المدفوعات الآمنة ومع مزودي الذكاء الاصطناعي (LLMs) لإنشاء المحتوى. يُحظر على هؤلاء المزودين استخدام بياناتك لأي غرض آخر."
                    : "We share necessary data with Paddle for secure payment processing and with AI providers (LLMs) for content generation. These providers are prohibited from using your data for any other purpose."}
                </p>
              </div>
            </div>

            {/* Section 5 */}
            <div className="space-y-3">
              <h2 className={`text-2xl font-bold text-gray-900 ${isAr ? 'text-arabic-heading' : ''}`}>
                {isAr ? "5. الأمان والتشفير" : "5. Security & Encryption"}
              </h2>
              <p className={`text-gray-700 leading-relaxed ${isAr ? 'text-arabic-body' : ''}`}>
                {isAr
                  ? "نستخدم تشفير SSL/TLS بمعايير صناعية للبيانات أثناء النقل وتشفير AES-256 للبيانات في حالة الراحة. يتم تخزين رموز OAuth الخاصة بك بشكل آمن في قاعدة بيانات مشفرة."
                  : "We use industry-standard SSL/TLS encryption for data in transit and AES-256 encryption for data at rest. Your OAuth tokens are stored securely in an encrypted database."}
              </p>
            </div>

            {/* Section 6 */}
            <div className="space-y-3">
              <h2 className={`text-2xl font-bold text-gray-900 ${isAr ? 'text-arabic-heading' : ''}`}>
                {isAr ? "6. حقوق المستخدم وحذف البيانات" : "6. User Rights & Data Deletion"}
              </h2>
              <p className={`text-gray-700 leading-relaxed ${isAr ? 'text-arabic-body' : ''}`}>
                {isAr
                  ? "يمكنك إلغاء وصول Tweetly.ai إلى حسابات Google أو X الخاصة بك في أي وقت من خلال إعدادات أمان الحساب المعنية. لطلب الحذف الدائم لحساب Tweetly.ai الخاص بك وجميع البيانات المرتبطة به، يرجى التواصل معنا على support@tweetly.ai."
                  : "You can revoke Tweetly.ai's access to your Google or X accounts at any time through your respective account security settings. To request permanent deletion of your Tweetly.ai account and all associated data, please contact us at support@tweetly.ai."}
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
