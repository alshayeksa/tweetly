/**
 * Unified AI provider module.
 * Supports Gemini (default) and DeepSeek.
 * Each user can choose their preferred provider in Settings.
 */

import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";
import { db } from "./db";
import { users } from "@shared/models/auth";
import { eq } from "drizzle-orm";
import { log } from "./index";

// ── Clients ──────────────────────────────────────────────────────────────────

const gemini = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const deepseek = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY || "",
  baseURL: "https://api.deepseek.com/v1",
});

// ── Retry helper ─────────────────────────────────────────────────────────────

async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3, baseDelayMs = 2000): Promise<T> {
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
        const delay = baseDelayMs * Math.pow(2, attempt);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      throw err;
    }
  }
  throw new Error("withRetry: exceeded max retries");
}

// ── Provider lookup ──────────────────────────────────────────────────────────

export type AiProvider = "gemini" | "deepseek";

export async function getAiProvider(userId: string): Promise<AiProvider> {
  try {
    const [user] = await db
      .select({ aiProvider: users.aiProvider })
      .from(users)
      .where(eq(users.id, userId));
    const p = user?.aiProvider;
    if (p === "deepseek") return "deepseek";
    return "gemini";
  } catch {
    return "gemini";
  }
}

export async function setAiProvider(userId: string, provider: AiProvider): Promise<void> {
  await db.update(users).set({ aiProvider: provider }).where(eq(users.id, userId));
}

// ── Low-level callers ────────────────────────────────────────────────────────

async function callGeminiRaw(
  prompt: string,
  options: { maxTokens?: number; temperature?: number; topP?: number; topK?: number; jsonMode?: boolean; useGrounding?: boolean }
): Promise<string> {
  const config: any = {
    maxOutputTokens: options.maxTokens ?? 8192,
    temperature: options.temperature ?? 1.3,
    topP: options.topP ?? 0.98,
    topK: options.topK ?? 60,
  };
  if (options.jsonMode) config.responseMimeType = "application/json";
  if (options.useGrounding) config.tools = [{ googleSearch: {} }];

  const response = await withRetry(() =>
    (gemini as any).models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt,
      config,
    })
  );
  return response.text || "";
}

async function callDeepSeekRaw(prompt: string, options: { maxTokens?: number; temperature?: number }): Promise<string> {
  const response = await withRetry(() =>
    deepseek.chat.completions.create({
      model: "deepseek-chat",
      messages: [{ role: "user", content: prompt }],
      max_tokens: options.maxTokens ?? 8192,
      temperature: options.temperature ?? 1.3,
    })
  );
  return response.choices[0]?.message?.content || "";
}

// ── Parse tweet array ────────────────────────────────────────────────────────

