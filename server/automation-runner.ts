import { storage } from "./storage";
import { log } from "./index";
import { automations as automationsTable } from "@shared/schema";
import type { Automation } from "@shared/schema";
import { db } from "./db";
import { eq, and } from "drizzle-orm";
import { incrementTweetsUsed, checkTweetLimit } from "./subscription";
import { generateTweetsForAutomation } from "./ai-provider";

let isRunning = false;

function getNextRunTime(automation: Automation): Date {
  const interval = automation.intervalMinutes || 60;
  return new Date(Date.now() + interval * 60 * 1000);
}

// Sentinel error message used to detect permanent X auth failures that require the user to reconnect
const X_RECONNECT_REQUIRED_ERROR = "X_RECONNECT_REQUIRED";

async function publishTweetToX(userId: string, tweetText: string): Promise<{ success: boolean; xPostId?: string; error?: string; requiresReconnect?: boolean }> {
  try {
    const xToken = await storage.getXToken(userId);
    if (!xToken) {
      return { success: false, error: "X account not connected", requiresReconnect: true };
    }

    // Hard-stop if the user has already been flagged as needing reconnect
    if (xToken.connectionStatus === "needs_reconnect") {
      return { success: false, error: X_RECONNECT_REQUIRED_ERROR, requiresReconnect: true };
    }

    let accessToken = xToken.accessToken;

    // Proactively refresh when token expires within 5 minutes (not just after it expires)
    const FIVE_MINUTES_MS = 5 * 60 * 1000;
    const expiryTime = xToken.expiresAt ? new Date(xToken.expiresAt).getTime() : null;
    const needsRefresh = expiryTime !== null && expiryTime - Date.now() < FIVE_MINUTES_MS;

    if (needsRefresh && xToken.refreshToken) {
      const clientId = process.env.X_CLIENT_ID;
      const clientSecret = process.env.X_CLIENT_SECRET;
      if (!clientId || !clientSecret) {
        return { success: false, error: "X API credentials not configured" };
      }

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
        return { success: false, error: X_RECONNECT_REQUIRED_ERROR, requiresReconnect: true };
      }
    } else if (needsRefresh && !xToken.refreshToken) {
      // Token is expiring/expired and there's no refresh token — must reconnect
      await storage.markUserNeedsReconnect(userId);
      return { success: false, error: X_RECONNECT_REQUIRED_ERROR, requiresReconnect: true };
    }

    const tweetResponse = await fetch("https://api.x.com/2/tweets", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text: tweetText }),
    });

    if (!tweetResponse.ok) {
      const errText = await tweetResponse.text();
      // 401 means the token has been revoked — user must reconnect
      if (tweetResponse.status === 401) {
        return { success: false, error: X_RECONNECT_REQUIRED_ERROR, requiresReconnect: true };
      }
      return { success: false, error: `X API ${tweetResponse.status}: ${errText}` };
    }

    const tweetData: any = await tweetResponse.json();
    return { success: true, xPostId: tweetData.data?.id };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function runAutomationJobs() {
  if (isRunning) return;
  isRunning = true;
  try {
    const pendingItems = await storage.getPendingQueueItems();
    if (pendingItems.length === 0) {
      isRunning = false;
      return;
    }

    // Group by automation - only process each automation ONCE per cycle
    const byAutomation = new Map<number, typeof pendingItems>();
    for (const item of pendingItems) {
      if (!byAutomation.has(item.automationId)) {
        byAutomation.set(item.automationId, []);
      }
      byAutomation.get(item.automationId)!.push(item);
    }

    log(`Processing ${byAutomation.size} unique automations from ${pendingItems.length} pending items`, "automation");

    for (const [automationId, items] of Array.from(byAutomation.entries())) {
      // Take the first item to process, cancel all others as duplicates
      const item = items[0];
      for (let i = 1; i < items.length; i++) {
        await storage.updateQueueItem(items[i].id, { status: "failed", error: "Duplicate - cancelled", executedAt: new Date() });
      }

      try {
        const automation = await storage.getAutomation(item.automationId, item.userId);
        if (!automation || !automation.active) {
          await storage.updateQueueItem(item.id, { status: "failed", error: "Automation deleted or paused" });
          continue;
        }

        // ── Check if enough tweets remain for this batch ─────────────────
        const batchLimitCheck = await checkTweetLimit(automation.userId);
        if (!batchLimitCheck.allowed) {
          await storage.updateAutomation(automation.id, automation.userId, { active: false });
          await storage.clearPendingQueue(automation.id);
          await storage.updateQueueItem(item.id, { status: "failed", error: "Tweet limit reached — autopilot paused", executedAt: new Date() });
          await storage.logActivity(automation.userId, "paused", "automation", automation.id, "Autopilot paused: tweet limit reached");
          log(`Automation "${automation.name}" paused before batch — limit reached`, "automation");
          continue;
        }

        const remaining = batchLimitCheck.tweetsRemaining ?? 0;
        const batchSize = automation.tweetsPerBatch ?? 1;

        if (remaining < batchSize) {
          log(`Automation "${automation.name}" paused — not enough tweets remaining (${remaining} < ${batchSize})`, "automation");
          await storage.updateAutomation(automation.id, automation.userId, { active: false });
          await storage.clearPendingQueue(automation.id);
          await storage.updateQueueItem(item.id, {
            status: "failed",
            error: `Not enough tweets remaining (${remaining} left, need ${batchSize}). Please renew your plan.`,
            executedAt: new Date(),
          });
          await storage.logActivity(
            automation.userId,
            "paused",
            "automation",
            automation.id,
            `Autopilot paused: only ${remaining} tweets remaining, batch needs ${batchSize}`
          );
          continue;
        }

        log(`Generating tweets for automation: ${automation.name} (${remaining} remaining, batch=${batchSize})`, "automation");

        const tweets = await generateTweetsForAutomation({
          userId: automation.userId,
          automationPrompt: automation.prompt,
          tweetsPerBatch: automation.tweetsPerBatch,
          language: automation.language,
          tone: automation.tone,
          hashtags: automation.hashtags,
        });

        log(`Generated ${tweets.length} tweets for ${automation.name}`, "automation");

        const xToken = await storage.getXToken(automation.userId);
        const hasXConnection = !!xToken;
        let allPublished = true;
        let firstXPostId: string | undefined;
        let lastError: string | undefined;
        let reconnectRequired = false;

        for (const tweet of tweets) {
          const trimmed = tweet.trim();
          if (!trimmed) continue;

          // ── Check tweet limit before publishing ──────────────────────────
          const limitCheck = await checkTweetLimit(automation.userId);
          if (!limitCheck.allowed) {
            log(`Automation "${automation.name}" paused — tweet limit reached for user=${automation.userId}`, "automation");
            // Pause the automation so it doesn't keep trying
            await storage.updateAutomation(automation.id, automation.userId, { active: false });
            await storage.clearPendingQueue(automation.id);
            await storage.logActivity(
              automation.userId,
              "paused",
              "automation",
              automation.id,
              "Autopilot paused: monthly tweet limit reached"
            );
            allPublished = false;
            lastError = "Monthly tweet limit reached — autopilot paused";
            break;
          }

          let tweetStatus: string = "pending";
          let xPostId: string | undefined;

          if (hasXConnection) {
            const result = await publishTweetToX(automation.userId, trimmed);
            if (result.success) {
              tweetStatus = "published";
              xPostId = result.xPostId;
              if (!firstXPostId) firstXPostId = xPostId;
              log(`Published tweet to X for automation ${automation.name}: ${result.xPostId}`, "automation");
              await incrementTweetsUsed(automation.userId);
              await storage.logActivity(
                automation.userId,
                "published",
                "automation_tweet",
                automation.id,
                `Auto-published tweet (Post ID: ${result.xPostId})`
              );
            } else {
              tweetStatus = "pending";
              allPublished = false;
              lastError = result.error;
              if (result.requiresReconnect) reconnectRequired = true;
              log(`Failed to publish tweet for ${automation.name}: ${result.error}`, "automation");
              await storage.logActivity(
                automation.userId,
                "failed",
                "automation_tweet",
                automation.id,
                `Auto-publish failed: ${result.error === X_RECONNECT_REQUIRED_ERROR ? "X account needs to be reconnected" : result.error}`
              );
            }
          } else {
            allPublished = false;
          }

          const suggestionData = [{
            content: trimmed,
            charCount: trimmed.length,
            status: tweetStatus as any,
            prompt: automation.prompt.substring(0, 500),
            automationId: automation.id,
          }];
          await storage.createSuggestions(automation.userId, suggestionData);
        }

        await storage.updateQueueItem(item.id, {
          status: allPublished ? "published" : "failed",
          tweetContent: tweets[0]?.trim() || "",
          xPostId: firstXPostId || undefined,
          error: allPublished ? undefined : (lastError === X_RECONNECT_REQUIRED_ERROR ? "X account disconnected — please reconnect in Settings" : (lastError || "Some tweets failed to publish")),
          executedAt: new Date(),
        });

        // Clear any remaining scheduled items for this automation before adding a new one
        await storage.clearPendingQueue(automation.id);

        if (reconnectRequired) {
          // Don't reschedule — automation will stall until the user reconnects X.
          // resumeAutomationsForUser() is called when the X token is saved again.
          log(`Automation "${automation.name}" stalled — X account needs to be reconnected`, "automation");
        } else {
          const nextRun = getNextRunTime(automation);
          await storage.addToQueue(automation.userId, automation.id, nextRun);
          log(`Successfully processed automation: ${automation.name}, next run at ${nextRun.toISOString()}`, "automation");
        }
      } catch (err: any) {
        log(`Error processing automation item ${item.id}: ${err.message}`, "automation");
        await storage.updateQueueItem(item.id, { status: "failed", error: err.message });

        try {
          const automation = await storage.getAutomation(item.automationId, item.userId);
          if (automation && automation.active) {
            await storage.clearPendingQueue(automation.id);
            const nextRun = getNextRunTime(automation);
            await storage.addToQueue(item.userId, automation.id, nextRun);
          }
        } catch {}
      }
    }
  } catch (error: any) {
    log(`Automation runner error: ${error.message}`, "automation");
  } finally {
    isRunning = false;
  }
}

