import { db } from "./db";
import { users } from "@shared/models/auth";
import { subscriptionRenewals, automations } from "@shared/schema";
import { eq, and } from "drizzle-orm";

/** Pause all active automations for a user (limit reached or subscription expired). */
async function pauseActiveAutomations(userId: string): Promise<void> {
  try {
    await db
      .update(automations)
      .set({ active: false, updatedAt: new Date() })
      .where(and(eq(automations.userId, userId), eq(automations.active, true)));
    console.log(`[subscription] ⏸️ Paused all active automations for user=${userId}`);
  } catch (e) {
    console.error(`[subscription] Failed to pause automations for user=${userId}:`, e);
  }
}

/** Delete all automations for a user (downgrade from Pro to lower plan). */
async function deleteUserAutomations(userId: string): Promise<void> {
  try {
    await db
      .delete(automations)
      .where(eq(automations.userId, userId));
    console.log(`[subscription] 🗑️ Deleted all automations for user=${userId} (downgrade from Pro)`);
  } catch (e) {
    console.error(`[subscription] Failed to delete automations for user=${userId}:`, e);
  }
}

// ── Plan prices: read directly from ENV ─────────────────────────────────────
// To change prices: update ENV vars on Render and redeploy.
export function getPlanPrices(): { sar: Record<string, number>; usd: Record<string, number> } {
  return {
    sar: {
      starter:  Number(process.env.PRICE_STARTER_SAR  ?? 55),
      creator:  Number(process.env.PRICE_CREATOR_SAR  ?? 109),
      autopilot: Number(process.env.PRICE_PRO_SAR     ?? 259),
    },
    usd: {
      starter:  Number(process.env.PRICE_STARTER_USD  ?? 15),
      creator:  Number(process.env.PRICE_CREATOR_USD  ?? 29),
      autopilot: Number(process.env.PRICE_PRO_USD     ?? 69),
    },
  };
}

// Aliases for legacy callers
export async function getPlanPricesFromDB() { return getPlanPrices(); }
export function invalidatePriceCache() { /* no-op — ENV-based, no cache */ }
export const PLAN_PRICES_SAR = getPlanPrices().sar;
export const PLAN_PRICES_USD = getPlanPrices().usd;

// Internal shorthand for messages in this file
const _sar = () => getPlanPrices().sar;
const _usd = () => getPlanPrices().usd;

// ── Plan config ──────────────────────────────────────────────────────────────
export const PLANS = {
  FREE: {
    name: "Free",
    tweetsPerMonth: 30,
    autoTweets: false,
    threads: true,
    maxThreadTweets: 3,
    advancedScheduling: false,
    aiRewrite: false,
    aiWrite: true,
  },
  STARTER: {
    name: "Starter",
    tweetsPerMonth: 300,
    autoTweets: false,
    threads: true,
    maxThreadTweets: 6,
    advancedScheduling: false,
    aiRewrite: false,
    aiWrite: true,
  },
  CREATOR: {
    name: "Creator",
    tweetsPerMonth: 600,
    autoTweets: false,
    threads: true,
    maxThreadTweets: 999,
    advancedScheduling: true,
    aiRewrite: true,
    aiWrite: true,
  },
  PRO: {
    name: "Autopilot",
    tweetsPerMonth: 1500,
    autoTweets: true,
    threads: true,
    maxThreadTweets: 999,
    advancedScheduling: true,
    aiRewrite: true,
    aiWrite: true,
    aiToneTraining: true,
    prioritySupport: true,
  },
};

export const PLAN_TWEET_LIMITS: Record<string, number> = {
  free: 30,
  starter: 300,
  creator: 600,
  autopilot: 1500,
};

// ── Helpers ──────────────────────────────────────────────────────────────────
export async function getUserSubscription(userId: string) {
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  return user;
}

export async function isSubscriptionActive(userId: string): Promise<boolean> {
  const user = await getUserSubscription(userId);
  if (!user) return false;

  // Free plan always has access (limits enforced at publish time)
  if (!user.plan || user.plan === "free") return true;

  // Expired subscriptions are treated as free
  if (user.subscriptionStatus === "expired" || user.subscriptionStatus === "canceled") return false;

  const now = new Date();

  // Active paid subscription
  if (user.subscriptionStatus === "active" && user.subscriptionEndsAt && user.subscriptionEndsAt > now) {
    return true;
  }

  return false;
}

