import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { log } from "./index";
import { isAuthenticated } from "./replit_integrations/auth/replitAuth";
import rateLimit from "express-rate-limit";

// ── Rate Limiters ─────────────────────────────────────────────────────────
const adminLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,                    // 5 attempts per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many login attempts. Please try again in 15 minutes." },
  skipSuccessfulRequests: true,
});

const publicApiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30,             // 30 requests per minute for unauthenticated
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests. Please slow down." },
});

// ── Per-user daily AI generation rate limiter ─────────────────────────────
const DAILY_GEN_LIMITS: Record<string, number> = {
  free: 10, starter: 30, creator: 60, pro: 120,
};
const genCallTracker = new Map<string, { count: number; resetAt: number }>();

function checkGenerationRateLimit(userId: string, plan: string): { allowed: boolean; retryAfterMs: number } {
  const limit = DAILY_GEN_LIMITS[plan] ?? DAILY_GEN_LIMITS.free;
  const now = Date.now();
  const todayMidnight = new Date();
  todayMidnight.setUTCHours(24, 0, 0, 0);
  const resetAt = todayMidnight.getTime();

  let entry = genCallTracker.get(userId);
  if (!entry || now >= entry.resetAt) {
    entry = { count: 0, resetAt };
  }
  if (entry.count >= limit) {
    return { allowed: false, retryAfterMs: entry.resetAt - now };
  }
  entry.count += 1;
  genCallTracker.set(userId, entry);
  return { allowed: true, retryAfterMs: 0 };
}
import { setupAuth } from "./replit_integrations/auth/replitAuth";
import { registerAuthRoutes } from "./replit_integrations/auth/routes";
import { logLoginEvent } from "./auth-logger";
import { insertAutomationSchema, insertScheduledTweetSchema } from "@shared/schema";
import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";
import crypto from "crypto";
import { v4 as uuidv4 } from "uuid";
import { registerPaylinkRoutes } from "./paylink-routes";
import { registerPromptTemplatesRoutes } from "./prompt-templates-routes";
import { isSubscriptionActive, startTrial, checkTweetLimit, incrementTweetsUsed, checkCanUseAutopilot, checkCanUseThreads, checkCanUseAdvancedScheduling } from "./subscription";
import { getAiProvider, improvePromptText, setAiProvider } from "./ai-provider";

const gemini = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

const deepseek = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY || "",
  baseURL: "https://api.deepseek.com/v1",
});

// ── Robust DeepSeek JSON array parser ─────────────────────────────────────────
// DeepSeek sometimes returns a single string containing the raw JSON array,
// especially with Arabic content. This handles all known cases.
function parseDeepSeekTweets(raw: string): string[] {
  const cleaned = raw.replace(/```(?:json)?\s*/g, "").replace(/```\s*/g, "").trim();

  // Helper: strip stray ["..."] wrapper from a single tweet string
  function stripBrackets(s: string): string {
    const t = s.trim();
    if (t.startsWith('["') && t.endsWith('"]')) {
      try { const p = JSON.parse(t); if (Array.isArray(p) && p.length === 1) return String(p[0]).trim(); } catch { /* fall through */ }
    }
    // Remove leading [ and/or trailing ] if they leaked in
    return t.replace(/^\["|"\]$/g, "").trim();
  }

  try {
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) {
      const flat: string[] = [];
      for (const t of parsed) {
        const s = typeof t === "string" ? t.trim() : String(t).trim();
        if (s.startsWith("[") && s.endsWith("]")) {
          try {
            const inner = JSON.parse(s);
            if (Array.isArray(inner)) { flat.push(...inner.map((x: any) => stripBrackets(String(x)))); continue; }
          } catch { /* fall through */ }
        }
        if (s) flat.push(stripBrackets(s));
      }
      return flat.filter(Boolean);
    }
    return [stripBrackets(String(parsed))].filter(Boolean);
  } catch {
    // Greedy regex — find outermost [ ... ]
    const match = cleaned.match(/\[[\s\S]*\]/);
    if (match) {
      try {
        const arr = JSON.parse(match[0]);
        if (Array.isArray(arr)) return arr.map((x: any) => stripBrackets(String(x))).filter(Boolean);
      } catch { /* fall through */ }
    }
    // Last resort: return cleaned text, stripping any bracket wrapper
    return [stripBrackets(cleaned)].filter(Boolean);
  }
}


/** Retry a Gemini call on 429 Resource Exhausted with exponential backoff. */
async function geminiWithRetry<T>(fn: () => Promise<T>, maxRetries = 3, baseDelayMs = 2000): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      const is429 =
        err?.status === 429 ||
        err?.code === 429 ||
        (typeof err?.message === "string" && err.message.includes("429")) ||
        (typeof err?.message === "string" && err.message.toLowerCase().includes("resource exhausted"));
      if (is429 && attempt < maxRetries) {
        const delay = baseDelayMs * Math.pow(2, attempt); // 2s, 4s, 8s
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      throw err;
    }
  }
  throw new Error("geminiWithRetry: exceeded max retries");
}

function getUserId(req: any): string {
  return req.user?.id;
}