/** Strip accidental JSON-wrapper artifacts e.g. ["tweet"] → tweet */
function cleanTweet(t: string): string {
  return t
    .replace(/^\["/, "")   // strip leading ["
    .replace(/"\]$/, "")   // strip trailing "]
    .replace(/^"|"$/g, "") // strip stray leading/trailing quotes
    .trim();
}

function parseTweetArray(raw: string): string[] {
  let tweets: string[];
  try {
    const cleaned = raw.replace(/```(?:json)?\s*/g, "").replace(/```\s*/g, "").trim();
    tweets = JSON.parse(cleaned);
    if (!Array.isArray(tweets)) tweets = [String(tweets)];
  } catch {
    const match = raw.match(/\[[\s\S]*?\]/);
    tweets = match
      ? (() => { try { return JSON.parse(match[0]); } catch { return [raw.trim()]; } })()
      : [raw.trim()];
  }
  return tweets.map((t: string) => cleanTweet(t)).filter(Boolean);
}

// ── Main: generate tweets ────────────────────────────────────────────────────

export async function generateTweets({
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

  let raw: string;

  if (provider === "gemini") {
    if (needsRealTimeSearch) {
      const groundingText = await callGeminiRaw(
        `Search recent news (24-48h) about: "${userPrompt.trim()}". List ${tweetCount} verified stories.`,
        { maxTokens: 2048, temperature: 0.3, useGrounding: true }
      );
      raw = await callGeminiRaw(
        `${systemInstruction}\n\nREAL NEWS:\n${groundingText}`,
        { maxTokens: 8192, temperature: 1.1, topP: 0.97, topK: 50, jsonMode: true }
      );
    } else {
      raw = await callGeminiRaw(systemInstruction, { jsonMode: true });
    }
  } else {
    // DeepSeek — no grounding, just generate
    raw = await callDeepSeekRaw(systemInstruction, { maxTokens: 8192, temperature: 1.3 });
  }

  return parseTweetArray(raw);
}

// ── Generate tweets for automation (uses automation-specific system prompt) ──

export async function generateTweetsForAutomation({
  userId,
  automationPrompt,
  tweetsPerBatch,
  language,
  tone,
  hashtags,
}: {
  userId: string;
  automationPrompt: string;
  tweetsPerBatch: number;
  language?: string | null;
  tone?: string | null;
  hashtags?: string[];
}): Promise<string[]> {
  const provider = await getAiProvider(userId);

  let langInstruction = language ? `\n- Language: Write in ${language}` : "";
  let toneInstruction = tone ? `\n- Tone: ${tone}` : "";
  let hashtagInstruction =
    hashtags && hashtags.length > 0
      ? `\n- Include these hashtags where relevant: ${hashtags.map((h) => `#${h}`).join(" ")}`
      : "";

  const systemInstruction = `أنت صانع محتوى تقني مخضرم، تكتب بأسلوب "رفيق ذكي" يتأمل التكنولوجيا بعمق.
مهمتك هي كتابة تغريدات تبدو وكأنها نابعة من تجربة شخصية، بعيداً عن صخب التسويق وجفاف التقارير.

القواعد الصارمة:
1. الشخصية: هادئة، واثقة، وتستخدم "الفصحى البيضاء" القريبة من لغة الحوار المثقف.
2. المحرمات: يمنع استخدام علامات التعجب (!)، الأسئلة المباشرة، والمصطلحات المترجمة.
3. الهيكل: سطر أول "خاطف"، 3 نقاط تشرح "ما الذي يتغير فعلياً"، جملة تأملية.
4. الممنوعات اللفظية: (يعد، يعتبر، يساهم، تكنولوجيا، عالم متسارع).
5. النتيجة: نص مريح، سطور متباعدة، ينتهي بجملة حاسمة.
${langInstruction}${toneInstruction}${hashtagInstruction}

USER INSTRUCTION:
"""
${automationPrompt}
"""

OUTPUT FORMAT:
Return ONLY a raw JSON array of exactly ${tweetsPerBatch} strings. No markdown, no \`\`\`json.
Example: ["Tweet 1 text", "Tweet 2 text"]`;

  let raw: string;
  if (provider === "gemini") {
    raw = await withRetry(() =>
      (gemini as any).models.generateContent({
        model: "gemini-2.0-flash",
        contents: `${systemInstruction}\n\nUSER PROMPT: ${automationPrompt}`,
        config: { maxOutputTokens: 8192, temperature: 0.9, topP: 0.95, responseMimeType: "application/json" },
      }).then((r: any) => r.text || "[]")
    );
  } else {
    raw = await callDeepSeekRaw(`${systemInstruction}\n\nUSER PROMPT: ${automationPrompt}`, {
      maxTokens: 8192,
      temperature: 0.9,
    });
  }

  const tweets = parseTweetArray(raw);
  log(`[ai-provider] ${provider} generated ${tweets.length} tweets for automation`, "automation");
  return tweets;
}

// ── Improve prompt ───────────────────────────────────────────────────────────

export async function improvePromptText(userId: string, userPrompt: string): Promise<string> {
  const provider = await getAiProvider(userId);

  const prompt = `You are an expert prompt engineer specializing in social media content creation for X (Twitter).

The user wrote this prompt to generate tweets:
"""
${userPrompt.trim()}
"""

Improve this prompt to produce better, more engaging tweets. Your improved version should:
- Be more specific and detailed
- Include guidance on tone, style, and engagement techniques
- Add suggestions for hashtags, hooks, or call-to-actions if missing
- Keep the original intent and language of the user
- Be clear and actionable for an AI content generator

Return ONLY the improved prompt text. No explanation, no markdown, no quotes around it. Just the improved prompt ready to use.`;

  let result: string;
  if (provider === "gemini") {
    result = await callGeminiRaw(prompt, { maxTokens: 2048, temperature: 0.7 });
  } else {
    result = await callDeepSeekRaw(prompt, { maxTokens: 2048, temperature: 0.7 });
  }
  return result.trim() || userPrompt;
}