async function initializeAutomationQueue() {
  try {
    const allAutomations = await db
      .select()
      .from(automationsTable)
      .where(eq(automationsTable.active, true));

    for (const automation of allAutomations) {
      const existing = await storage.getAutomationQueue(automation.id, automation.userId);
      if (existing.length === 0) {
        const nextRun = getNextRunTime(automation);
        await storage.addToQueue(automation.userId, automation.id, nextRun);
        log(`Initialized queue for automation: ${automation.name}, next run at ${nextRun.toISOString()}`, "automation");
      }
    }
  } catch (err: any) {
    log(`Failed to initialize automation queue: ${err.message}`, "automation");
  }
}

initializeAutomationQueue();
setInterval(runAutomationJobs, 60 * 1000);

// ── Instant Limit Watcher ─────────────────────────────────────────────────
// Runs every 60s — pauses any active automation whose user has no tweets left.
// This catches the case where tweets run out between queue runs.
let isWatcherRunning = false;

async function pauseAutomationsOverLimit(): Promise<void> {
  if (isWatcherRunning) return;
  isWatcherRunning = true;
  try {
    const activeAutomations = await db
      .select()
      .from(automationsTable)
      .where(eq(automationsTable.active, true));

    if (activeAutomations.length === 0) return;

    for (const automation of activeAutomations) {
      try {
        const limitCheck = await checkTweetLimit(automation.userId);
        const remaining = limitCheck.tweetsRemaining ?? 0;
        const batchSize = automation.tweetsPerBatch ?? 1;

        const shouldPause = !limitCheck.allowed || remaining < batchSize;
        if (!shouldPause) continue;

        // Pause the automation immediately
        await db
          .update(automationsTable)
          .set({ active: false, updatedAt: new Date() })
          .where(eq(automationsTable.id, automation.id));

        await storage.clearPendingQueue(automation.id);
        await storage.logActivity(
          automation.userId,
          "paused",
          "automation",
          automation.id,
          remaining === 0
            ? "Autopilot paused: tweet limit reached"
            : `Autopilot paused: only ${remaining} tweets remaining, batch needs ${batchSize}`
        );

        log(
          `⏸️ Watcher paused automation "${automation.name}" — ${remaining} remaining, needs ${batchSize}`,
          "automation-watcher"
        );
      } catch (err: any) {
        log(`Watcher error for automation ${automation.id}: ${err.message}`, "automation-watcher");
      }
    }
  } catch (err: any) {
    log(`Automation watcher error: ${err.message}`, "automation-watcher");
  } finally {
    isWatcherRunning = false;
  }
}