// ── Shared AI generation helper ──────────────────────────────────────────────
async function runAITweetGeneration({
  userId,
  userPrompt,
  tweetCount = 5,
  language,
  tone,
  hashtags,
}: {
  userId: string;
  userPrompt: string;
  tweetCount?: number;
  language?: string;
  tone?: string;
  hashtags?: string[];
}): Promise<string[]> {
  const provider = await getAiProvider(userId);
  const needsRealTimeSearch = provider === "gemini" &&
    /news|latest|today|24.hour|current|recent|أخبار|اليوم|الأخير|الأحدث|ساعة/i.test(userPrompt);

  let toneInstruction = "";
  if (tone && tone !== "any") toneInstruction = `\n- Tone: ${tone}`;
  let hashtagInstruction = "";
  if (hashtags && hashtags.length > 0)
    hashtagInstruction = `\n- Include these hashtags where relevant: ${hashtags.map((h) => `#${h}`).join(" ")}`;

  const selectedLanguage = (!language || language === "any") ? "Arabic" : language;
  const isArabic = selectedLanguage === "Arabic";

  const arabicStyleGuide = `أنت خبير استراتيجي للمحتوى على منصة X ولديك باع طويل في كتابة التغريدات الفيروسية.\nمهمتك: كتابة تغريدات عربية تبدو بشرية وإبداعية. قواعد: لغة بيضاء سليمة، خطافات قوية، تنسيق مناسب، بدون مقدمات طويلة. الطول: 200-270 حرف.${toneInstruction}${hashtagInstruction}`;

  const otherLangStyleGuide = `You are a viral X (Twitter) content strategist. Write scroll-stopping, human tweets. Rules: strong hooks, short lines, no AI clichés, 200-270 chars, unique angles per tweet.${toneInstruction}${hashtagInstruction}`;

  const styleGuide = isArabic ? arabicStyleGuide : otherLangStyleGuide;

  const systemInstruction = `${styleGuide}\n\nWrite ONLY in ${selectedLanguage}.\n\nTopic: "${userPrompt.trim()}"\n\nGenerate ${tweetCount} unique, ready-to-publish tweets.\nOutput: raw JSON array only, no markdown. Example: ["tweet1", "tweet2"]`;

  let response: any;
  if (provider === "deepseek") {
    // DeepSeek path — no grounding, same prompt structure
    const completion = await deepseek.chat.completions.create({
      model: "deepseek-chat",
      messages: [{ role: "user", content: systemInstruction }],
      max_tokens: 8192,
      temperature: 1.3,
    });
    const raw = completion.choices[0]?.message?.content || "[]";
    return parseDeepSeekTweets(raw);
  }
  if (needsRealTimeSearch) {
    const groundingResponse = await geminiWithRetry(() => (gemini as any).models.generateContent({
      model: "gemini-2.0-flash",
      contents: `Search recent news (24-48h) about: "${userPrompt.trim()}". List ${tweetCount} verified stories.`,
      config: { tools: [{ googleSearch: {} }], maxOutputTokens: 2048, temperature: 0.3 },
    }));
    response = await geminiWithRetry(() => (gemini as any).models.generateContent({
      model: "gemini-2.0-flash",
      contents: `${systemInstruction}\n\nREAL NEWS:\n${groundingResponse.text || ""}`,
      config: { maxOutputTokens: 8192, temperature: 1.1, topP: 0.97, topK: 50, responseMimeType: "application/json" },
    }));
  } else {
    response = await geminiWithRetry(() => (gemini as any).models.generateContent({
      model: "gemini-2.0-flash",
      contents: systemInstruction,
      config: { maxOutputTokens: 8192, temperature: 1.3, topP: 0.98, topK: 60, responseMimeType: "application/json" },
    }));
  }

  const raw = response.text || "[]";
  let tweets: string[];
  try {
    const cleaned = raw.replace(/```(?:json)?\s*/g, "").replace(/```\s*/g, "").trim();
    tweets = JSON.parse(cleaned);
    if (!Array.isArray(tweets)) tweets = [String(tweets)];
  } catch {
    const match = raw.match(/\[[\s\S]*\]/);
    tweets = match ? (() => { try { return JSON.parse(match[0]); } catch { return [raw.trim()]; } })() : [raw.trim()];
  }
  return tweets.filter(Boolean);
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  await setupAuth(app);
  registerAuthRoutes(app);

  registerPaylinkRoutes(app);
  registerPromptTemplatesRoutes(app);

  // ── Subscription guard middleware ────────────────────────────────────────
  // Free plan users always pass through; limits are enforced at publish time.
  const requireSubscription = async (req: any, res: any, next: any) => {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    try {
      const active = await isSubscriptionActive(userId);
      if (!active) {
        return res.status(402).json({
          message: "Subscription required",
          code: "SUBSCRIPTION_REQUIRED",
        });
      }
      next();
    } catch (err) {
      // If the subscription check itself fails (e.g. DB schema not yet migrated),
      // default to allowing access so users aren't locked out.
      console.error("[requireSubscription] error — defaulting to allow:", err);
      next();
    }
  };

  // Requires Creator or Pro plan for full threads; Free allows up to 3 tweets; Starter blocked
  const requireThreads = async (req: any, res: any, next: any) => {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    try {
      // For generate endpoint, check requested count; for publish check actual thread size
      const requestedCount = req.body?.tweetCount || req.body?.tweets?.length || undefined;
      const check = await checkCanUseThreads(userId, requestedCount);
      if (!check.allowed) {
        return res.status(403).json({
          message: check.message?.en,
          messageAr: check.message?.ar,
          maxTweets: check.maxTweets,
          code: "PLAN_UPGRADE_REQUIRED",
          requiredPlan: "creator",
        });
      }
      // Attach maxTweets to request for downstream use
      req.threadMaxTweets = check.maxTweets;
      next();
    } catch (err) {
      console.error("[requireThreads] error:", err);
      next();
    }
  };

  // ==================== AI GENERATION (IMPROVED) ====================
  app.post("/api/suggestions/generate", isAuthenticated, requireSubscription, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { prompt: userPrompt, count: tweetCountInput, language, tone, hashtags } = req.body;
      const tweetCount = Number(tweetCountInput) || 5;

      if (!userPrompt || typeof userPrompt !== "string" || !userPrompt.trim()) {
        return res.status(400).json({ message: "Prompt is required" });
      }

      // ✅ Check tweet limit before generating
      const limitCheck = await checkTweetLimit(userId);
      if (!limitCheck.allowed) {
        return res.status(402).json({
          message: limitCheck.message?.en,
          messageAr: limitCheck.message?.ar,
          code: "TWEET_LIMIT_REACHED",
        });
      }

      // ✅ Check per-user daily AI generation rate limit
      const rateCheck = checkGenerationRateLimit(userId, limitCheck.plan ?? "free");
      if (!rateCheck.allowed) {
        return res.status(429).json({
          message: "You've reached your daily AI generation limit.\nYour limit will reset tomorrow.\nIf you'd like to keep creating tweets today, you can upgrade your plan for higher daily limits.",
          messageAr: "لقد وصلت إلى الحد اليومي لتوليد التغريدات بالذكاء الاصطناعي.\nسيتم إعادة تعيين الحد غدًا.\nإذا رغبت في الاستمرار بإنشاء التغريدات اليوم، يمكنك الترقية إلى باقة أعلى.",
          code: "GENERATION_RATE_LIMIT",
        });
      }

      // ✅ FIXED: Moved needsRealTimeSearch definition BEFORE usage
      const needsRealTimeSearch = /news|latest|today|24.hour|current|recent|أخبار|اليوم|الأخير|الأحدث|ساعة/i.test(userPrompt);
      const provider = await getAiProvider(userId);

      let toneInstruction = "";
      if (tone && tone !== "any") {
        toneInstruction = `\n- Tone: ${tone}`;
      }
      let hashtagInstruction = "";
      if (hashtags && Array.isArray(hashtags) && hashtags.length > 0) {
        hashtagInstruction = `\n- Include these hashtags where relevant: ${hashtags.map((h: string) => `#${h}`).join(" ")}`;
      }

      const selectedLanguage = (!language || language === "any") ? "Arabic" : language;
      const isArabic = selectedLanguage === "Arabic";

      // ✅ IMPROVED: Enhanced Arabic Style Guide with better hooks and examples
      const arabicStyleGuide = `أنت خبير استراتيجي للمحتوى على منصة X (تويتر) ولديك باع طويل في كتابة التغريدات الفيروسية.
مهمتك: كتابة تغريدات عربية تبدو وكأنها كُتبت بواسطة إنسان مبدع، وليس ذكاءً اصطناعياً.

🎯 قواعد الكتابة الذهبية:
1. اللغة: عربية بيضاء سليمة (ليست فصحى جامدة وليست عامية ركيكة).
2. الخطافات (Hooks): ابدأ دائماً بجملة تخطف الانتباه فوراً (مثال: "90% من الناس يخطئون في..."، "توقفت عن فعل هذا ونجحت..."، "الحقيقة التي لا يخبرك بها أحد عن...").
3. التنسيق:
   - استخدم الأسطر القصيرة لتسهيل القراءة على الجوال.
   - استخدم قائمة نقطية (Bullet points) إذا كان هناك أكثر من فكرة.
   - استخدم إيموجي واحد ذكي في البداية أو النهاية فقط (لا تفرط).
4. الممنوعات الصارمة:
   - ممنوع العبارات الرنانة (مثل: "في عالمنا المتسارع"، "يعد هذا نقلة نوعية").
   - ممنوع علامات التعجب المفرطة (!!!).
   - ممنوع المقدمات الطويلة (ادخل في الصلب مباشرة).
5. الطول: مثالي بين 200-270 حرفاً لاستغلال المساحة دون ملل.
6. الزوايا: اجعل كل تغريدة فريدة (واحدة قصة، واحدة إحصائية، واحدة رأي جريء).

${toneInstruction}
${hashtagInstruction}`;

      // ✅ IMPROVED: Enhanced English Style Guide
      const otherLangStyleGuide = `You are a viral X (Twitter) content strategist with a track record of high-engagement posts.
Task: Write tweets that feel 100% human, authentic, and scroll-stopping.

🎯 Golden Writing Rules:
1. Language: Natural, conversational, professional but not robotic.
2. Hooks: Start with a punchy line (Stats, Contrarian take, "I stopped doing X...", "The truth about...").
3. Formatting:
   - Use short lines for mobile readability.
   - Use bullet points for lists.
   - Max 1-2 emojis, placed strategically.
4. Strictly Forbidden:
   - No AI clichés ("In today's fast-paced world", "Game-changer", "Unlock", "Elevate").
   - No excessive exclamation marks (!!!).
   - No long intros (get to the point immediately).
5. Length: Sweet spot between 200-270 characters.
6. Variety: Ensure each tweet has a unique angle (Story, Data, Hot Take, Tip).

${toneInstruction}
${hashtagInstruction}`;

      const styleGuide = isArabic ? arabicStyleGuide : otherLangStyleGuide;

      // ✅ IMPROVED: Added Few-Shot Examples for better quality
      const examplesSection = `
📚 أمثلة على التغريدات عالية الجودة (Quality Examples):

مثال 1 (إحصائية):
"قرأت 50 كتاباً في الإدارة هذا العام.
90% منها يمكن تلخيصه في 5 مبادئ فقط.
المبدأ الأقوى؟ 'لا تقرر وأنت غاضب'.
البساطة هي الذكاء الحقيقي."

مثال 2 (رأي جريء):
"التوقف عن متابعة 'خبراء' وسائل التواصل كان أفضل قرار إنتاجية اتخذته.
معظم المحتوى ضوضاء.
اقرأ الكتب الأصلية، جرب بنفسك، وثق في حدسك."

مثال 3 (قصة قصيرة):
"قبل 3 سنوات، رفضت عرض عمل بـ 20 ألف ريال.
الجميع قال جننت.
اليوم، مشروعي الخاص يدر 10 أضعاف.
أحياناً الخسارة هي المكسب الأكبر."

⚠️ تذكر: لا تنسخ هذه الأمثلة، بل استخدم أسلوبها وروحها فقط.`;

      // ✅ FIXED: Now needsRealTimeSearch can be used safely here
      const systemInstruction = `${styleGuide}
${examplesSection}

القاعدة الحاسمة: اكتب حصرياً بـ ${selectedLanguage}. أي كتابة بلغة أخرى تعني فشل المهمة.

${needsRealTimeSearch ? `🔍 بحث فوري مطلوب:
يجب البحث في Google عن آخر الأخبار الموثقة (24-48 ساعة) حول موضوع المستخدم.
استخدم قصصاً حقيقية فقط، لا تختلق أخباراً.
` : ""}

موضوع المستخدم:
"""
${userPrompt.trim()}
"""

المطلوب: توليد ${tweetCount} تغريدات مختلفة تماماً وإبداعية.
كل تغريدة يجب أن:
- مكتوبة 100% بـ ${selectedLanguage}
- زاوية فريدة (لا تكرار للأفكار)
- جاهزة للنشر مباشرة دون تعديل
- تحتوي على Hook قوي في أول جملة
${needsRealTimeSearch ? "- مبنية على أخبار حقيقية موثقة\n" : ""}

شكل المخرجات:
مصفوفة JSON خام تحتوي على ${tweetCount} نصوص فقط.
بدون markdown، بدون شرح، بدون \`\`\`json.
مثال: ["التغريدة الأولى", "التغريدة الثانية"]`;

      let response: any;

      if (provider === "deepseek") {
        // DeepSeek path
        const completion = await deepseek.chat.completions.create({
          model: "deepseek-chat",
          messages: [{ role: "user", content: systemInstruction }],
          max_tokens: 8192,
          temperature: 1.3,
        });
        const raw = completion.choices[0]?.message?.content || "[]";
        const tweets = parseDeepSeekTweets(raw);
        const suggestionData = tweets.map((tweet: string) => ({
          content: tweet.trim(), charCount: tweet.trim().length, status: "pending" as const,
          prompt: userPrompt.trim().substring(0, 500),
        }));
        const createdSuggestions = await storage.createSuggestions(userId, suggestionData);
        await storage.logActivity(userId, "generated", "manual", undefined, `Generated ${createdSuggestions.length} manual tweets — "${userPrompt.trim().substring(0, 100)}"`);
        return res.json(createdSuggestions);
      }

      if (needsRealTimeSearch) {
        // Step 1: Use grounding to fetch real news
        const groundingResponse = await geminiWithRetry(() => gemini.models.generateContent({
          model: "gemini-2.0-flash",
          contents: `Search for the most recent and significant news in the last 24-48 hours about: "${userPrompt.trim()}". 
List the top ${tweetCount} most important verified news stories you find. For each story, provide:
- The exact headline
- The company/product/person involved
- The date it was published
- One key strategic implication

Be specific and factual. Only real verified news.`,
          config: {
            tools: [{ googleSearch: {} }],
            maxOutputTokens: 2048,
            temperature: 0.3,
          },
        }));

        const newsContext = groundingResponse.text || "";

        // Step 2: Generate tweets based on real news found
        const tweetPromptWithNews = `${systemInstruction}

REAL NEWS CONTEXT (use ONLY these verified stories, do not invent anything):
"""
${newsContext}
"""

Now generate exactly ${tweetCount} tweets based strictly on the real news above.`;

        response = await geminiWithRetry(() => gemini.models.generateContent({
          model: "gemini-2.0-flash",
          contents: tweetPromptWithNews,
          config: {
            maxOutputTokens: 8192,
            temperature: 1.1,
            topP: 0.97,
            topK: 50,
            responseMimeType: "application/json",
          },
        }));

      } else {
        // ✅ IMPROVED: Optimized AI configuration for better creativity
        response = await geminiWithRetry(() => gemini.models.generateContent({
          model: "gemini-2.0-flash",
          contents: systemInstruction,
          config: {
            maxOutputTokens: 8192,
            temperature: 1.3,      // Increased from 1.2 for more creativity
            topP: 0.98,            // Increased for more vocabulary diversity
            topK: 60,              // Increased for more options
            responseMimeType: "application/json",
          },
        }));
      }

      const content = response.text || "[]";
      let tweets: string[] = parseDeepSeekTweets(content);

      const suggestionData = tweets.map((tweet: string) => ({
        content: tweet.trim(),
        charCount: tweet.trim().length,
        status: "pending" as const,
        prompt: userPrompt.trim().substring(0, 500),
      }));

      const createdSuggestions = await storage.createSuggestions(userId, suggestionData);
      await storage.logActivity(
        userId,
        "generated",
        "manual",
        undefined,
        `Generated ${createdSuggestions.length} manual tweets — "${userPrompt.trim().substring(0, 100)}"`
      );

      res.json(createdSuggestions);
    } catch (error) {
      console.error("Error generating tweets:", error);
      res.status(500).json({ message: "Failed to generate tweets" });
    }
  });

  // Generate tweets for scheduling (returns text[] only — does NOT save to suggestions)
  app.post("/api/ai/generate-for-schedule", isAuthenticated, requireSubscription, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { prompt, count, language, tone, hashtags } = req.body;
      if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
        return res.status(400).json({ message: "Prompt is required" });
      }

      // ✅ Check advanced scheduling plan (Creator+)
      const schedCheck = await checkCanUseAdvancedScheduling(userId);
      if (!schedCheck.allowed) {
        return res.status(403).json({
          message: schedCheck.message?.en,
          messageAr: schedCheck.message?.ar,
          code: "PLAN_UPGRADE_REQUIRED",
        });
      }

      // ✅ Check tweet limit before generating
      const limitCheck = await checkTweetLimit(userId);
      if (!limitCheck.allowed) {
        return res.status(402).json({
          message: limitCheck.message?.en,
          messageAr: limitCheck.message?.ar,
          code: "TWEET_LIMIT_REACHED",
        });
      }
      const tweets = await runAITweetGeneration({
        userId: getUserId(req),
        userPrompt: prompt,
        tweetCount: Number(count) || 3,
        language,
        tone,
        hashtags,
      });
      res.json({ tweets });
    } catch (error) {
      console.error("Error generating tweets for schedule:", error);
      res.status(500).json({ message: "Failed to generate tweets" });
    }
  });

  // ==================== IMPROVE PROMPT ====================
  app.post("/api/prompt/improve", isAuthenticated, requireSubscription, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { prompt: userPrompt } = req.body;

      if (!userPrompt || typeof userPrompt !== "string" || !userPrompt.trim()) {
        return res.status(400).json({ message: "Prompt is required" });
      }

      // ✅ Check daily AI generation rate limit
      const limitCheck = await checkTweetLimit(userId);
      const rateCheck = checkGenerationRateLimit(userId, limitCheck.plan ?? "free");
      if (!rateCheck.allowed) {
        return res.status(429).json({
          message: "You've reached your daily AI generation limit.\nYour limit will reset tomorrow.\nIf you'd like to keep creating tweets today, you can upgrade your plan for higher daily limits.",
          messageAr: "لقد وصلت إلى الحد اليومي لتوليد التغريدات بالذكاء الاصطناعي.\nسيتم إعادة تعيين الحد غدًا.\nإذا رغبت في الاستمرار بإنشاء التغريدات اليوم، يمكنك الترقية إلى باقة أعلى.",
          code: "GENERATION_RATE_LIMIT",
        });
      }

      const improved = await improvePromptText(userId, userPrompt);
      res.json({ improvedPrompt: improved });
    } catch (error) {
      console.error("Error improving prompt:", error);
      res.status(500).json({ message: "Failed to improve prompt" });
    }
  });

  // ==================== AI PROVIDER SETTINGS ====================
  app.get("/api/settings/ai-provider", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const provider = await getAiProvider(userId);
      res.json({ provider });
    } catch (error) {
      res.status(500).json({ message: "Failed to get AI provider" });
    }
  });

  app.patch("/api/settings/ai-provider", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { provider } = req.body;
      if (provider !== "gemini" && provider !== "deepseek") {
        return res.status(400).json({ message: "Invalid provider. Must be 'gemini' or 'deepseek'" });
      }
      await setAiProvider(userId, provider);
      res.json({ provider });
    } catch (error) {
      res.status(500).json({ message: "Failed to update AI provider" });
    }
  });

  // ==================== SUGGESTIONS ====================
  app.get("/api/suggestions", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const status = req.query.status as string | undefined;
      const suggestionsList = await storage.getSuggestions(userId, status);
      res.json(suggestionsList);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch suggestions" });
    }
  });

  const VALID_STATUSES = ["pending", "approved", "rejected"];

  app.patch("/api/suggestions/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { status, editedContent } = req.body;
      if (!status || !VALID_STATUSES.includes(status)) {
        return res.status(400).json({ message: `Status must be one of: ${VALID_STATUSES.join(", ")}` });
      }

      const suggestion = await storage.updateSuggestionStatus(
        Number(req.params.id),
        userId,
        status,
        editedContent
      );
      if (!suggestion) return res.status(404).json({ message: "Suggestion not found" });

      await storage.logActivity(
        userId,
        status,
        "manual",
        suggestion.id,
        `${status} manual tweet`
      );

      res.json(suggestion);
    } catch (error) {
      res.status(500).json({ message: "Failed to update suggestion" });
    }
  });

  app.delete("/api/suggestions/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const suggestion = await storage.getSuggestion(Number(req.params.id), userId);
      if (!suggestion) return res.status(404).json({ message: "Suggestion not found" });

      await storage.updateSuggestionStatus(Number(req.params.id), userId, "rejected");
      await storage.logActivity(userId, "deleted", "suggestion", suggestion.id, "Deleted suggestion");
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete suggestion" });
    }
  });

  // ==================== PUBLISH TO X ====================
  app.post("/api/suggestions/:id/publish", isAuthenticated, requireSubscription, async (req, res) => {
    try {
      const userId = getUserId(req);
      
      // ✅ Check monthly tweet limit (free plan: 25/month)
      const limitCheck = await checkTweetLimit(userId);
      if (!limitCheck.allowed) {
        return res.status(402).json({
          message: limitCheck.message?.en,
          messageAr: limitCheck.message?.ar,
          code: "TWEET_LIMIT_REACHED"
        });
      }

      const suggestion = await storage.getSuggestion(Number(req.params.id), userId);
      if (!suggestion) return res.status(404).json({ message: "Suggestion not found" });

      if (suggestion.status === "published" || suggestion.status === "rejected") {
        return res.status(400).json({ message: "This tweet cannot be published" });
      }

      const xToken = await storage.getXToken(userId);
      if (!xToken) {
        return res.status(401).json({ message: "X account not connected. Please connect your X account in Settings.", code: "X_RECONNECT_REQUIRED" });
      }

      if (xToken.connectionStatus === "needs_reconnect") {
        return res.status(401).json({ message: "X token expired. Please reconnect your X account in Settings.", code: "X_RECONNECT_REQUIRED" });
      }

      const tweetText = suggestion.editedContent || suggestion.content;
      let accessToken = xToken.accessToken;

      // Proactively refresh when token expires within 5 minutes (not just after it expires)
      const FIVE_MINUTES_MS = 5 * 60 * 1000;
      const expiryTime = xToken.expiresAt ? new Date(xToken.expiresAt).getTime() : null;
      const needsRefresh = expiryTime !== null && expiryTime - Date.now() < FIVE_MINUTES_MS;

      if (needsRefresh && xToken.refreshToken) {
        try {
          const clientId = process.env.X_CLIENT_ID!;
          const clientSecret = process.env.X_CLIENT_SECRET!;
          const refreshResponse = await fetch("https://api.x.com/2/oauth2/token", {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
              Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
            },
            body: new URLSearchParams({
              grant_type: "refresh_token",
              refresh_token: xToken.refreshToken,
            }),
          });

          if (refreshResponse.ok) {
            const refreshData: any = await refreshResponse.json();
            accessToken = refreshData.access_token;
            const newExpiresAt = refreshData.expires_in
              ? new Date(Date.now() + refreshData.expires_in * 1000)
              : undefined;
            // Guard against undefined RT: if X didn't rotate, keep the existing refresh token
            await storage.saveXToken(
              userId,
              refreshData.access_token,
              refreshData.refresh_token ?? xToken.refreshToken ?? undefined,
              newExpiresAt,
              xToken.xUsername || undefined
            );
          } else {
            console.error("Token refresh failed:", await refreshResponse.text());
            await storage.markUserNeedsReconnect(userId);
            return res.status(401).json({ message: "X token expired. Please reconnect your X account in Settings.", code: "X_RECONNECT_REQUIRED" });
          }
        } catch (refreshErr) {
          console.error("Token refresh error:", refreshErr);
          return res.status(401).json({ message: "X token expired. Please reconnect your X account in Settings.", code: "X_RECONNECT_REQUIRED" });
        }
      } else if (needsRefresh && !xToken.refreshToken) {
        await storage.markUserNeedsReconnect(userId);
        return res.status(401).json({ message: "X token expired. Please reconnect your X account in Settings.", code: "X_RECONNECT_REQUIRED" });
      }

      const payload: any = { text: tweetText };

      const tweetResponse = await fetch("https://api.x.com/2/tweets", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!tweetResponse.ok) {
        const errorBody = await tweetResponse.text();
        console.error("X API error:", tweetResponse.status, errorBody);

        if (tweetResponse.status === 401) {
          await storage.markUserNeedsReconnect(userId);
          return res.status(401).json({ message: "X session expired. Please reconnect your X account in Settings.", code: "X_RECONNECT_REQUIRED" });
        }
        if (tweetResponse.status === 403) {
          // 403 almost always means the OAuth token was issued without tweet.write scope
          // (happens when user signed in with read-only scope). Mark needs_reconnect so
          // the app shows the reconnect banner instead of a cryptic developer portal message.
          await storage.markUserNeedsReconnect(userId);
          return res.status(401).json({
            message: "Your X connection needs to be refreshed to allow posting. Please reconnect your X account in Settings.",
            code: "X_RECONNECT_REQUIRED",
          });
        }
        if (tweetResponse.status === 429) {
          return res.status(429).json({ message: "Too many requests. Please wait a moment and try again." });
        }
        return res.status(500).json({ message: `Failed to publish to X: ${errorBody}` });
      }

      const tweetData: any = await tweetResponse.json();
      const xPostId = tweetData.data?.id || "unknown";

      const published = await storage.publishSuggestion(
        Number(req.params.id),
        userId,
        xPostId
      );

      await storage.logActivity(
        userId,
        "published",
        "manual",
        suggestion.id,
        `Published manual tweet to X (Post ID: ${xPostId})`
      );

      // Increment monthly usage counter
      await incrementTweetsUsed(userId);

      res.json(published);
    } catch (error: any) {
      console.error("Error publishing to X:", error);
      res.status(500).json({ message: `Failed to publish to X: ${error?.message || String(error)}` });
    }
  });

  // ==================== THREADS (IMPROVED) ====================
  app.post("/api/threads/generate", isAuthenticated, requireThreads, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { prompt: userPrompt, language, tone } = req.body;

      if (!userPrompt || typeof userPrompt !== "string" || !userPrompt.trim()) {
        return res.status(400).json({ message: "Prompt is required" });
      }

      // ✅ Check tweet limit before generating thread
      const limitCheck = await checkTweetLimit(userId);
      if (!limitCheck.allowed) {
        return res.status(402).json({
          message: limitCheck.message?.en,
          messageAr: limitCheck.message?.ar,
          code: "TWEET_LIMIT_REACHED",
        });
      }

      const languageInstruction = language && language !== "any" ? `Language: Write ALL tweets in ${language}.` : "";
      const toneInstruction = tone && tone !== "any" ? `Tone: Use a ${tone} tone throughout.` : "";

      const prompt = `You are a world-class social media strategist and content curator specializing in high-engagement X (Twitter) content.

Avoid asking rhetorical questions like 'Are you ready?'. Instead, make bold statements. Use 'Counter-Intuitive' insights that challenge the common belief.

USER INSTRUCTION:
"""
${userPrompt.trim()}
"""
${languageInstruction}
${toneInstruction}

CRITICAL GUIDELINES FOR THREADS:
1. Provide a series of connected tweets that form a coherent hierarchical thread.
2. The first tweet MUST be the main topic/hook that grabs attention.
3. Subsequent tweets must be sub-points providing deep analysis or valuable insights.
4. Each tweet MUST be between 100 and 150 characters. No exceptions.
5. ADHERENCE: Follow the user's specific instructions for language (if Arabic, use high-quality Arabic), tone, and style.
6. QUALITY: Ensure each tweet is independent in meaning but contributes to the overall depth.
7. Use strategic emojis and relevant hashtags.

OUTPUT FORMAT:
Return ONLY a raw JSON array of strings, where each string is a tweet in the thread.
CRITICAL: Do NOT wrap the output in markdown code blocks. Do NOT use \`\`\`json or \`\`\`. Return the raw JSON array directly.
Example: ["Main Tweet (100-150 chars)", "Sub Tweet 1 (100-150 chars)", "Sub Tweet 2 (100-150 chars)"]`;

      const response = await geminiWithRetry(() => gemini.models.generateContent({
        model: "gemini-2.0-flash",
        contents: `${prompt}\n\nUSER PROMPT: ${userPrompt.trim()}`,
        config: { maxOutputTokens: 8192, temperature: 1.0, topP: 0.95, responseMimeType: "application/json" },
      }));

      const content = response.text || "[]";
      let tweets: string[] = parseDeepSeekTweets(content);

      // Enforce thread tweet limit based on plan
      const maxTweets = (req as any).threadMaxTweets || 999;
      if (tweets.length > maxTweets) {
        tweets = tweets.slice(0, maxTweets);
      }

      const threadId = uuidv4();
      const suggestionData = tweets.map((tweet: string, index: number) => ({
        content: tweet.trim(),
        charCount: tweet.trim().length,
        status: "pending" as const,
        prompt: userPrompt.trim().substring(0, 500),
        threadId,
        threadOrder: index,
      }));

      const createdSuggestions = await storage.createSuggestions(userId, suggestionData);
      await storage.logActivity(userId, "generated", "thread", undefined, `Generated thread with ${createdSuggestions.length} tweets`);

      res.json(createdSuggestions);
    } catch (error) {
      console.error("Error generating thread:", error);
      res.status(500).json({ message: "Failed to generate thread" });
    }
  });

  app.post("/api/threads/:threadId/publish", isAuthenticated, requireThreads, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { threadId } = req.params;
      
      // ✅ Check monthly tweet limit (free plan: 25/month)
      const limitCheck = await checkTweetLimit(userId);
      if (!limitCheck.allowed) {
        return res.status(402).json({
          message: limitCheck.message?.en,
          messageAr: limitCheck.message?.ar,
          code: "TWEET_LIMIT_REACHED"
        });
      }

      const suggestionsList = await storage.getSuggestions(userId);
      const threadItems = suggestionsList
        .filter(s => s.threadId === threadId)
        .sort((a, b) => (a.threadOrder || 0) - (b.threadOrder || 0));

      if (threadItems.length === 0) {
        return res.status(404).json({ message: "Thread not found" });
      }

      const xToken = await storage.getXToken(userId);
      if (!xToken) {
        return res.status(401).json({ message: "X account not connected. Please connect your X account in Settings.", code: "X_RECONNECT_REQUIRED" });
      }

      if (xToken.connectionStatus === "needs_reconnect") {
        return res.status(401).json({ message: "X token expired. Please reconnect your X account in Settings.", code: "X_RECONNECT_REQUIRED" });
      }

      let accessToken = xToken.accessToken;

      // Proactively refresh when token expires within 5 minutes (not just after it expires)
      const FIVE_MINUTES_MS_THREAD = 5 * 60 * 1000;
      const expiryTimeThread = xToken.expiresAt ? new Date(xToken.expiresAt).getTime() : null;
      const needsRefreshThread = expiryTimeThread !== null && expiryTimeThread - Date.now() < FIVE_MINUTES_MS_THREAD;

      if (needsRefreshThread && xToken.refreshToken) {
        try {
          const clientId = process.env.X_CLIENT_ID!;
          const clientSecret = process.env.X_CLIENT_SECRET!;
          const refreshResponse = await fetch("https://api.x.com/2/oauth2/token", {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
              Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
            },
            body: new URLSearchParams({
              grant_type: "refresh_token",
              refresh_token: xToken.refreshToken,
            }),
          });

          if (refreshResponse.ok) {
            const refreshData: any = await refreshResponse.json();
            accessToken = refreshData.access_token;
            const newExpiresAt = refreshData.expires_in
              ? new Date(Date.now() + refreshData.expires_in * 1000)
              : undefined;
            // Guard against undefined RT: if X didn't rotate, keep the existing refresh token
            await storage.saveXToken(
              userId,
              refreshData.access_token,
              refreshData.refresh_token ?? xToken.refreshToken ?? undefined,
              newExpiresAt,
              xToken.xUsername || undefined
            );
          } else {
            await storage.markUserNeedsReconnect(userId);
            return res.status(401).json({ message: "X token expired. Please reconnect your X account in Settings.", code: "X_RECONNECT_REQUIRED" });
          }
        } catch (refreshErr) {
          console.error("Token refresh error:", refreshErr);
          return res.status(401).json({ message: "X token expired. Please reconnect your X account in Settings.", code: "X_RECONNECT_REQUIRED" });
        }
      } else if (needsRefreshThread && !xToken.refreshToken) {
        await storage.markUserNeedsReconnect(userId);
        return res.status(401).json({ message: "X token expired. Please reconnect your X account in Settings.", code: "X_RECONNECT_REQUIRED" });
      }

      let lastTweetId: string | undefined;

      for (let i = 0; i < threadItems.length; i++) {
        const item = threadItems[i];
        const tweetText = item.editedContent || item.content;
        
        const payload: any = { text: tweetText };
        if (lastTweetId) {
          payload.reply = { in_reply_to_tweet_id: lastTweetId };
        }

        const tweetResponse = await fetch("https://api.x.com/2/tweets", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });

        if (!tweetResponse.ok) {
          const errText = await tweetResponse.text();
          if (tweetResponse.status === 401) {
            await storage.markUserNeedsReconnect(userId);
            return res.status(401).json({ message: "X session expired. Please reconnect your X account in Settings.", code: "X_RECONNECT_REQUIRED" });
          }
          if (tweetResponse.status === 403) {
            await storage.markUserNeedsReconnect(userId);
            return res.status(401).json({
              message: "Your X connection needs to be refreshed to allow posting. Please reconnect your X account in Settings.",
              code: "X_RECONNECT_REQUIRED",
            });
          }
          throw new Error(`Failed to publish tweet ${i + 1}: ${errText}`);
        }

        const tweetData: any = await tweetResponse.json();
        lastTweetId = tweetData.data.id;
        
        await storage.publishSuggestion(item.id, userId, lastTweetId!);
      }

      // Increment monthly usage counter for each tweet in the thread
      await incrementTweetsUsed(userId, threadItems.length);

      res.json({ success: true });
    } catch (error: any) {
      console.error("Error publishing thread:", error);
      res.status(500).json({ message: error.message || "Failed to publish thread" });
    }
  });

  // ==================== X OAUTH2 ====================
  app.get("/api/x/auth-url", isAuthenticated, async (req, res) => {
    try {
      const clientId = process.env.X_CLIENT_ID;
      if (!clientId) {
        return res.status(500).json({ message: "X API credentials not configured" });
      }

      const state = crypto.randomBytes(32).toString("hex");
      const codeVerifier = crypto.randomBytes(32).toString("base64url");
      const codeChallenge = crypto
        .createHash("sha256")
        .update(codeVerifier)
        .digest("base64url");

      const redirectUri = process.env.X_CALLBACK_URL || `${req.headers["x-forwarded-proto"] || req.protocol}://${req.headers.host}/api/x/callback`;

      (req.session as any).xOAuthState = state;
      (req.session as any).xCodeVerifier = codeVerifier;

      const params = new URLSearchParams({
        response_type: "code",
        client_id: clientId,
        redirect_uri: redirectUri,
        scope: "tweet.read tweet.write users.read offline.access media.write",
        state,
        code_challenge: codeChallenge,
        code_challenge_method: "S256",
      });

      res.json({ url: `https://x.com/i/oauth2/authorize?${params}` });
    } catch (error) {
      console.error("Error generating X auth URL:", error);
      res.status(500).json({ message: "Failed to generate auth URL" });
    }
  });

  app.get("/api/x/callback", async (req, res) => {
    try {
      const { code, state } = req.query;
      const authPurpose = (req.session as any)?.xAuthPurpose; // "signin" or undefined (connect)

      if (authPurpose === "signin") {
        // ── Sign-in flow ──────────────────────────────────────────────────────
        const savedState = (req.session as any).xSigninState;
        const codeVerifier = (req.session as any).xSigninCodeVerifier;

        if (!code || !state || state !== savedState) {
          return res.redirect("/login?error=x_state_mismatch");
        }

        const { X_CLIENT_ID, X_CLIENT_SECRET, X_CALLBACK_URL } = process.env;
        const callbackUrl = X_CALLBACK_URL ||
          `${req.headers["x-forwarded-proto"] || req.protocol}://${req.headers.host}/api/x/callback`;

        const tokenResponse = await fetch("https://api.x.com/2/oauth2/token", {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Authorization: `Basic ${Buffer.from(`${X_CLIENT_ID}:${X_CLIENT_SECRET}`).toString("base64")}`,
          },
          body: new URLSearchParams({
            grant_type: "authorization_code",
            code: code as string,
            redirect_uri: callbackUrl,
            code_verifier: codeVerifier,
          }),
        });

        const tokenData: any = await tokenResponse.json();
        if (!tokenData.access_token) return res.redirect("/login?error=x_token_failed");

        const meResponse = await fetch("https://api.x.com/2/users/me", {
          headers: { Authorization: `Bearer ${tokenData.access_token}` },
        });
        const meData: any = await meResponse.json();
        const xAuthId: string = meData.data?.id;
        const xUsername: string = meData.data?.username;
        const xName: string | undefined = meData.data?.name;

        if (!xAuthId) return res.redirect("/login?error=x_profile_failed");

        const { db } = await import("./db");
        const { users } = await import("@shared/models/auth");
        const { eq } = await import("drizzle-orm");
        const { startTrial } = await import("./subscription");
        const { nanoid } = await import("nanoid");

        let [user] = await db.select().from(users).where(eq(users.xAuthId, xAuthId));
        if (!user && xUsername) {
          [user] = await db.select().from(users).where(eq(users.xUsername, xUsername));
        }

        if (user) {
          const updates: any = { xAuthId, xUsername, updatedAt: new Date() };
          if (!user.firstName && xName) updates.firstName = xName.split(" ")[0];
          if (!user.lastName && xName?.includes(" ")) updates.lastName = xName.split(" ").slice(1).join(" ");
          await db.update(users).set(updates).where(eq(users.id, user.id));
          Object.assign(user, updates);
        } else {
          const nameParts = xName?.split(" ") || [];
          const [newUser] = await db.insert(users).values({
            id: nanoid(),
            xAuthId,
            xUsername: xUsername || null,
            firstName: nameParts[0] || null,
            lastName: nameParts.slice(1).join(" ") || null,
          }).returning();
          user = newUser;
          await startTrial(user.id);
        }

        const expiresAt = tokenData.expires_in
          ? new Date(Date.now() + tokenData.expires_in * 1000)
          : undefined;
        await storage.saveXToken(user.id, tokenData.access_token, tokenData.refresh_token, expiresAt, xUsername);

        delete (req.session as any).xSigninState;
        delete (req.session as any).xSigninCodeVerifier;
        delete (req.session as any).xAuthPurpose;

        req.login(user, (err) => {
          if (err) return res.redirect("/login?error=x_login_failed");
          logLoginEvent({ req, userId: user.id, email: user.email ?? null, method: "x", status: "success" });
          res.redirect("/");
        });

      } else {
        // ── Connect account flow ──────────────────────────────────────────────
        const userId = getUserId(req);
        if (!userId) {
          return res.redirect("/settings?error=not_authenticated");
        }

        const savedState = (req.session as any)?.xOAuthState;
        const codeVerifier = (req.session as any)?.xCodeVerifier;

        if (!code || !state || state !== savedState) {
          return res.redirect("/settings?error=invalid_state");
        }

        const clientId = process.env.X_CLIENT_ID!;
        const clientSecret = process.env.X_CLIENT_SECRET!;
        const redirectUri = process.env.X_CALLBACK_URL ||
          `${req.headers["x-forwarded-proto"] || req.protocol}://${req.headers.host}/api/x/callback`;

        const tokenResponse = await fetch("https://api.x.com/2/oauth2/token", {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
          },
          body: new URLSearchParams({
            code: code as string,
            grant_type: "authorization_code",
            redirect_uri: redirectUri,
            code_verifier: codeVerifier,
          }),
        });

        if (!tokenResponse.ok) {
          console.error("Token exchange failed:", await tokenResponse.text());
          return res.redirect("/settings?error=token_exchange_failed");
        }

        const tokenData: any = await tokenResponse.json();

        let xUsername: string | undefined;
        let xAuthId: string | undefined;
        try {
          const meResponse = await fetch("https://api.x.com/2/users/me", {
            headers: { Authorization: `Bearer ${tokenData.access_token}` },
          });
          if (meResponse.ok) {
            const meData: any = await meResponse.json();
            xUsername = meData.data?.username;
            xAuthId = meData.data?.id;
          }
        } catch {}

        // Block if this X account is already linked to a different Tweetly user
        if (xAuthId) {
          const { db } = await import("./db");
          const { users } = await import("@shared/models/auth");
          const { eq, and, ne } = await import("drizzle-orm");
          const existingUser = await db
            .select({ id: users.id })
            .from(users)
            .where(and(eq(users.xAuthId, xAuthId), ne(users.id, userId)))
            .limit(1);
          if (existingUser.length > 0) {
            delete (req.session as any).xOAuthState;
            delete (req.session as any).xCodeVerifier;
            return res.redirect("/settings?error=x_already_connected");
          }
        }

        const expiresAt = tokenData.expires_in
          ? new Date(Date.now() + tokenData.expires_in * 1000)
          : undefined;

        await storage.saveXToken(
          userId,
          tokenData.access_token,
          tokenData.refresh_token,
          expiresAt,
          xUsername
        );

        if (xUsername || xAuthId) {
          const { db } = await import("./db");
          const { users } = await import("@shared/models/auth");
          const { eq } = await import("drizzle-orm");
          const updateFields: Record<string, any> = {};
          if (xUsername) updateFields.xUsername = xUsername;
          if (xAuthId) updateFields.xAuthId = xAuthId;
          await db.update(users).set(updateFields).where(eq(users.id, userId));
        }

        await storage.logActivity(userId, "connected", "x_account", undefined, `Connected X account: @${xUsername || "unknown"}`);

        // Resume any automations that stalled due to the previous X token expiry
        try {
          const { resumeAutomationsForUser } = await import("./automation-runner");
          await resumeAutomationsForUser(userId);
        } catch {}

        delete (req.session as any).xOAuthState;
        delete (req.session as any).xCodeVerifier;

        res.redirect("/settings?success=connected");
      }
    } catch (error) {
      console.error("X OAuth callback error:", error);
      const purpose = (req.session as any)?.xAuthPurpose;
      res.redirect(purpose === "signin" ? "/login?error=x_failed" : "/settings?error=callback_failed");
    }
  });

  app.get("/api/x/status", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const token = await storage.getXToken(userId);
      // A token that needs reconnect is treated as "not connected" so the
      // XConnectionBanner surfaces immediately without requiring a failed publish.
      const needsReconnect = token?.connectionStatus === "needs_reconnect";
      res.json({
        connected: !!token && !needsReconnect,
        needsReconnect,
        username: token?.xUsername || null,
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to check X status" });
    }
  });

  app.post("/api/x/disconnect", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      await storage.deleteXToken(userId);
      await storage.logActivity(userId, "disconnected", "x_account");
      // Clear cached xUsername from users table
      const { db } = await import("./db");
      const { users } = await import("@shared/models/auth");
      const { eq } = await import("drizzle-orm");
      await db.update(users).set({ xUsername: null }).where(eq(users.id, userId));
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to disconnect" });
    }
  });

  // ==================== AUTOMATIONS ====================
  app.get("/api/automations", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const list = await storage.getAutomations(userId);
      res.json(list);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch automations" });
    }
  });

  app.post("/api/automations", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);

      // Autopilot is a Pro-only feature
      const autopilotCheck = await checkCanUseAutopilot(userId);
      if (!autopilotCheck.allowed) {
        return res.status(403).json({
          message: autopilotCheck.message?.en,
          messageAr: autopilotCheck.message?.ar,
          code: "PLAN_UPGRADE_REQUIRED",
          requiredPlan: "pro",
        });
      }

      const parsed = insertAutomationSchema.parse(req.body);
      const automation = await storage.createAutomation(userId, parsed);
      
      if (automation.active) {
        const nextRun = new Date();
        await storage.addToQueue(userId, automation.id, nextRun);
        console.log(`${new Date().toLocaleTimeString()} [automation] Automatically scheduled first run for active automation: ${automation.name}`);
      }
      
      await storage.logActivity(userId, "created", "automation", automation.id, `Created automation: ${automation.name}`);
      res.status(201).json(automation);
    } catch (error: any) {
      console.error("Error creating automation:", error);
      if (error.name === "ZodError") {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create automation" });
    }
  });

  app.patch("/api/automations/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const oldAutomation = await storage.getAutomation(Number(req.params.id), userId);

      // If trying to unpause (active: false → true), check plan + tweet limit
      if (req.body.active === true && !oldAutomation?.active) {
        const autopilotCheck = await checkCanUseAutopilot(userId);
        if (!autopilotCheck.allowed) {
          return res.status(403).json({
            message: autopilotCheck.message?.en,
            messageAr: autopilotCheck.message?.ar,
            code: "PLAN_UPGRADE_REQUIRED",
            requiredPlan: "pro",
          });
        }
        const limitCheck = await checkTweetLimit(userId);
        if (!limitCheck.allowed) {
          return res.status(402).json({
            message: limitCheck.message?.en,
            messageAr: limitCheck.message?.ar,
            code: "TWEET_LIMIT_REACHED",
          });
        }
      }

      const automation = await storage.updateAutomation(Number(req.params.id), userId, req.body);
      if (!automation) return res.status(404).json({ message: "Automation not found" });

      if (automation.active && !oldAutomation?.active) {
        const queue = await storage.getAutomationQueue(automation.id, userId);
        if (queue.length === 0) {
          const nextRun = new Date();
          await storage.addToQueue(userId, automation.id, nextRun);
        }
      }

      if (req.body.intervalMinutes) {
        await storage.clearPendingQueue(automation.id);
        const nextRun = new Date(Date.now() + automation.intervalMinutes * 60 * 1000);
        await storage.addToQueue(userId, automation.id, nextRun);
      }

      await storage.logActivity(userId, "updated", "automation", automation.id, `Updated automation: ${automation.name}`);
      res.json(automation);
    } catch (error) {
      res.status(500).json({ message: "Failed to update automation" });
    }
  });

  app.delete("/api/automations/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const deleted = await storage.deleteAutomation(Number(req.params.id), userId);
      if (!deleted) return res.status(404).json({ message: "Automation not found" });
      await storage.logActivity(userId, "deleted", "automation", Number(req.params.id), "Deleted automation");
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete automation" });
    }
  });

  app.get("/api/automations/:id/queue", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const queue = await storage.getAutomationQueue(Number(req.params.id), userId);
      res.json(queue);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch queue" });
    }
  });

  app.get("/api/automations/:id/history", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const history = await storage.getAutomationHistory(Number(req.params.id), userId);
      res.json(history);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch history" });
    }
  });

  // ==================== DASHBOARD ====================
  app.get("/api/dashboard", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const stats = await storage.getDashboardStats(userId);
      const recentActivity = await storage.getActivityLog(userId, 10);
      res.json({ stats, recentActivity });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch dashboard" });
    }
  });

  // ==================== SCHEDULED TWEETS ====================
  app.get("/api/scheduled-tweets", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const list = await storage.getScheduledTweets(userId);
      res.json(list);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch scheduled tweets" });
    }
  });

  app.post("/api/scheduled-tweets", isAuthenticated, requireSubscription, async (req, res) => {
    try {
      const userId = getUserId(req);
      const parsed = insertScheduledTweetSchema.parse(req.body);
      const item = await storage.createScheduledTweet(userId, parsed);
      await storage.logActivity(userId, "scheduled", "scheduled_tweet", item.id, `Scheduled tweet for ${new Date(item.scheduledAt).toISOString()}`);
      res.status(201).json(item);
    } catch (error: any) {
      if (error.name === "ZodError") return res.status(400).json({ message: "Invalid data", errors: error.errors });
      res.status(500).json({ message: "Failed to schedule tweet" });
    }
  });

  app.patch("/api/scheduled-tweets/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { content, scheduledAt } = req.body;
      const item = await storage.getScheduledTweet(Number(req.params.id), userId);
      if (!item) return res.status(404).json({ message: "Scheduled tweet not found" });
      if (item.status !== "pending") return res.status(400).json({ message: "Only pending tweets can be edited" });
      const updated = await storage.updateScheduledTweet(Number(req.params.id), userId, {
        ...(content !== undefined && { content }),
        ...(scheduledAt !== undefined && { scheduledAt: new Date(scheduledAt) }),
      });
      res.json(updated);
    } catch (error) {
      res.status(500).json({ message: "Failed to update scheduled tweet" });
    }
  });

  app.delete("/api/scheduled-tweets/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const item = await storage.getScheduledTweet(Number(req.params.id), userId);
      if (!item) return res.status(404).json({ message: "Scheduled tweet not found" });
      if (item.status === "published") return res.status(400).json({ message: "Cannot delete a published tweet" });
      await storage.deleteScheduledTweet(Number(req.params.id), userId);
      await storage.logActivity(userId, "deleted", "scheduled_tweet", item.id, "Deleted scheduled tweet");
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete scheduled tweet" });
    }
  });

  // ==================== ACTIVITY LOG ====================
  app.get("/api/activity", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const limit = req.query.limit ? Number(req.query.limit) : 50;
      const logs = await storage.getActivityLog(userId, limit);
      res.json(logs);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch activity log" });
    }
  });

  // ==================== ADMIN ====================

  // Middleware: only allow requests where session.isAdmin === true
  function isAdminAuthenticated(req: any, res: any, next: any) {
    if (req.session?.isAdmin === true) return next();
    return res.status(401).json({ message: "Admin authentication required" });
  }

  // POST /api/admin/login
  app.post("/api/admin/login", adminLoginLimiter, async (req: any, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
      }

      const { authStorage: adminAuthStorage } = await import("./replit_integrations/auth/storage");
      const { verifyPassword } = await import("./replit_integrations/auth/replitAuth");

      const user = await adminAuthStorage.getUserByEmail(email.toLowerCase().trim());
      if (!user || !user.passwordHash) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      const passwordOk = verifyPassword(password, user.passwordHash);
      if (!passwordOk) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      if (!(user as any).isAdmin) {
        return res.status(403).json({ message: "Access denied" });
      }

      req.session.isAdmin = true;
      req.session.adminEmail = user.email;
      return res.json({ success: true });
    } catch (error) {
      console.error("Admin login error:", error);
      return res.status(500).json({ message: "Login failed" });
    }
  });

  // Public API rate limiting on auth endpoints
  app.use("/api/auth/login", publicApiLimiter);
  app.use("/api/auth/register", publicApiLimiter);
  app.use("/api/auth/forgot-password", publicApiLimiter);

  // POST /api/admin/logout
  app.post("/api/admin/logout", (req: any, res) => {
    req.session.isAdmin = false;
    req.session.adminEmail = undefined;
    res.json({ success: true });
  });

  // GET /api/admin/verify
  app.get("/api/admin/verify", (req: any, res) => {
    if (req.session?.isAdmin === true) {
      return res.json({ isAdmin: true, email: req.session.adminEmail });
    }
    return res.status(401).json({ isAdmin: false });
  });

  // GET /api/admin/stats
  app.get("/api/admin/stats", isAdminAuthenticated, async (req, res) => {
    try {
      const { db: database } = await import("./db");
      const { users } = await import("@shared/models/auth");
      const { suggestions } = await import("@shared/schema");
      const { count: dbCount, sql: dbSql } = await import("drizzle-orm");

      const [userCount] = await database.select({ count: dbCount() }).from(users);
      const [tweetCount] = await database.select({ count: dbCount() }).from(suggestions);

      const planCounts = await database
        .select({ plan: users.plan, count: dbCount() })
        .from(users)
        .groupBy(users.plan);

      const statusCounts = await database
        .select({ status: users.subscriptionStatus, count: dbCount() })
        .from(users)
        .groupBy(users.subscriptionStatus);

      res.json({
        totalUsers: Number(userCount?.count ?? 0),
        totalTweets: Number(tweetCount?.count ?? 0),
        planBreakdown: planCounts.map((r) => ({ plan: r.plan, count: Number(r.count) })),
        statusBreakdown: statusCounts.map((r) => ({ status: r.status, count: Number(r.count) })),
      });
    } catch (error) {
      console.error("Admin stats error:", error);
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  // GET /api/admin/users
  app.get("/api/admin/users", isAdminAuthenticated, async (req, res) => {
    try {
      const { db: database } = await import("./db");
      const { users } = await import("@shared/models/auth");
      const { desc } = await import("drizzle-orm");

      const allUsers = await database
        .select({
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
          profileImageUrl: users.profileImageUrl,
          plan: users.plan,
          subscriptionStatus: users.subscriptionStatus,
          paddleCustomerId: users.paddleCustomerId,
          paddleSubscriptionId: users.paddleSubscriptionId,
          monthlyTweetLimit: users.monthlyTweetLimit,
          tweetsUsed: users.tweetsUsed,
          tweetsResetAt: users.tweetsResetAt,
          xUsername: users.xUsername,
          googleId: users.googleId,
          xAuthId: users.xAuthId,
          aiProvider: users.aiProvider,
          isAdmin: (users as any).isAdmin,
          createdAt: users.createdAt,
          updatedAt: users.updatedAt,
          trialEndsAt: users.trialEndsAt,
          subscriptionEndsAt: users.subscriptionEndsAt,
        })
        .from(users)
        .orderBy(desc(users.createdAt));

      res.json(allUsers);
    } catch (error) {
      console.error("Admin users error:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  // PATCH /api/admin/users/:id
  app.patch("/api/admin/users/:id", isAdminAuthenticated, async (req, res) => {
    try {
      const { db: database } = await import("./db");
      const { users } = await import("@shared/models/auth");
      const { eq } = await import("drizzle-orm");

      const { plan, monthlyTweetLimit, tweetsUsed, subscriptionStatus, isAdmin } = req.body;
      const updateData: any = { updatedAt: new Date() };
      if (plan !== undefined) updateData.plan = plan;
      if (monthlyTweetLimit !== undefined) updateData.monthlyTweetLimit = Number(monthlyTweetLimit);
      if (tweetsUsed !== undefined) updateData.tweetsUsed = Number(tweetsUsed);
      if (subscriptionStatus !== undefined) updateData.subscriptionStatus = subscriptionStatus;
      if (isAdmin !== undefined) updateData.isAdmin = Boolean(isAdmin);

      const [updated] = await database
        .update(users)
        .set(updateData)
        .where(eq(users.id, req.params.id))
        .returning({
          id: users.id,
          email: users.email,
          plan: users.plan,
          subscriptionStatus: users.subscriptionStatus,
          monthlyTweetLimit: users.monthlyTweetLimit,
          tweetsUsed: users.tweetsUsed,
          isAdmin: (users as any).isAdmin,
        });

      if (!updated) return res.status(404).json({ message: "User not found" });
      res.json(updated);
    } catch (error) {
      console.error("Admin update user error:", error);
      res.status(500).json({ message: "Failed to update user" });
    }
  });

  // GET /api/admin/visitors/stats
  app.get("/api/admin/visitors/stats", isAdminAuthenticated, async (req, res) => {
    try {
      const { db: database } = await import("./db");
      const { sql } = await import("drizzle-orm");

      const [
        totalResult,
        countries,
        cities,
        regions,
        browsers,
        osResult,
        isps,
      ] = await Promise.all([
        database.execute(sql`SELECT COUNT(*) as total FROM visitor_tracking`),
        database.execute(sql`SELECT country as name, COUNT(*) as count FROM visitor_tracking WHERE country IS NOT NULL AND country != '' GROUP BY country ORDER BY count DESC LIMIT 10`),
        database.execute(sql`SELECT city as name, COUNT(*) as count FROM visitor_tracking WHERE city IS NOT NULL AND city != '' GROUP BY city ORDER BY count DESC LIMIT 10`),
        database.execute(sql`SELECT region as name, COUNT(*) as count FROM visitor_tracking WHERE region IS NOT NULL AND region != '' GROUP BY region ORDER BY count DESC LIMIT 10`),
        database.execute(sql`SELECT browser as name, COUNT(*) as count FROM visitor_tracking WHERE browser IS NOT NULL AND browser != '' GROUP BY browser ORDER BY count DESC LIMIT 10`),
        database.execute(sql`SELECT os as name, COUNT(*) as count FROM visitor_tracking WHERE os IS NOT NULL AND os != '' GROUP BY os ORDER BY count DESC LIMIT 10`),
        database.execute(sql`SELECT isp as name, COUNT(*) as count FROM visitor_tracking WHERE isp IS NOT NULL AND isp != '' GROUP BY isp ORDER BY count DESC LIMIT 10`),
      ]);

      const toRows = (result: any) =>
        (result.rows ?? result).map((r: any) => ({ name: r.name ?? "Unknown", count: Number(r.count) }));

      res.json({
        total: Number((totalResult.rows ?? totalResult)[0]?.total ?? 0),
        countries: toRows(countries),
        cities: toRows(cities),
        regions: toRows(regions),
        browsers: toRows(browsers),
        os: toRows(osResult),
        isps: toRows(isps),
      });
    } catch (error) {
      console.error("Admin visitors stats error:", error);
      res.status(500).json({ message: "Failed to load visitor stats" });
    }
  });

  // GET /api/admin/login-history
  app.get("/api/admin/login-history", isAdminAuthenticated, async (req, res) => {
    try {
      const { db: database } = await import("./db");
      const { loginHistory } = await import("@shared/schema");
      const { users } = await import("@shared/models/auth");
      const { desc, eq, sql } = await import("drizzle-orm");

      const limit = Math.min(Number(req.query.limit) || 100, 500);
      const offset = Number(req.query.offset) || 0;

      const rows = await database
        .select({
          id: loginHistory.id,
          userId: loginHistory.userId,
          email: loginHistory.email,
          method: loginHistory.method,
          status: loginHistory.status,
          ip: loginHistory.ip,
          browser: loginHistory.browser,
          os: loginHistory.os,
          device: loginHistory.device,
          country: loginHistory.country,
          countryCode: loginHistory.countryCode,
          city: loginHistory.city,
          region: loginHistory.region,
          isp: loginHistory.isp,
          createdAt: loginHistory.createdAt,
          firstName: users.firstName,
          lastName: users.lastName,
          profileImageUrl: users.profileImageUrl,
        })
        .from(loginHistory)
        .leftJoin(users, eq(loginHistory.userId, users.id))
        .orderBy(desc(loginHistory.createdAt))
        .limit(limit)
        .offset(offset);

      const countResult = await database.execute(sql`SELECT COUNT(*) as total FROM login_history`);
      const total = Number(((countResult.rows ?? countResult) as any)[0]?.total ?? 0);

      res.json({ rows, total, limit, offset });
    } catch (error) {
      console.error("Admin login-history error:", error);
      res.status(500).json({ message: "Failed to load login history" });
    }
  });

  // DELETE /api/admin/users/:id
  app.delete("/api/admin/users/:id", isAdminAuthenticated, async (req, res) => {
    try {
      const { db: database } = await import("./db");
      const { users } = await import("@shared/models/auth");
      const { eq } = await import("drizzle-orm");

      const [deleted] = await database
        .delete(users)
        .where(eq(users.id, req.params.id))
        .returning({ id: users.id });

      if (!deleted) return res.status(404).json({ message: "User not found" });
      res.json({ success: true });
    } catch (error) {
      console.error("Admin delete user error:", error);
      res.status(500).json({ message: "Failed to delete user" });
    }
  });

  // ── Admin: Vouchers CRUD ───────────────────────────────────────────────────

  // GET /api/admin/vouchers
  app.get("/api/admin/vouchers", isAdminAuthenticated, async (req, res) => {
    try {
      const { db: database } = await import("./db");
      const { vouchers } = await import("@shared/schema");
      const { desc } = await import("drizzle-orm");
      const all = await database.select().from(vouchers).orderBy(desc(vouchers.createdAt));
      res.json(all);
    } catch (error) {
      console.error("Admin get vouchers error:", error);
      res.status(500).json({ message: "Failed to fetch vouchers" });
    }
  });

  // POST /api/admin/vouchers
  app.post("/api/admin/vouchers", isAdminAuthenticated, async (req, res) => {
    try {
      const { db: database } = await import("./db");
      const { vouchers } = await import("@shared/schema");
      const { code, discountPercent, expiresAt, maxUses, isActive, plan } = req.body;

      if (!code || typeof code !== "string" || !code.trim()) {
        return res.status(400).json({ message: "code is required" });
      }
      if (!discountPercent || Number(discountPercent) < 1 || Number(discountPercent) > 100) {
        return res.status(400).json({ message: "discountPercent must be 1–100" });
      }

      const [created] = await database
        .insert(vouchers)
        .values({
          code:            code.trim().toUpperCase(),
          discountPercent: Number(discountPercent),
          expiresAt:       expiresAt ? new Date(expiresAt) : null,
          maxUses:         maxUses != null ? Number(maxUses) : null,
          isActive:        isActive !== false,
          plan:            plan || null,
        })
        .returning();

      res.status(201).json(created);
    } catch (error: any) {
      if (error?.code === "23505") {
        return res.status(409).json({ message: "A voucher with this code already exists" });
      }
      console.error("Admin create voucher error:", error);
      res.status(500).json({ message: "Failed to create voucher" });
    }
  });

  // PATCH /api/admin/vouchers/:id
  app.patch("/api/admin/vouchers/:id", isAdminAuthenticated, async (req, res) => {
    try {
      const { db: database } = await import("./db");
      const { vouchers } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");
      const { discountPercent, expiresAt, maxUses, isActive, plan } = req.body;

      const updateData: any = {};
      if (discountPercent !== undefined) updateData.discountPercent = Number(discountPercent);
      if (expiresAt      !== undefined) updateData.expiresAt       = expiresAt ? new Date(expiresAt) : null;
      if (maxUses        !== undefined) updateData.maxUses         = maxUses != null ? Number(maxUses) : null;
      if (isActive       !== undefined) updateData.isActive        = Boolean(isActive);
      if (plan           !== undefined) updateData.plan            = plan || null;

      const [updated] = await database
        .update(vouchers)
        .set(updateData)
        .where(eq(vouchers.id, Number(req.params.id)))
        .returning();

      if (!updated) return res.status(404).json({ message: "Voucher not found" });
      res.json(updated);
    } catch (error) {
      console.error("Admin update voucher error:", error);
      res.status(500).json({ message: "Failed to update voucher" });
    }
  });

  // DELETE /api/admin/vouchers/:id
  app.delete("/api/admin/vouchers/:id", isAdminAuthenticated, async (req, res) => {
    try {
      const { db: database } = await import("./db");
      const { vouchers } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");

      const [deleted] = await database
        .delete(vouchers)
        .where(eq(vouchers.id, Number(req.params.id)))
        .returning({ id: vouchers.id });

      if (!deleted) return res.status(404).json({ message: "Voucher not found" });
      res.json({ success: true });
    } catch (error) {
      console.error("Admin delete voucher error:", error);
      res.status(500).json({ message: "Failed to delete voucher" });
    }
  });

  // GET /api/admin/vouchers/:id/uses
  app.get("/api/admin/vouchers/:id/uses", isAdminAuthenticated, async (req, res) => {
    try {
      const { db: database } = await import("./db");
      const { voucherUses } = await import("@shared/schema");
      const { users: usersTable } = await import("@shared/models/auth");
      const { eq } = await import("drizzle-orm");

      const uses = await database
        .select({
          id:               voucherUses.id,
          voucherId:        voucherUses.voucherId,
          userId:           voucherUses.userId,
          usedAt:           voucherUses.usedAt,
          plan:             voucherUses.plan,
          originalAmount:   voucherUses.originalAmount,
          discountedAmount: voucherUses.discountedAmount,
          userEmail:        usersTable.email,
          userFirstName:    usersTable.firstName,
          userLastName:     usersTable.lastName,
        })
        .from(voucherUses)
        .leftJoin(usersTable, eq(voucherUses.userId, usersTable.id))
        .where(eq(voucherUses.voucherId, Number(req.params.id)));

      res.json(uses);
    } catch (error) {
      console.error("Admin get voucher uses error:", error);
      res.status(500).json({ message: "Failed to fetch voucher uses" });
    }
  });

  return httpServer;
}
