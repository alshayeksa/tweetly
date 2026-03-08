import { pool } from "./db";

/**
 * Runs all safe (IF NOT EXISTS) schema migrations at server startup.
 * New migrations should be appended here — they are idempotent.
 */
export async function runMigrations(): Promise<void> {
  const client = await pool.connect();
  try {
    // ── Voucher tables ──────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS vouchers (
        id               SERIAL PRIMARY KEY,
        code             VARCHAR(50) NOT NULL UNIQUE,
        discount_percent INTEGER NOT NULL,
        expires_at       TIMESTAMP,
        max_uses         INTEGER,
        used_count       INTEGER NOT NULL DEFAULT 0,
        is_active        BOOLEAN NOT NULL DEFAULT TRUE,
        plan             VARCHAR(20),
        created_at       TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS voucher_uses (
        id                SERIAL PRIMARY KEY,
        voucher_id        INTEGER NOT NULL REFERENCES vouchers(id) ON DELETE CASCADE,
        user_id           VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        used_at           TIMESTAMP NOT NULL DEFAULT NOW(),
        plan              VARCHAR(20) NOT NULL,
        original_amount   INTEGER NOT NULL,
        discounted_amount INTEGER NOT NULL
      );
    `);

    // ── Prompt Categories & Templates ───────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS prompt_categories (
        id         SERIAL PRIMARY KEY,
        value      VARCHAR(50) UNIQUE NOT NULL,
        label_ar   VARCHAR(100) NOT NULL,
        label_en   VARCHAR(100) NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS prompt_templates (
        id          SERIAL PRIMARY KEY,
        category_id INTEGER NOT NULL REFERENCES prompt_categories(id) ON DELETE CASCADE,
        title_ar    VARCHAR(200) NOT NULL,
        title_en    VARCHAR(200) NOT NULL,
        prompt_text TEXT NOT NULL,
        language    VARCHAR(10) NOT NULL DEFAULT 'ar',
        is_active   BOOLEAN NOT NULL DEFAULT TRUE,
        sort_order  INTEGER NOT NULL DEFAULT 0,
        created_at  TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    // Seed categories (idempotent)
    await client.query(`
      INSERT INTO prompt_categories (value, label_ar, label_en, sort_order) VALUES
        ('ai_technology',     '🤖 الذكاء الاصطناعي والتقنية', '🤖 AI & Technology',              1),
        ('business',          '💼 الأعمال وريادة الأعمال',     '💼 Business & Entrepreneurship',   2),
        ('marketing',         '📈 التسويق والنمو',             '📈 Marketing & Growth',            3),
        ('finance',           '💵 المال والاستثمار',           '💵 Finance & Investing',           4),
        ('crypto',            '🪙 العملات الرقمية',            '🪙 Crypto & Web3',                 5),
        ('news_politics',     '📰 الأخبار والسياسة',           '📰 News & Politics',               6),
        ('sports',            '⚽ الرياضة',                    '⚽ Sports',                        7),
        ('self_development',  '🧠 التطوير الذاتي',             '🧠 Self Development',              8),
        ('health_fitness',    '🏃 الصحة واللياقة',             '🏃 Health & Fitness',              9),
        ('science',           '🔬 العلوم',                     '🔬 Science',                      10),
        ('saas_startups',     '🚀 الشركات الناشئة',            '🚀 SaaS & Startups',              11),
        ('real_estate',       '🏠 العقارات',                   '🏠 Real Estate',                  12),
        ('productivity',      '⚡ الإنتاجية',                  '⚡ Productivity',                 13),
        ('design_creativity', '🎨 التصميم والإبداع',           '🎨 Design & Creativity',          14),
        ('education',         '📚 التعليم',                    '📚 Education',                    15),
        ('vision_2030',       '🇸🇦 رؤية 2030',                 '🇸🇦 Saudi Vision 2030',            16),
        ('islamic_finance',   '☪️ التمويل الإسلامي',           '☪️ Islamic Finance',              17),
        ('content_creation',  '🎬 صناعة المحتوى',              '🎬 Arabic Content Creation',      18),
        ('gulf_markets',      '🌍 أسواق الخليج',               '🌍 Gulf Markets',                 19),
        ('travel_tourism',    '✈️ السياحة والسفر',              '✈️ Travel & Tourism',             20)
      ON CONFLICT (value) DO NOTHING;
    `);

    // Seed templates (only if none exist yet)
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM prompt_templates LIMIT 1) THEN

          -- 🤖 ai_technology
          INSERT INTO prompt_templates (category_id, title_ar, title_en, prompt_text, language, sort_order)
          SELECT id, 'تحليل تطور الذكاء الاصطناعي', 'AI Progress Analysis',
            'تحليل استراتيجي لآخر تطور في الذكاء الاصطناعي وتأثيره على مستقبل العمل', 'ar', 1
          FROM prompt_categories WHERE value = 'ai_technology';

          INSERT INTO prompt_templates (category_id, title_ar, title_en, prompt_text, language, sort_order)
          SELECT id, 'أداة AI جديدة', 'New AI Tool Spotlight',
            'تغريدة تعريفية بأداة ذكاء اصطناعي جديدة مع أبرز مميزاتها وحالات استخدامها', 'ar', 2
          FROM prompt_categories WHERE value = 'ai_technology';

          INSERT INTO prompt_templates (category_id, title_ar, title_en, prompt_text, language, sort_order)
          SELECT id, 'مستقبل التقنية', 'Future of Tech',
            'تأمل فلسفي وعملي: كيف ستغير التقنية والذكاء الاصطناعي حياتنا في السنوات الخمس القادمة', 'ar', 3
          FROM prompt_categories WHERE value = 'ai_technology';

          -- 💼 business
          INSERT INTO prompt_templates (category_id, title_ar, title_en, prompt_text, language, sort_order)
          SELECT id, 'درس من مؤسس ناجح', 'Founder Lesson',
            'درس واحد استخلصه مؤسس شركة ناجحة من رحلته يمكن تطبيقه في أي مشروع', 'ar', 1
          FROM prompt_categories WHERE value = 'business';

          INSERT INTO prompt_templates (category_id, title_ar, title_en, prompt_text, language, sort_order)
          SELECT id, 'ترند تجاري ناشئ', 'Emerging Business Trend',
            'ترند تجاري ناشئ مع تأثيره المتوقع على السوق وكيف يستفيد منه رواد الأعمال', 'ar', 2
          FROM prompt_categories WHERE value = 'business';

          INSERT INTO prompt_templates (category_id, title_ar, title_en, prompt_text, language, sort_order)
          SELECT id, 'أول خطوة في الريادة', 'First Step in Entrepreneurship',
            'أهم خطوة يجب أن يتخذها أي شخص يريد بدء مشروعه الخاص في 2025', 'ar', 3
          FROM prompt_categories WHERE value = 'business';

          -- 📈 marketing
          INSERT INTO prompt_templates (category_id, title_ar, title_en, prompt_text, language, sort_order)
          SELECT id, 'نصيحة تسويقية قابلة للتطبيق', 'Actionable Marketing Tip',
            'نصيحة تسويقية عملية مع مثال ملموس يمكن تطبيقه فوراً لزيادة المبيعات أو الوعي بالعلامة التجارية', 'ar', 1
          FROM prompt_categories WHERE value = 'marketing';

          INSERT INTO prompt_templates (category_id, title_ar, title_en, prompt_text, language, sort_order)
          SELECT id, 'خطأ تسويقي شائع', 'Common Marketing Mistake',
            'أبرز خطأ تسويقي يرتكبه المبتدئون مع كيفية تجنبه والبديل الأفضل', 'ar', 2
          FROM prompt_categories WHERE value = 'marketing';

          INSERT INTO prompt_templates (category_id, title_ar, title_en, prompt_text, language, sort_order)
          SELECT id, 'استراتيجية نمو', 'Growth Strategy',
            'استراتيجية نمو مثبتة استخدمتها شركة ناجحة لمضاعفة مستخدميها أو إيراداتها', 'ar', 3
          FROM prompt_categories WHERE value = 'marketing';

          -- 💵 finance
          INSERT INTO prompt_templates (category_id, title_ar, title_en, prompt_text, language, sort_order)
          SELECT id, 'نصيحة مالية عملية', 'Practical Finance Tip',
            'نصيحة مالية عملية يمكن لأي شخص تطبيقها لتحسين وضعه المالي أو البدء في الاستثمار', 'ar', 1
          FROM prompt_categories WHERE value = 'finance';

          INSERT INTO prompt_templates (category_id, title_ar, title_en, prompt_text, language, sort_order)
          SELECT id, 'خطأ استثماري شائع', 'Common Investment Mistake',
            'أبرز خطأ يرتكبه المستثمرون المبتدئون وكيف تتجنبه لحماية رأس مالك', 'ar', 2
          FROM prompt_categories WHERE value = 'finance';

          -- 🪙 crypto
          INSERT INTO prompt_templates (category_id, title_ar, title_en, prompt_text, language, sort_order)
          SELECT id, 'تحليل حركة السوق', 'Crypto Market Analysis',
            'تحليل موجز لحركة سوق العملات الرقمية اليوم مع أبرز العوامل المؤثرة', 'ar', 1
          FROM prompt_categories WHERE value = 'crypto';

          INSERT INTO prompt_templates (category_id, title_ar, title_en, prompt_text, language, sort_order)
          SELECT id, 'مفهوم Web3', 'Web3 Concept Explained',
            'شرح مبسط لمفهوم من مفاهيم Web3 أو البلوكشين بطريقة يفهمها أي شخص', 'ar', 2
          FROM prompt_categories WHERE value = 'crypto';

          -- 📰 news_politics
          INSERT INTO prompt_templates (category_id, title_ar, title_en, prompt_text, language, sort_order)
          SELECT id, 'تحليل خبر عاجل', 'Breaking News Analysis',
            'تحليل خبر عاجل من منظور استراتيجي مع تبعاته على المشهد الإقليمي أو العالمي', 'ar', 1
          FROM prompt_categories WHERE value = 'news_politics';

          INSERT INTO prompt_templates (category_id, title_ar, title_en, prompt_text, language, sort_order)
          SELECT id, 'رأي في قرار سياسي', 'Political Decision Opinion',
            'رأي استراتيجي محايد في قرار سياسي أو اقتصادي أثر في المنطقة مع تحليل انعكاساته', 'ar', 2
          FROM prompt_categories WHERE value = 'news_politics';

          -- ⚽ sports
          INSERT INTO prompt_templates (category_id, title_ar, title_en, prompt_text, language, sort_order)
          SELECT id, 'تعليق رياضي تحليلي', 'Sports Analysis Comment',
            'تعليق تحليلي على أبرز حدث رياضي اليوم مع رأي استراتيجي حول أداء الفرق', 'ar', 1
          FROM prompt_categories WHERE value = 'sports';

          INSERT INTO prompt_templates (category_id, title_ar, title_en, prompt_text, language, sort_order)
          SELECT id, 'درس قيادي من رياضي', 'Leadership Lesson from Athlete',
            'درس قيادي يمكن استخلاصه من قصة نجاح رياضي بارز وتطبيقه في الحياة المهنية', 'ar', 2
          FROM prompt_categories WHERE value = 'sports';

          -- 🧠 self_development
          INSERT INTO prompt_templates (category_id, title_ar, title_en, prompt_text, language, sort_order)
          SELECT id, 'عادة تغير الحياة', 'Life-Changing Habit',
            'عادة يومية بسيطة لكنها تغير حياة من يمارسها مع كيفية البدء بها فوراً', 'ar', 1
          FROM prompt_categories WHERE value = 'self_development';

          INSERT INTO prompt_templates (category_id, title_ar, title_en, prompt_text, language, sort_order)
          SELECT id, 'كتاب غير حياتي', 'Life-Changing Book',
            'ملخص موجز لأبرز فكرة من كتاب تطوير ذاتي غير حياة صاحبه مع درس عملي قابل للتطبيق', 'ar', 2
          FROM prompt_categories WHERE value = 'self_development';

          -- 🏃 health_fitness
          INSERT INTO prompt_templates (category_id, title_ar, title_en, prompt_text, language, sort_order)
          SELECT id, 'نصيحة صحية علمية', 'Science-Backed Health Tip',
            'نصيحة صحية مدعومة علمياً يمكن تطبيقها فوراً لتحسين الطاقة أو النوم أو التركيز', 'ar', 1
          FROM prompt_categories WHERE value = 'health_fitness';

          -- 🔬 science
          INSERT INTO prompt_templates (category_id, title_ar, title_en, prompt_text, language, sort_order)
          SELECT id, 'اكتشاف علمي مثير', 'Exciting Scientific Discovery',
            'تغريدة تبسط اكتشافاً علمياً حديثاً وتشرح لماذا يهم حياتنا اليومية', 'ar', 1
          FROM prompt_categories WHERE value = 'science';

          -- 🚀 saas_startups
          INSERT INTO prompt_templates (category_id, title_ar, title_en, prompt_text, language, sort_order)
          SELECT id, 'قصة نجاح ناشئة', 'Startup Success Story',
            'قصة موجزة عن شركة ناشئة نجحت في حل مشكلة حقيقية مع الدرس المستفاد', 'ar', 1
          FROM prompt_categories WHERE value = 'saas_startups';

          INSERT INTO prompt_templates (category_id, title_ar, title_en, prompt_text, language, sort_order)
          SELECT id, 'ميزة SaaS ناجحة', 'Winning SaaS Feature',
            'تحليل ميزة واحدة في منتج SaaS ناجح جعلته لا غنى عنه للمستخدمين', 'ar', 2
          FROM prompt_categories WHERE value = 'saas_startups';

          -- 🏠 real_estate
          INSERT INTO prompt_templates (category_id, title_ar, title_en, prompt_text, language, sort_order)
          SELECT id, 'فرصة عقارية', 'Real Estate Opportunity',
            'تحليل موجز لفرصة استثمارية في السوق العقاري مع العوامل الواجب مراعاتها', 'ar', 1
          FROM prompt_categories WHERE value = 'real_estate';

          -- ⚡ productivity
          INSERT INTO prompt_templates (category_id, title_ar, title_en, prompt_text, language, sort_order)
          SELECT id, 'تقنية إنتاجية فعّالة', 'Productivity Technique',
            'تقنية إنتاجية مثبتة تساعد على إنجاز أكثر في وقت أقل مع خطوات تطبيقها', 'ar', 1
          FROM prompt_categories WHERE value = 'productivity';

          INSERT INTO prompt_templates (category_id, title_ar, title_en, prompt_text, language, sort_order)
          SELECT id, 'أداة توفر الوقت', 'Time-Saving Tool',
            'أداة أو تطبيق يوفر ساعات أسبوعياً مع شرح كيفية استخدامه للاستفادة القصوى', 'ar', 2
          FROM prompt_categories WHERE value = 'productivity';

          -- 🎨 design_creativity
          INSERT INTO prompt_templates (category_id, title_ar, title_en, prompt_text, language, sort_order)
          SELECT id, 'مبدأ تصميم ناجح', 'Design Principle',
            'مبدأ تصميمي واحد تستخدمه أفضل الشركات لجعل منتجاتها أكثر جاذبية وسهولة', 'ar', 1
          FROM prompt_categories WHERE value = 'design_creativity';

          -- 📚 education
          INSERT INTO prompt_templates (category_id, title_ar, title_en, prompt_text, language, sort_order)
          SELECT id, 'طريقة تعلم فعّالة', 'Effective Learning Method',
            'طريقة تعلم مدعومة علمياً تساعد على استيعاب المعلومات وتذكرها بشكل أسرع', 'ar', 1
          FROM prompt_categories WHERE value = 'education';

          -- 🇸🇦 vision_2030
          INSERT INTO prompt_templates (category_id, title_ar, title_en, prompt_text, language, sort_order)
          SELECT id, 'فرصة في رؤية 2030', 'Vision 2030 Opportunity',
            'تسليط الضوء على فرصة استثمارية أو مهنية نابعة من مبادرات رؤية 2030 وكيف تستفيد منها', 'ar', 1
          FROM prompt_categories WHERE value = 'vision_2030';

          INSERT INTO prompt_templates (category_id, title_ar, title_en, prompt_text, language, sort_order)
          SELECT id, 'إنجاز في رؤية 2030', 'Vision 2030 Achievement',
            'إبراز إنجاز ملموس تحقق ضمن مبادرات رؤية 2030 وأثره على الاقتصاد الوطني', 'ar', 2
          FROM prompt_categories WHERE value = 'vision_2030';

          -- ☪️ islamic_finance
          INSERT INTO prompt_templates (category_id, title_ar, title_en, prompt_text, language, sort_order)
          SELECT id, 'مفهوم تمويل إسلامي', 'Islamic Finance Concept',
            'شرح مبسط لمنتج أو مفهوم مالي إسلامي وكيف يختلف عن نظيره التقليدي', 'ar', 1
          FROM prompt_categories WHERE value = 'islamic_finance';

          -- 🎬 content_creation
          INSERT INTO prompt_templates (category_id, title_ar, title_en, prompt_text, language, sort_order)
          SELECT id, 'نصيحة لصانع المحتوى', 'Content Creator Tip',
            'نصيحة عملية لصانع محتوى عربي يريد تنمية حسابه على منصة X أو يوتيوب', 'ar', 1
          FROM prompt_categories WHERE value = 'content_creation';

          INSERT INTO prompt_templates (category_id, title_ar, title_en, prompt_text, language, sort_order)
          SELECT id, 'فكرة محتوى فيروسي', 'Viral Content Idea',
            'فكرة محتوى قابلة للانتشار في السوق العربي مع زاوية مثيرة للاهتمام وغير مستهلكة', 'ar', 2
          FROM prompt_categories WHERE value = 'content_creation';

          -- 🌍 gulf_markets
          INSERT INTO prompt_templates (category_id, title_ar, title_en, prompt_text, language, sort_order)
          SELECT id, 'فرصة في سوق الخليج', 'Gulf Market Opportunity',
            'تحليل فرصة تجارية أو استثمارية في أسواق دول الخليج مع العوامل المحركة للطلب', 'ar', 1
          FROM prompt_categories WHERE value = 'gulf_markets';

          -- ✈️ travel_tourism
          INSERT INTO prompt_templates (category_id, title_ar, title_en, prompt_text, language, sort_order)
          SELECT id, 'وجهة سياحية مميزة', 'Featured Travel Destination',
            'تغريدة جذابة عن وجهة سياحية مميزة مع أبرز ما يجعلها تجربة لا تُنسى', 'ar', 1
          FROM prompt_categories WHERE value = 'travel_tourism';

        END IF;
      END $$;
    `);

    // ── Add amount_sar to subscription_renewals (idempotent) ─────────────────
    await client.query(`
      ALTER TABLE subscription_renewals
        ADD COLUMN IF NOT EXISTS amount_sar INTEGER;
    `);

    // ── Plan Prices ─────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS plan_prices (
        id         SERIAL PRIMARY KEY,
        plan       VARCHAR(20)        NOT NULL,
        currency   VARCHAR(10)        NOT NULL,
        price      DECIMAL(10,2)      NOT NULL,
        is_active  BOOLEAN            NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP          NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP          NOT NULL DEFAULT NOW(),
        UNIQUE(plan, currency)
      );
    `);

    // Seed default prices (idempotent — only inserts if row does not exist)
    await client.query(`
      INSERT INTO plan_prices (plan, currency, price) VALUES
        ('starter',   'SAR', ${process.env.PAYLINK_PRICE_STARTER  ?? 69}),
        ('creator',   'SAR', ${process.env.PAYLINK_PRICE_CREATOR  ?? 149}),
        ('autopilot', 'SAR', ${process.env.PAYLINK_PRICE_PRO      ?? 299}),
        ('starter',   'USD', ${process.env.PLAN_PRICE_USD_STARTER ?? 19}),
        ('creator',   'USD', ${process.env.PLAN_PRICE_USD_CREATOR ?? 39}),
        ('autopilot', 'USD', ${process.env.PLAN_PRICE_USD_PRO     ?? 79})
      ON CONFLICT (plan, currency) DO NOTHING;
    `);

    // ── Login History ────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS login_history (
        id           SERIAL PRIMARY KEY,
        user_id      VARCHAR REFERENCES users(id) ON DELETE SET NULL,
        email        VARCHAR(255),
        method       VARCHAR(20)  NOT NULL,
        status       VARCHAR(20)  NOT NULL,
        ip           VARCHAR(90),
        user_agent   TEXT,
        browser      VARCHAR(50),
        os           VARCHAR(50),
        device       VARCHAR(20),
        country      VARCHAR(100),
        country_code VARCHAR(10),
        city         VARCHAR(100),
        region       VARCHAR(100),
        isp          VARCHAR(200),
        created_at   TIMESTAMP    NOT NULL DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS login_history_user_id_idx ON login_history(user_id);
      CREATE INDEX IF NOT EXISTS login_history_created_at_idx ON login_history(created_at DESC);
    `);

    // ── Rename plan "pro" → "autopilot" in all tables (idempotent) ──────────
    await client.query(`UPDATE users                SET plan = 'autopilot' WHERE plan = 'pro';`);
    await client.query(`UPDATE subscription_renewals SET plan = 'autopilot' WHERE plan = 'pro';`);
    await client.query(`
      UPDATE plan_prices SET plan = 'autopilot' WHERE plan = 'pro';
    `);
    console.log("[migrate] ✅ Schema up to date");
  } catch (err) {
    console.error("[migrate] ❌ Migration failed:", err);
    // Non-fatal: server continues, but log loudly
  } finally {
    client.release();
  }
}