setInterval(pauseAutomationsOverLimit, 60 * 1000);

/**
 * Called when a user reconnects their X account.
 * Re-queues any active automations that have stalled (no pending queue items)
 * so they resume publishing immediately on the next runner cycle.
 */
export async function resumeAutomationsForUser(userId: string): Promise<void> {
  try {
    const userAutomations = await db
      .select()
      .from(automationsTable)
      .where(and(eq(automationsTable.userId, userId), eq(automationsTable.active, true)));

    for (const automation of userAutomations) {
      const existing = await storage.getAutomationQueue(automation.id, automation.userId);
      if (existing.length === 0) {
        // Schedule for 1 minute from now so it fires on the very next runner cycle
        const nextRun = new Date(Date.now() + 60 * 1000);
        await storage.addToQueue(automation.userId, automation.id, nextRun);
        log(`Resumed stalled automation "${automation.name}" for user ${userId} after X reconnect`, "automation");
      }
    }
  } catch (err: any) {
    log(`Failed to resume automations for user ${userId}: ${err.message}`, "automation");
  }
}

// ── Scheduled Tweets Runner ───────────────────────────────────────────────
let isSchedulerRunning = false;

export async function runScheduledTweets() {
  if (isSchedulerRunning) return;
  isSchedulerRunning = true;
  try {
    const batch = await storage.claimScheduledTweetsBatch(20);
    if (batch.length === 0) {
      isSchedulerRunning = false;
      return;
    }

    log(`Claimed ${batch.length} scheduled tweet(s) for publishing`, "scheduler");

    for (const tweet of batch) {
      try {
        // Enforce subscription / tweet limit before publishing
        const { checkTweetLimit } = await import("./subscription");
        const limitCheck = await checkTweetLimit(tweet.userId);
        if (!limitCheck.allowed) {
          await storage.markTweetFailed(
            tweet.id,
            limitCheck.message?.en || "Tweet limit reached — upgrade to Pro"
          );
          await storage.logActivity(
            tweet.userId,
            "failed",
            "scheduled_tweet",
            tweet.id,
            `Scheduled tweet blocked: ${limitCheck.message?.en}`
          );
          log(`Scheduled tweet ${tweet.id} blocked by trial limit`, "scheduler");
          continue;
        }

        const result = await publishTweetToX(tweet.userId, tweet.content);
        if (result.success) {
          await storage.markTweetPublished(tweet.id, result.xPostId!);
          await incrementTweetsUsed(tweet.userId);
          await storage.logActivity(
            tweet.userId,
            "published",
            "scheduled_tweet",
            tweet.id,
            `Scheduled tweet published (Post ID: ${result.xPostId})`
          );
          log(`Published scheduled tweet ${tweet.id} → X post ${result.xPostId}`, "scheduler");
        } else {
          const friendlyError = result.requiresReconnect
            ? "X account disconnected — please reconnect in Settings"
            : (result.error ?? "Unknown error");
          await storage.markTweetFailed(tweet.id, friendlyError, result.requiresReconnect);
          await storage.logActivity(
            tweet.userId,
            "failed",
            "scheduled_tweet",
            tweet.id,
            `Scheduled tweet failed: ${result.error}`
          );
          log(`Failed to publish scheduled tweet ${tweet.id}: ${result.error}`, "scheduler");
        }
      } catch (err: any) {
        await storage.markTweetFailed(tweet.id, err.message ?? "Unexpected error");
        log(`Error publishing scheduled tweet ${tweet.id}: ${err.message}`, "scheduler");
      }
    }
  } catch (error: any) {
    log(`Scheduled tweet runner error: ${error.message}`, "scheduler");
  } finally {
    isSchedulerRunning = false;
  }
}

setInterval(runScheduledTweets, 60 * 1000);
