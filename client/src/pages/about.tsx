import { Link } from "wouter";
import { useTranslation } from "react-i18next";

export default function AboutPage() {
  const { i18n } = useTranslation();
  const isAr = i18n.language === "ar";

  return (
    <div
      className="min-h-screen bg-black text-white"
      dir={isAr ? "rtl" : "ltr"}
    >
      {/* Nav */}
      <header className="border-b border-gray-800 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link href="/">
            <a className="text-xl font-black text-white tracking-tight">
              Tweetly<span className="text-[#007AFF]">.ai</span>
            </a>
          </Link>
          <Link href="/login">
            <a className="text-sm text-blue-400 hover:text-blue-300 font-semibold transition-colors">
              {isAr ? "ابدأ مجاناً" : "Start Free"}
            </a>
          </Link>
        </div>
      </header>

      {/* Hero */}
      <main className="max-w-4xl mx-auto px-6 py-16 space-y-16">
        <section className="space-y-6">
          <h1 className="text-4xl md:text-5xl font-black leading-tight">
            {isAr
              ? "عن Tweetly.ai — أداة أتمتة تويتر بالذكاء الاصطناعي"
              : "About Tweetly.ai — AI Twitter Automation Built for Creators"}
          </h1>
          <p className="text-lg text-gray-300 leading-relaxed max-w-2xl">
            {isAr
              ? "Tweetly.ai هي أداة أتمتة تويتر مدعومة بالذكاء الاصطناعي تساعد المبدعين وأصحاب الأعمال والمسوّقين على توليد تغريدات جذابة، وجدولتها تلقائياً، ونشرها على X (تويتر) — دون الحاجة إلى قضاء ساعات أمام الشاشة."
              : "Tweetly.ai is an AI-powered Twitter automation tool that helps creators, founders, and marketers generate engaging tweets, auto-schedule posts, and grow their X (Twitter) audience — without spending hours staring at a blank screen."}
          </p>
        </section>

        {/* Mission */}
        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-white">
            {isAr ? "مهمتنا" : "Our Mission"}
          </h2>
          <p className="text-gray-300 leading-relaxed">
            {isAr
              ? "نؤمن أن كل شخص لديه صوت يستحق أن يُسمع. Tweetly.ai يجعل الحضور الرقمي المتواصل ميسوراً للجميع — بغض النظر عن الميزانية أو الخبرة التقنية. نحن نوفر خطة مجانية دائمة حتى يتمكن الجميع من البدء."
              : "We believe everyone has a voice worth amplifying. Tweetly.ai makes consistent, high-quality social presence accessible to anyone — regardless of budget or technical skill. That's why we offer a permanent free plan with 25 tweets per month, no credit card required."}
          </p>
        </section>

        {/* What we do */}
        <section className="space-y-6">
          <h2 className="text-2xl font-bold text-white">
            {isAr ? "ما يقدمه Tweetly.ai" : "What Tweetly.ai Does"}
          </h2>
          <ul className="space-y-4">
            {[
              {
                title: isAr ? "توليد تغريدات بالذكاء الاصطناعي" : "AI Tweet Generation",
                desc: isAr
                  ? "يستخدم Tweetly.ai نماذج Google Gemini لتوليد تغريدات مُحسَّنة لزيادة التفاعل بناءً على موضوعك أو صوتك المميز."
                  : "Tweetly.ai uses Google Gemini AI models to generate engagement-optimized tweets based on your topic, niche, or unique voice.",
              },
              {
                title: isAr ? "الجدولة التلقائية" : "Auto-Scheduling",
                desc: isAr
                  ? "جدوِل تغريداتك مسبقاً لتُنشر تلقائياً في الأوقات المثلى — حتى أثناء نومك."
                  : "Schedule tweets in advance and let Tweetly post them automatically at optimal times — even while you sleep.",
              },
              {
                title: isAr ? "إنشاء الثريدات" : "Thread Creation",
                desc: isAr
                  ? "حوِّل أفكارك الطويلة إلى ثريدات احترافية جاهزة للنشر بنقرة واحدة."
                  : "Turn long-form ideas into polished, ready-to-publish Twitter threads in seconds.",
              },
              {
                title: isAr ? "دعم العربية والإنجليزية" : "Arabic & English Support",
                desc: isAr
                  ? "تم بناء Tweetly.ai أصلاً لدعم اللغة العربية إلى جانب الإنجليزية."
                  : "Tweetly.ai was built from the ground up to support both Arabic and English audiences.",
              },
            ].map((item) => (
              <li key={item.title} className="flex gap-4">
                <div className="w-2 h-2 rounded-full bg-[#007AFF] mt-2 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-white">{item.title}</p>
                  <p className="text-gray-400 text-sm leading-relaxed mt-1">{item.desc}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* Technology */}
        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-white">
            {isAr ? "التكنولوجيا" : "Technology"}
          </h2>
          <p className="text-gray-300 leading-relaxed">
            {isAr
              ? "يعمل Tweetly.ai بواسطة Google Gemini AI ويتكامل مع X API الرسمي (OAuth 2.0 PKCE). نحن لا نخزّن كلمات مرورك أبداً، ولا نتحكم في حسابك خارج نطاق الإذن الصريح الذي تمنحه."
              : "Tweetly.ai is powered by Google Gemini AI and integrates with the official X API (OAuth 2.0 PKCE). We never store your X password and never access your account beyond the explicit permissions you grant."}
          </p>
        </section>

        {/* Contact */}
        <section
          id="contact"
          className="space-y-4 border-t border-gray-800 pt-12"
          itemScope
          itemType="https://schema.org/ContactPage"
        >
          <h2 className="text-2xl font-bold text-white">
            {isAr ? "تواصل معنا" : "Contact Us"}
          </h2>
          <p className="text-gray-300 leading-relaxed">
            {isAr
              ? "هل لديك سؤال أو مشكلة أو اقتراح؟ نحن نرد خلال 24 ساعة."
              : "Have a question, issue, or suggestion? We reply within 24 hours."}
          </p>
          <a
            href="mailto:support@tweetly.ai"
            className="inline-block text-blue-400 hover:text-blue-300 font-semibold text-lg transition-colors"
            itemProp="email"
          >
            support@tweetly.ai
          </a>
        </section>

        {/* CTA */}
        <section className="border-t border-gray-800 pt-12 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <Link href="/login">
            <a className="bg-[#007AFF] hover:bg-blue-600 text-white font-bold px-8 py-3 rounded-full transition-colors">
              {isAr ? "ابدأ مجاناً — 25 تغريدة/شهر" : "Start Free — 25 tweets/month"}
            </a>
          </Link>
          <Link href="/pricing">
            <a className="text-gray-400 hover:text-white text-sm font-semibold transition-colors">
              {isAr ? "شاهد جميع الخطط ←" : "View all plans →"}
            </a>
          </Link>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-800 px-6 py-8 text-center text-gray-500 text-sm">
        <p>© 2026 Tweetly.ai — {isAr ? "جميع الحقوق محفوظة" : "All rights reserved"}</p>
      </footer>
    </div>
  );
}
