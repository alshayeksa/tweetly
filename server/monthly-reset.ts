import { db } from "./db";
import { users } from "@shared/models/auth";
import { eq, and, lte, inArray } from "drizzle-orm";
import { log } from "./index";

const CHECK_INTERVAL_MS = 60 * 60 * 1000; // كل ساعة

/**
 * يبحث عن المشتركين المنتهية مدتهم (active + subscriptionEndsAt في الماضي)
 * ويرجعهم للباقة المجانية تلقائياً.
 */
export async function expireOldSubscriptions(): Promise<void> {
  try {
    const now = new Date();

    const expired = await db
      .select({ id: users.id, plan: users.plan })
      .from(users)
      .where(
        and(
          inArray(users.subscriptionStatus, ["active"]),
          lte(users.subscriptionEndsAt, now)
        )
      );

    if (expired.length === 0) return;

    log(`Found ${expired.length} expired subscription(s) — downgrading to free`, "monthly-reset");

    for (const user of expired) {
      await db
        .update(users)
        .set({
          subscriptionStatus: "expired",
          plan: "free",
          monthlyTweetLimit: 25,
          tweetsUsed: 0,
          updatedAt: now,
        })
        .where(eq(users.id, user.id));

      log(`⬇️  User ${user.id} downgraded from ${user.plan} → free (subscription expired)`, "monthly-reset");
    }
  } catch (err: any) {
    log(`Error in expireOldSubscriptions: ${err.message}`, "monthly-reset");
  }
}

export function startMonthlyResetJob(): void {
  log("Subscription expiry job started — runs every hour", "monthly-reset");
  expireOldSubscriptions(); // تشغيل فوري عند البدء
  setInterval(expireOldSubscriptions, CHECK_INTERVAL_MS);
}