export async function getSubscriptionInfo(userId: string) {
  const user = await getUserSubscription(userId);
  if (!user) return null;

  const now = new Date();

  // ── Auto-downgrade if paid subscription has expired ───────────────────────
  if (
    user.subscriptionStatus === "active" &&
    user.subscriptionEndsAt &&
    user.subscriptionEndsAt <= now &&
    user.plan !== "free"
  ) {
    await downgradeExpiredSubscription(userId);
    // Re-fetch updated record
    const [downgraded] = await db.select().from(users).where(eq(users.id, userId));
    if (downgraded) {
      return {
        status: "none",
        isActive: true,
        isTrial: false,
        isPaid: false,
        isFree: true,
        plan: "free",
        daysLeft: null,
        trialEndsAt: null,
        subscriptionEndsAt: null,
        tweetsUsed: downgraded.tweetsUsed ?? 0,
        tweetsRemaining: Math.max(0, PLAN_TWEET_LIMITS["free"] - (downgraded.tweetsUsed ?? 0)),
        monthlyLimit: PLAN_TWEET_LIMITS["free"],
      };
    }
  }

  const isActive = await isSubscriptionActive(userId);

  let daysLeft: number | null = null;

  if (user.subscriptionStatus === "active" && user.subscriptionEndsAt) {
    daysLeft = Math.max(0, Math.ceil((user.subscriptionEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
  }

  const isFree = !user.subscriptionStatus || user.subscriptionStatus === "none";
  // Use the monthlyTweetLimit stored in DB (set correctly for every plan on upgrade)
  const monthlyLimit = user.monthlyTweetLimit ?? PLAN_TWEET_LIMITS[user.plan ?? "free"] ?? 25;
  const tweetsUsed = user.tweetsUsed ?? 0;
  const tweetsRemaining = Math.max(0, monthlyLimit - tweetsUsed);

  return {
    status: user.subscriptionStatus || "none",
    isActive,
    isTrial: false,
    isPaid: user.subscriptionStatus === "active",
    isFree: user.plan === "free",
    plan: user.plan ?? "free",
    daysLeft,
    trialEndsAt: null,
    subscriptionEndsAt: user.subscriptionEndsAt,
    // Tweet usage — tracked for all plans
    tweetsUsed,
    tweetsRemaining,
    monthlyLimit,
  };
}

// ── Free Plan Init ────────────────────────────────────────────────────────────
// Called for every new user registration (email, Google, X sign-in)
export async function initFreePlan(userId: string) {
  const now = new Date();
  // Set beginning of current month as the reset point
  const resetAt = new Date(now.getFullYear(), now.getMonth(), 1);

  await db.update(users)
    .set({
      plan: "free",
      monthlyTweetLimit: PLAN_TWEET_LIMITS["free"],
      tweetsUsed: 0,
      tweetsResetAt: resetAt,
      // Clear the DB-default "trial" status so checkTweetLimit routes correctly
      subscriptionStatus: "none",
      updatedAt: now,
    })
    .where(eq(users.id, userId));
}

// ── Tweet Usage ───────────────────────────────────────────────────────────────

// Reset monthly counter if we're in a new month, then return current usage
// No automatic reset based on dates.
// Reset happens ONLY via Paylink webhook when user actually pays/renews.
// This function is kept as a no-op to avoid breaking call sites.
async function resetMonthlyUsageIfNeeded(_userId: string) {
  // Intentionally empty — reset is handled exclusively by updateSubscriptionFromPaylink()
  // which is triggered by Paylink webhook.
}

// Increment tweets used counter after a successful publish
export async function incrementTweetsUsed(userId: string, count = 1) {
  await resetMonthlyUsageIfNeeded(userId);
  const user = await getUserSubscription(userId);
  if (!user) return;
  const newCount = (user.tweetsUsed ?? 0) + count;
  await db.update(users)
    .set({ tweetsUsed: newCount, updatedAt: new Date() })
    .where(eq(users.id, userId));
  // Pause automations as soon as the limit is hit
  const limit = user.monthlyTweetLimit ?? PLAN_TWEET_LIMITS[user.plan ?? "free"] ?? 25;
  if (newCount >= limit) {
    await pauseActiveAutomations(userId);
  }
}

// ── Downgrade expired paid subscription to Free ──────────────────────────────
// Called automatically when a paid subscription's end date has passed.
// Sets plan=free, status=expired, resets tweet counter to 0 with 25 limit.
async function downgradeExpiredSubscription(userId: string): Promise<void> {
  const now = new Date();
  const resetAt = new Date(now.getFullYear(), now.getMonth(), 1);

  // Fetch current plan before downgrading
  const [currentUser] = await db.select({ plan: users.plan }).from(users).where(eq(users.id, userId));

  await db.update(users)
    .set({
      plan: "free",
      subscriptionStatus: "none",
      monthlyTweetLimit: PLAN_TWEET_LIMITS["free"],
      tweetsUsed: 0,
      tweetsResetAt: resetAt,
      updatedAt: now,
    })
    .where(eq(users.id, userId));
  console.log(`[subscription] ⬇️ downgradeExpiredSubscription: user=${userId} → free (none)`);
  await pauseActiveAutomations(userId);
  // Autopilot is Pro-only → delete all automations on downgrade from Autopilot
  if (currentUser?.plan === "autopilot") {
    await deleteUserAutomations(userId);
  }
}

// Check if user can still publish based on their plan limit
export async function checkTweetLimit(userId: string): Promise<{
  allowed: boolean;
  plan?: string;
  tweetsUsed?: number;
  tweetsRemaining?: number;
  limit?: number;
  message?: { en: string; ar: string };
}> {
  const user = await getUserSubscription(userId);
  if (!user) return { allowed: false };

  await resetMonthlyUsageIfNeeded(userId);

  // Re-fetch after potential reset
  const [fresh] = await db.select().from(users).where(eq(users.id, userId));
  if (!fresh) return { allowed: false };

  const now = new Date();

  // ── Paid subscription expired → downgrade to Free immediately ────────────
  if (
    fresh.subscriptionStatus === "active" &&
    fresh.subscriptionEndsAt &&
    fresh.subscriptionEndsAt <= now &&
    fresh.plan !== "free"
  ) {
    await downgradeExpiredSubscription(userId);
    return {
      allowed: false,
      message: {
        en: `Your subscription has expired. You've been moved to the Free plan (${PLAN_TWEET_LIMITS["free"]} tweets/month). Renew to restore full access.`,
        ar: `انتهى اشتراكك. تم تحويلك إلى الخطة المجانية (${PLAN_TWEET_LIMITS["free"]} تغريدة/شهر). جدّد الاشتراك لاستعادة الوصول الكامل.`,
      },
    };
  }

  // ── Already expired (status set by previous check or webhook) ────────────
  // Note: after downgrade, status is set to "none" so user can publish 25 free tweets.
  // "expired" or "canceled" = hard block (manual cancellation, not auto-downgrade)
  if (fresh.subscriptionStatus === "canceled") {
    return {
      allowed: false,
      message: {
        en: "Your subscription has been canceled. Renew your plan to continue publishing.",
        ar: "تم إلغاء اشتراكك. جدّد خطتك للمتابعة في النشر.",
      },
    };
  }

  const plan = fresh.plan ?? "free";
  const used = fresh.tweetsUsed ?? 0;
  const limit = fresh.monthlyTweetLimit ?? PLAN_TWEET_LIMITS[plan] ?? 25;
  const remaining = Math.max(0, limit - used);

  // Enforce monthly limit for ALL plans
  if (used >= limit) {
    const sLimit = PLAN_TWEET_LIMITS["starter"];
    const cLimit = PLAN_TWEET_LIMITS["creator"];
    const pLimit = PLAN_TWEET_LIMITS["autopilot"];
    const limitMessages: Record<string, { en: string; ar: string }> = {
      free: {
        en: `You've published ${used} tweets this month — a great start!\n\nUpgrade to Starter (${sLimit} tweets) or Creator (${cLimit} tweets) to keep going.`,
        ar: `نشرت ${used} تغريدة هذا الشهر — بداية رائعة!\n\nقم بالترقية إلى Starter (${sLimit} تغريدة) أو Creator (${cLimit} تغريدة) للاستمرار.`,
      },
      starter: {
        en: `You've published ${used} tweets this month — great momentum!\n\nUpgrade to Creator for ${cLimit} tweets, or renew Starter for another ${sLimit} instantly.`,
        ar: `نشرت ${used} تغريدة هذا الشهر — زخم رائع!\n\nقم بالترقية إلى Creator للحصول على ${cLimit} تغريدة، أو جدّد Starter للحصول على ${sLimit} تغريدة أخرى فوراً.`,
      },
      creator: {
        en: `You've published ${used} tweets this month — you're on fire!\n\nUpgrade to Autopilot for ${pLimit} tweets, or renew Creator for another ${cLimit} instantly.`,
        ar: `نشرت ${used} تغريدة هذا الشهر — أنت في قمة نشاطك!\n\nقم بالترقية إلى Autopilot للحصول على ${pLimit} تغريدة، أو جدّد Creator للحصول على ${cLimit} تغريدة أخرى فوراً.`,
      },
      autopilot: {
        en: `You've published ${used} tweets this month — incredible consistency.\n\nRenew now and unlock a fresh ${pLimit} tweets instantly.`,
        ar: `نشرت ${used} تغريدة هذا الشهر — ثبات مذهل.\n\nجدّد الآن واحصل على ${pLimit} تغريدة جديدة فوراً.`,
      },
    };
    return {
      allowed: false,
      tweetsUsed: used,
      tweetsRemaining: 0,
      limit,
      message: limitMessages[plan] ?? {
        en: `🚀 You've reached your monthly limit of ${limit} tweets. Upgrade your plan to keep growing!`,
        ar: `🚀 لقد وصلت إلى الحد الشهري البالغ ${limit} تغريدة. قم بترقية خطتك للاستمرار!`,
      },
    };
  }

  return { allowed: true, plan, tweetsUsed: used, tweetsRemaining: remaining, limit };
}

// Check if user's plan supports advanced scheduling (AI Generate for Schedule) — Creator+ only
export async function checkCanUseAdvancedScheduling(userId: string): Promise<{
  allowed: boolean;
  message?: { en: string; ar: string };
}> {
  const user = await getUserSubscription(userId);
  if (!user) return { allowed: false };

  const plan = user.plan ?? "free";
  if (["creator", "autopilot"].includes(plan) && user.subscriptionStatus === "active") {
    return { allowed: true };
  }

  return {
    allowed: false,
    message: {
      en: `AI-powered schedule generation is available on the Creator plan ($${_usd()["creator"]}/month) and above. Upgrade to unlock it.`,
      ar: `توليد الجدولة بالذكاء الاصطناعي متاح في خطة Creator ($${_usd()["creator"]}/شهر) وما فوق. قم بالترقية لتفعيله.`,
    },
  };
}

// Check if user's plan supports autopilot automation
export async function checkCanUseAutopilot(userId: string): Promise<{
  allowed: boolean;
  message?: { en: string; ar: string };
}> {
  const user = await getUserSubscription(userId);
  if (!user) return { allowed: false };

  const plan = user.plan ?? "free";
  if (plan === "autopilot" && user.subscriptionStatus === "active") {
    return { allowed: true };
  }

  return {
    allowed: false,
    message: {
      en: `Autopilot automation is available on the Autopilot plan ($${_usd()["autopilot"]}/month). Upgrade to automate your posts! 🚀`,
      ar: `الأتمتة التلقائية متاحة في خطة Autopilot ($${_usd()["autopilot"]}/شهر). قم بالترقية لأتمتة تغريداتك! 🚀`,
    },
  };
}

// Check if user's plan supports threads and return max allowed tweets
export async function checkCanUseThreads(userId: string, requestedTweetCount?: number): Promise<{
  allowed: boolean;
  maxTweets?: number;
  message?: { en: string; ar: string };
}> {
  const user = await getUserSubscription(userId);
  if (!user) return { allowed: false };

  const plan = user.plan ?? "free";

  // Pro and Creator: unlimited threads
  if (["creator", "autopilot"].includes(plan) && user.subscriptionStatus === "active") {
    return { allowed: true, maxTweets: 999 };
  }

  // Free plan: threads allowed but max 3 tweets
  if (plan === "free" || !user.subscriptionStatus || user.subscriptionStatus === "none") {
    const maxTweets = PLANS.FREE.maxThreadTweets;
    if (requestedTweetCount && requestedTweetCount > maxTweets) {
      return {
        allowed: false,
        maxTweets,
        message: {
          en: `Free plan allows threads up to ${maxTweets} tweets only. Upgrade to Creator ($${_usd()["creator"]}) for unlimited threads.`,
          ar: `الخطة المجانية تسمح بثريد حتى ${maxTweets} تغريدات فقط. قم بالترقية إلى Creator ($${_usd()["creator"]}) للثريدات غير المحدودة.`,
        },
      };
    }
    return { allowed: true, maxTweets };
  }

  // Starter: threads allowed up to 6 tweets
  if (plan === "starter" && user.subscriptionStatus === "active") {
    const maxTweets = PLANS.STARTER.maxThreadTweets;
    if (requestedTweetCount && requestedTweetCount > maxTweets) {
      return {
        allowed: false,
        maxTweets,
        message: {
          en: `Starter plan allows threads up to ${maxTweets} tweets only. Upgrade to Creator ($${_usd()["creator"]}) for unlimited threads.`,
          ar: `خطة Starter تسمح بثريد حتى ${maxTweets} تغريدات فقط. قم بالترقية إلى Creator ($${_usd()["creator"]}) للثريدات غير المحدودة.`,
        },
      };
    }
    return { allowed: true, maxTweets };
  }

  return {
    allowed: false,
    message: {
      en: `Thread publishing is available on Creator ($${_usd()["creator"]}) and Autopilot ($${_usd()["autopilot"]}) plans.`,
      ar: `نشر الثريدات متاح في خطتَي Creator ($${_usd()["creator"]}) وAutopilot ($${_usd()["autopilot"]}).`,
    },
  };
}

// Set trial for new users (kept for backward compat with existing code paths)
export async function startTrial(userId: string) {
  // New behaviour: instead of a time-limited trial, start on free plan
  await initFreePlan(userId);
}

// Update subscription from Paylink webhook
// ─────────────────────────────────────────────────────────────────────────────
// Paylink.sa — activate / renew subscription after confirmed payment
// Called from the Paylink webhook handler in paylink-routes.ts
// ─────────────────────────────────────────────────────────────────────────────
export async function updateSubscriptionFromPaylink(
  userId:      string,
  planKey:     string,
  periodStart: Date,
  periodEnd:   Date,
  meta: {
    transactionNo: string;
    orderNumber:   string;
    amount:        number;
    rawPayload?:   unknown;
  }
) {
  const plan             = planKey.toLowerCase();
  const monthlyTweetLimit = PLAN_TWEET_LIMITS[plan] ?? 150;
  const now              = new Date();

  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user) {
    console.error(`[paylink] updateSubscription: user not found: ${userId}`);
    return;
  }

  const wasNotActive    = !user.subscriptionStatus || user.subscriptionStatus !== "active";
  const isExpiredRenewal = user.subscriptionEndsAt && user.subscriptionEndsAt < now;
  const isNewPeriod     = !user.tweetsResetAt || periodStart > user.tweetsResetAt;

  const shouldReset = wasNotActive || isExpiredRenewal || isNewPeriod;

  // Determine event type for audit log
  let eventType = "renewal";
  if (wasNotActive)           eventType = "new_subscription";
  else if (isExpiredRenewal)  eventType = "reactivation";
  else if (user.plan !== plan) eventType = "plan_change";

  // Update user record
  await db.update(users)
    .set({
      subscriptionStatus: "active",
      subscriptionEndsAt: periodEnd,
      plan,
      monthlyTweetLimit,
      paddleSubscriptionId: meta.transactionNo, // reuse field for Paylink transactionNo
      ...(shouldReset ? { tweetsUsed: 0, tweetsResetAt: periodStart } : {}),
      updatedAt: now,
    })
    .where(eq(users.id, userId));

  // Insert audit record
  await db.insert(subscriptionRenewals).values({
    userId,
    paddleCustomerId:     null,
    paddleSubscriptionId: meta.transactionNo,
    paddleTransactionId:  meta.transactionNo,
    plan,
    monthlyTweetLimit,
    eventType,
    periodStart,
    periodEnd,
    status: "active",
    amountSar: meta.amount > 0 ? meta.amount : null,
    rawPayload: meta.rawPayload as any ?? null,
  });

  console.log(
    `[paylink] ✅ ${eventType} | user=${userId} | plan=${plan} | amount=${meta.amount} SAR | reset=${shouldReset}`
  );

  // If downgrading from Autopilot → delete all automations (Autopilot plan only)
  if (eventType === "plan_change" && user.plan === "autopilot" && plan !== "autopilot") {
    await deleteUserAutomations(userId);
  }
}
