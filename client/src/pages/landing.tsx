import { Link } from "wouter";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { LanguageToggle } from "@/components/LanguageToggle";
import { ChevronDown } from "lucide-react";

export default function LandingPage() {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === "ar";
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const faqs = [
    {
      q: "Is there a free plan?",
      a: "Yes. Tweetly.ai offers a permanent free plan with 25 tweets per month. This includes instant publishing, scheduling, threads up to 3 tweets, and basic AI generation. No credit card required — ever.",
      qAr: "هل يوجد خطة مجانية؟",
      aAr: "نعم. يوفر Tweetly.ai خطة مجانية دائمة بـ25 تغريدة شهرياً. تشمل النشر الفوري والجدولة والثريدات حتى 3 تغريدات ووضع الذكاء الاصطناعي الأساسي. لا حاجة لبطاقة ائتمان أبداً.",
    },
    {
      q: "Why do I need to connect my X account?",
      a: "Connecting your X account allows Tweetly to publish tweets, schedule posts, and track performance directly on your behalf using the official X API. Without it, you can still generate tweet ideas but can't publish them. You can disconnect at any time from Settings.",
      qAr: "لماذا أحتاج إلى ربط حساب X الخاص بي؟",
      aAr: "ربط حسابك على X يتيح لـ Tweetly نشر التغريدات وجدولة المنشورات وتتبع الأداء نيابةً عنك. بدونه، يمكنك توليد أفكار للتغريدات لكن لا يمكنك نشرها. يمكنك قطع الاتصال في أي وقت من الإعدادات.",
    },
    {
      q: "Is my X account safe? Can Tweetly post without my approval?",
      a: "You are always in control. Tweetly only publishes tweets you explicitly approve or schedule. We use official X OAuth 2.0 — your password is never shared. You can disconnect your X account at any time from Settings.",
      qAr: "هل حسابي على X آمن؟ هل يمكن لـ Tweetly النشر دون موافقتي؟",
      aAr: "أنت دائماً في السيطرة. لا ينشر Tweetly إلا التغريدات التي توافق عليها صراحةً أو تجدولها. نستخدم OAuth 2.0 الرسمي من X — كلمة مرورك لا تُشارك أبداً.",
    },
    {
      q: "How does the AI tweet generator work?",
      a: "Powered by Google Gemini AI, you write a topic or idea and Tweetly generates multiple tweet options in your chosen language, tone, and style. You pick what you like — or regenerate for more options. It's AI Twitter automation made simple.",
      qAr: "كيف يعمل توليد التغريدات بالذكاء الاصطناعي؟",
      aAr: "مدعوم بـ Google Gemini AI، تكتب موضوعاً أو فكرة ويولّد Tweetly خيارات متعددة للتغريدات باللغة والنبرة والأسلوب الذي تختاره. تختار ما يعجبك — أو تعيد التوليد للحصول على خيارات أخرى.",
    },
    {
      q: "Does it support Arabic content?",
      a: "Yes. Tweetly is fully bilingual — Arabic and English. The AI generates native-quality Arabic tweets with proper hooks, style guides, and right-to-left formatting. The entire app interface is also available in Arabic.",
      qAr: "هل يدعم المحتوى العربي؟",
      aAr: "نعم. Tweetly ثنائي اللغة بالكامل — عربي وإنجليزي. يولّد الذكاء الاصطناعي تغريدات عربية بجودة أصلية مع خطافات احترافية وتنسيق صحيح. كما تتوفر واجهة التطبيق بالكامل باللغة العربية.",
    },
    {
      q: "How does AI Twitter automation / auto-scheduling work?",
      a: "You set up recurring time slots (e.g. every day at 9am, 2pm) and Tweetly's AI Twitter automation engine automatically publishes tweets from your queue at those times. You can pause, edit, or stop the schedule any time from the dashboard.",
      qAr: "كيف تعمل الجدولة التلقائية بالذكاء الاصطناعي؟",
      aAr: "تُحدد فترات زمنية متكررة (مثلاً: كل يوم الساعة 9 صباحاً و2 مساءً) ويقوم Tweetly تلقائياً بنشر التغريدات من قائمتك في تلك الأوقات. يمكنك إيقاف الجدول أو تعديله في أي وقت.",
    },
    {
      q: "What paid plans does Tweetly offer?",
      a: "Starter is $19/month (150 tweets + threads up to 6), Creator is $39/month (400 tweets + unlimited threads), and Pro is $79/month (1,000 tweets + autopilot automation). All plans include AI generation and smart scheduling. Cancel anytime.",
      qAr: "ما هي الخطط المدفوعة التي يوفرها Tweetly؟",
      aAr: "Starter بـ19$/شهر (150 تغريدة + ثريد حتى 6 تغريدات)، Creator بـ39$/شهر (400 تغريدة + ثريدات غير محدودة)، وPro بـ79$/شهر (1000 تغريدة + أتمتة تلقائية). جميع الخطط تشمل توليد الذكاء الاصطناعي والجدولة الذكية. يمكن الإلغاء في أي وقت.",
    },
    {
      q: "Can I cancel my subscription anytime?",
      a: "Yes. Cancel anytime from your account settings with one click. You keep access until the end of your billing period. No cancellation fees, no contracts.",
      qAr: "هل يمكنني إلغاء اشتراكي في أي وقت؟",
      aAr: "نعم. ألغِ في أي وقت من إعدادات حسابك بنقرة واحدة. تحتفظ بالوصول حتى نهاية فترة الفوترة. لا رسوم إلغاء.",
    },
  ];

  return (
    <div className="min-h-screen bg-white" dir={isAr ? "rtl" : "ltr"}>
      {/* NAV */}
      <nav className="fixed top-0 inset-x-0 z-50 flex items-center justify-between px-6 md:px-12 h-16 bg-white/80 backdrop-blur border-b border-blue-50">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="Tweetly" className="w-10 h-10 md:w-12 md:h-12" />
          <span className="font-black text-xl md:text-2xl text-gray-900">Tweetly<span className="text-[#007AFF]">.ai</span></span>
        </div>
        
        {/* Center Nav Links */}
        <div className="hidden md:flex items-center gap-6">
        </div>
        
        <div className="flex items-center gap-3">
          <LanguageToggle />
          <Link href="/login">
            <button className="text-sm font-semibold text-gray-600 hover:text-gray-900 transition-colors px-3 py-1.5">
              {isAr ? "دخول" : "Sign In"}
            </button>
          </Link>
        </div>
      </nav>

      {/* HERO */}
      <section className="pt-32 pb-20 px-6 md:px-12 max-w-6xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 bg-blue-50 border border-blue-100 text-[#007AFF] text-xs font-bold px-4 py-1.5 rounded-full mb-8">
          <span className="w-1.5 h-1.5 bg-[#007AFF] rounded-full animate-pulse"></span>
          {isAr ? "مدعوم بـ Google Gemini و DeepSeek" : "Powered by Google Gemini & DeepSeek"}
        </div>

        <h1 className={`text-3xl md:text-5xl font-black text-gray-900 leading-tight mb-6 ${isAr ? 'text-arabic-heading' : ''}`}>
          {isAr ? (
            <><span className="font-tajawal">أداة أتمتة تويتر بالذكاء الاصطناعي</span><br /><span className="text-[#007AFF] font-tajawal">أنشئ وجدول ونشر تلقائياً</span></>
          ) : (
            <>AI Twitter Automation Tool<br /><span className="text-[#007AFF]">Create, Schedule &amp; Auto-Post Tweets</span></>
          )}
        </h1>

        <p className={`text-lg md:text-2xl text-gray-600 max-w-2xl mx-auto mb-10 leading-relaxed font-medium ${isAr ? 'text-arabic-body' : ''}`}>
          {isAr
            ? "Tweetly يساعدك على كتابة وجدولة ونشر تغريدات احترافية، وزيادة متابعينك بسهولة تامة باستخدام الذكاء الاصطناعي."
            : "Generate viral tweets, auto-schedule posts, and grow your X audience faster. Powered by Google Gemini & DeepSeek AI. Start free — 25 tweets/month."}
        </p>

        <div className="flex items-center justify-center gap-4 flex-wrap">
          <Link href="/login">
            <button className="bg-[#007AFF] text-white font-bold text-lg px-8 py-4 rounded-full shadow-xl shadow-blue-200 hover:bg-blue-600 hover:scale-105 transition-all">
              {isAr ? "ابدأ مجاناً ←" : "Start Free →"}
            </button>
          </Link>
          <span className="text-sm text-gray-400">{isAr ? "لا حاجة لبطاقة ائتمان" : "No credit card needed"}</span>
        </div>

        {/* Mock Dashboard */}
        <div className="mt-16 bg-gradient-to-br from-blue-50 to-gray-50 border border-gray-100 rounded-2xl p-6 max-w-2xl mx-auto shadow-2xl shadow-gray-100" dir={isAr ? "rtl" : "ltr"}>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-3 h-3 rounded-full bg-red-400"></div>
            <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
            <div className="w-3 h-3 rounded-full bg-green-400"></div>
            <span className="text-xs text-gray-400 mx-auto">Tweetly.ai Generator</span>
          </div>
          <div className="bg-white rounded-xl p-4 border border-gray-100 mb-3">
            <div className={`text-xs text-[#007AFF] font-bold mb-1 ${isAr ? 'text-arabic-heading' : ''}`}>{isAr ? "📝 الموضوع" : "📝 Topic"}</div>
            <div className={`text-sm text-gray-600 ${isAr ? 'text-arabic-body' : ''}`}>{isAr ? "نصائح لزيادة المتابعين على X في 2026..." : "Tips to grow your X audience in 2026..."}</div>
          </div>
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 space-y-3">
            <div className={`text-sm text-gray-800 leading-relaxed font-medium ${isAr ? 'text-arabic-body' : ''}`}>
              {isAr 
                ? "✨ هل تعلم؟ 81% من المؤثرين يستخدمون الأدوات الذكية لإنتاج المحتوى. الفرق بيننا وبينهم ليس الموهبة، بل الأدوات الصحيحة. Tweetly هنا لتغيير اللعبة."
                : "✨ 81% of top creators use AI tools for content. The difference? Smart tools. With Tweetly, you're not just writing—you're optimizing for engagement."}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400">{isAr ? "256 / 280 ح" : "256/280 chars"}</span>
              <button className="bg-[#007AFF] text-white text-xs font-bold px-4 py-2 rounded-full hover:bg-blue-600 transition-all">{isAr ? "نشر ✈️" : "Post ✈️"}</button>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="py-20 px-6 md:px-12 bg-gray-50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <div className="text-[#007AFF] text-sm font-bold uppercase tracking-widest mb-3">
              {isAr ? "المميزات الرئيسية" : "Key Features"}
            </div>
            <h2 className={`text-2xl md:text-4xl font-black text-gray-900 ${isAr ? 'text-arabic-heading' : ''}`}>
              {isAr ? "كل ما تحتاج للإبهار" : "Everything to impress"}
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              { 
                icon: "✨", 
                ar: "مولد التغريدات الذكي", 
                en: "AI Tweet Generator", 
                arDesc: "اكتب أي موضوع، واحصل على تغريدات مبهرة جاهزة للنشر في ثانية واحدة",
                enDesc: "Type a topic, get viral-ready tweets in seconds"
              },
              { 
                icon: "🚀", 
                ar: "الجدولة الآلية", 
                en: "Autopilot Scheduling", 
                arDesc: "حدد الفترات الزمنية ودع Tweetly ينشر تغريداتك تلقائياً بذكاء",
                enDesc: "Set it and forget it. Post at optimal times automatically"
              },
              { 
                icon: "🧵", 
                ar: "منشئ الثريدات", 
                en: "Thread Creator", 
                arDesc: "حول فكرتك إلى ثريد جذاب بخطوة واحدة فقط",
                enDesc: "Turn ideas into engaging threads instantly"
              },
              { 
                icon: "🌍", 
                ar: "العربية والإنجليزية", 
                en: "Bilingual Support", 
                arDesc: "دعم كامل لكل اللغات بطريقة طبيعية وسلسة",
                enDesc: "Write in Arabic or English with native fluency"
              },
              { 
                icon: "📊", 
                ar: "تحليل الأداء", 
                en: "Performance Analytics", 
                arDesc: "تتبع أداء كل تغريدة واستكشف ما ينجح مع جمهورك",
                enDesc: "Track what works and optimize your strategy"
              },
              { 
                icon: "🎨", 
                ar: "اختيارات التخصيص", 
                en: "Full Customization", 
                arDesc: "اضبط النبرة واللغة والأسلوب حسب هويتك الخاصة",
                enDesc: "Customize tone, style, and content to match your brand"
              },
            ].map((f, i) => (
              <div key={i} className="bg-white rounded-2xl p-6 border border-gray-100 flex gap-4 hover:shadow-lg hover:border-blue-100 transition-all">
                <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-2xl flex-shrink-0">{f.icon}</div>
                <div className={isAr ? "text-right" : "text-left"}>
                  <div className={`font-bold text-gray-900 mb-1 ${isAr ? 'text-arabic-heading' : ''}`}>{isAr ? f.ar : f.en}</div>
                  <div className={`text-sm text-gray-600 ${isAr ? 'text-arabic-body' : ''}`}>{isAr ? f.arDesc : f.enDesc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section className="py-20 px-6 md:px-12">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <div className="text-[#007AFF] text-sm font-bold uppercase tracking-widest mb-3">
              {isAr ? "الأسعار" : "Pricing"}
            </div>
            <h2 className={`text-3xl md:text-5xl font-black text-gray-900 mb-2 ${isAr ? 'text-arabic-heading' : ''}`}>
              {isAr ? "بسيط وشفاف وعادل" : "Simple, Transparent & Fair"}
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

            {/* Free */}
            <div className="bg-gray-50 rounded-2xl p-8 border border-gray-100 flex flex-col">
              <div className={`text-lg font-black text-gray-900 mb-1 ${isAr ? 'text-arabic-heading' : ''}`}>🆓 {isAr ? "مجاني" : "Free"}</div>
              <div className="text-4xl font-black text-gray-900 mb-1">$0</div>
              <div className={`text-gray-400 text-sm mb-6 ${isAr ? 'text-arabic-body' : ''}`}>{isAr ? "للأبد" : "forever"}</div>
              <ul className={`space-y-2 text-sm text-gray-600 mb-8 flex-1 ${isAr ? 'text-arabic-body' : ''}`}>
                <li className="flex items-center gap-2"><span className="text-green-500">✓</span>{isAr ? "25 تغريدة / شهر" : "25 Tweets / month"}</li>
                <li className="flex items-center gap-2"><span className="text-green-500">✓</span>{isAr ? "نشر فوري" : "Instant publishing"}</li>
                <li className="flex items-center gap-2"><span className="text-green-500">✓</span>{isAr ? "جدولة" : "Scheduling"}</li>
              </ul>
              <Link href="/login">
                <button className="w-full py-3 rounded-full border border-gray-200 font-bold text-gray-700 hover:bg-gray-100 transition-colors">
                  {isAr ? "ابدأ مجاناً" : "Start Free"}
                </button>
              </Link>
            </div>

            {/* Creator */}
            <div className="bg-gradient-to-br from-[#007AFF] to-[#005FD8] rounded-2xl p-8 text-white relative shadow-2xl shadow-blue-200 flex flex-col">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-white text-[#007AFF] text-xs font-black px-4 py-1 rounded-full whitespace-nowrap">
                ⭐ {isAr ? "الأكثر شعبية" : "Most Popular"}
              </div>
              <div className={`text-lg font-black text-white mb-1 ${isAr ? 'text-arabic-heading' : ''}`}>⭐ {isAr ? "Creator" : "Creator"}</div>
              <div className="text-4xl font-black text-white mb-1">$39</div>
              <div className={`text-blue-100 text-sm mb-6 ${isAr ? 'text-arabic-body' : ''}`}>{isAr ? "/شهر" : "/month"}</div>
              <ul className={`space-y-2 text-sm text-blue-50 mb-8 flex-1 ${isAr ? 'text-arabic-body' : ''}`}>
                <li className="flex items-center gap-2"><span className="text-blue-200">✓</span>{isAr ? "400 تغريدة / شهر" : "400 Tweets per month"}</li>
                <li className="flex items-center gap-2"><span className="text-blue-200">✓</span>{isAr ? "جدولة متقدمة" : "Advanced scheduling"}</li>
                <li className="flex items-center gap-2"><span className="text-blue-200">✓</span>{isAr ? "نشر الثريدات" : "Thread publishing"}</li>
                <li className="flex items-center gap-2"><span className="text-blue-200">✓</span>{isAr ? "تحسين بالذكاء الاصطناعي" : "AI optimization"}</li>
              </ul>
              <Link href="/pricing">
                <button className="w-full py-3 rounded-full bg-white text-[#007AFF] font-black hover:scale-105 transition-all">
                  {isAr ? "الترقية إلى Creator ←" : "Upgrade to Creator →"}
                </button>
              </Link>
            </div>

            {/* Pro */}
            <div className="bg-gray-900 rounded-2xl p-8 border border-gray-700 flex flex-col">
              <div className={`text-lg font-black text-white mb-1 ${isAr ? 'text-arabic-heading' : ''}`}>🟣 Pro</div>
              <div className="text-4xl font-black text-white mb-1">$79</div>
              <div className={`text-gray-400 text-sm mb-6 ${isAr ? 'text-arabic-body' : ''}`}>{isAr ? "/شهر" : "/month"}</div>
              <ul className={`space-y-2 text-sm text-gray-300 mb-8 flex-1 ${isAr ? 'text-arabic-body' : ''}`}>
                <li className="flex items-center gap-2"><span className="text-purple-400">✓</span>{isAr ? "1,000 تغريدة / شهر" : "1,000 Tweets per month"}</li>
                <li className="flex items-center gap-2"><span className="text-purple-400">✓</span>{isAr ? "نشر تلقائي" : "Autopilot posting"}</li>
                <li className="flex items-center gap-2"><span className="text-purple-400">✓</span>{isAr ? "تحسين ذكاء اصطناعي متقدم" : "Advanced AI optimization"}</li>
                <li className="flex items-center gap-2"><span className="text-purple-400">✓</span>{isAr ? "جدولة جماعية" : "Bulk scheduling"}</li>
              </ul>
              <Link href="/pricing">
                <button className="w-full py-3 rounded-full bg-purple-600 hover:bg-purple-700 text-white font-black transition-colors">
                  {isAr ? "اشترك بـ Pro ←" : "Go Pro →"}
                </button>
              </Link>
            </div>

          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 px-6 md:px-12 bg-gray-50" id="faq">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-14">
            <h2 className={`text-2xl md:text-4xl font-black text-gray-900 ${isAr ? 'text-arabic-heading' : ''}`}>
              {isAr ? "كل ما تريد معرفته" : "Everything you need to know"}
            </h2>
          </div>

          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <div
                key={i}
                className="bg-white border border-gray-100 rounded-2xl overflow-hidden hover:border-blue-100 transition-colors"
              >
                <button
                  className={`w-full flex items-center justify-between gap-4 px-6 py-5 text-left ${isAr ? 'flex-row-reverse text-right' : ''}`}
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                >
                  <span className={`font-bold text-gray-900 text-sm md:text-base ${isAr ? 'text-arabic-heading' : ''}`}>
                    {isAr ? faq.qAr : faq.q}
                  </span>
                  <ChevronDown
                    className={`w-5 h-5 text-[#007AFF] flex-shrink-0 transition-transform duration-200 ${openFaq === i ? 'rotate-180' : ''}`}
                  />
                </button>
                {openFaq === i && (
                  <div className={`px-6 pb-5 text-gray-600 text-sm leading-relaxed border-t border-gray-50 pt-4 ${isAr ? 'text-right text-arabic-body' : ''}`}>
                    {isAr ? faq.aAr : faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6 bg-gradient-to-r from-[#007AFF] to-[#005FD8] text-center">
        <h2 className={`text-3xl md:text-5xl font-black text-white mb-4 ${isAr ? 'text-arabic-heading' : ''}`}>
          {isAr ? "هل أنت جاهز للنمو؟" : "Ready to grow your audience?"}
        </h2>
        <p className={`text-blue-100 mb-8 text-lg max-w-2xl mx-auto ${isAr ? 'text-arabic-body' : ''}`}>
          {isAr 
            ? "انضم إلى آلاف المنشئين الذين يستخدمون Tweetly يومياً للوصول إلى جمهور أكبر وأكثر تفاعلاً"
            : "Join thousands of creators building their X presence smarter and faster"}
        </p>
        <Link href="/login">
          <button className="bg-white text-[#007AFF] font-black text-lg px-10 py-4 rounded-full shadow-xl hover:scale-105 transition-all">
            {isAr ? "ابدأ مجاناً الآن ←" : "Start Free Now →"}
          </button>
        </Link>
      </section>

      {/* FOOTER */}
      <footer className="bg-gradient-to-b from-gray-900 to-black py-16 px-6 text-gray-300" dir={isAr ? "rtl" : "ltr"}>
        <div className="max-w-6xl mx-auto">
          {/* Main Footer Content */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 mb-12">
            {/* Pricing */}
            <div className="space-y-4">
              <h3 className={`text-lg font-bold text-white ${isAr ? 'text-arabic-heading' : ''}`}>
                {isAr ? "التسعير" : "Pricing"}
              </h3>
              <div className="space-y-1">
                <p className={`text-sm text-gray-400 ${isAr ? 'text-arabic-body' : ''}`}>
                  <strong className="text-white">{isAr ? "🆓 مجاني" : "🆓 Free"}</strong>
                </p>
                <p className={`text-xs text-gray-500 ${isAr ? 'text-arabic-body' : ''}`}>
                  {isAr ? "25 تغريدة / شهر • نشر فوري • جدولة" : "25 Tweets / month • Instant publishing • Scheduling"}
                </p>
              </div>
              <div className="space-y-1 border-t border-gray-700 pt-4">
                <p className={`text-sm text-gray-400 ${isAr ? 'text-arabic-body' : ''}`}>
                  <strong className="text-white">{isAr ? "⭐ Creator — $39 / شهر" : "⭐ Creator — $39 / month"}</strong>
                </p>
                <p className={`text-xs text-gray-500 ${isAr ? 'text-arabic-body' : ''}`}>
                  {isAr ? "400 تغريدة / شهر • جدولة متقدمة • نشر الثريدات • تحسين بالذكاء الاصطناعي • دعم أولوي 24/7" : "400 Tweets per month • Advanced scheduling • Thread publishing • AI optimization • 24/7 priority support"}
                </p>
              </div>
              <Link href="/pricing">
                <button className="text-blue-400 hover:text-blue-300 text-sm font-semibold transition-colors">
                  {isAr ? "شاهد جميع الخطط ←" : "View all plans →"}
                </button>
              </Link>
            </div>

            {/* Legal */}
            <div className="space-y-4">
              <h3 className={`text-lg font-bold text-white ${isAr ? 'text-arabic-heading' : ''}`}>
                {isAr ? "المعلومات القانونية" : "Legal"}
              </h3>
              <nav className="space-y-2">
                <Link href="/about">
                  <a className={`block text-gray-400 hover:text-blue-400 transition-colors ${isAr ? 'text-arabic-body' : ''}`}>
                    {isAr ? "عن Tweetly" : "About Tweetly"}
                  </a>
                </Link>
                <Link href="/terms">
                  <a className={`block text-gray-400 hover:text-blue-400 transition-colors ${isAr ? 'text-arabic-body' : ''}`}>
                    {isAr ? "شروط الخدمة" : "Terms of Service"}
                  </a>
                </Link>
                <Link href="/privacy">
                  <a className={`block text-gray-400 hover:text-blue-400 transition-colors ${isAr ? 'text-arabic-body' : ''}`}>
                    {isAr ? "سياسة الخصوصية" : "Privacy Policy"}
                  </a>
                </Link>
                <Link href="/refund-policy">
                  <a className={`block text-gray-400 hover:text-blue-400 transition-colors ${isAr ? 'text-arabic-body' : ''}`}>
                    {isAr ? "سياسة الاسترجاع" : "Refund Policy"}
                  </a>
                </Link>
              </nav>
            </div>

            {/* Support */}
            <div className="space-y-4">
              <h3 className={`text-lg font-bold text-white ${isAr ? 'text-arabic-heading' : ''}`}>
                {isAr ? "الدعم" : "Support"}
              </h3>
              <p className={`text-sm text-gray-400 leading-relaxed ${isAr ? 'text-arabic-body' : ''}`}>
                {isAr 
                  ? "هل لديك أسئلة؟ نحن هنا للمساعدة. راسلنا أو ابدأ مجاناً اليوم."
                  : "Questions? We're here to help. Reach out any time or start free today."}
              </p>
              <a
                href="mailto:support@tweetly.ai"
                className={`block text-blue-400 hover:text-blue-300 text-sm font-semibold transition-colors ${isAr ? 'text-arabic-body' : ''}`}
              >
                support@tweetly.ai
              </a>
              <Link href="/login">
                <button className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-full transition-colors">
                  {isAr ? "ابدأ مجاناً ←" : "Start Free →"}
                </button>
              </Link>
            </div>
          </div>

          {/* Bottom Footer */}
          <div className={`border-t border-gray-700 pt-8 flex flex-col md:flex-row items-center justify-between gap-4 ${isAr ? 'text-right' : 'text-left'}`}>
            <p className={`text-sm text-gray-400 ${isAr ? 'text-arabic-body' : ''}`}>
              © 2026 Tweetly.ai — {isAr ? "جميع الحقوق محفوظة" : "All rights reserved"}
            </p>
            <p className={`text-xs text-gray-500 ${isAr ? 'text-arabic-body' : ''}`}>
              {isAr ? "المدفوعات آمنة عبر Paddle • لا توجد بطاقة ائتمان مطلوبة للخطة المجانية" : "Secure payments via Paddle • No credit card required for the free plan"}
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
