import {
  suggestions,
  activityLog,
  xTokens,
  automations,
  automationQueue,
  scheduledTweets,
  type ScheduledTweetPublishStatus,
  type Suggestion,
  type InsertSuggestion,
  type ActivityLog,
  type XToken,
  type Automation,
  type InsertAutomation,
  type AutomationQueue,
  type ScheduledTweet,
  type InsertScheduledTweet,
} from "@shared/schema";
import { db } from "./db";
import { log } from "./index";
import { eq, ne, desc, and, count, sql, lte, asc, inArray } from "drizzle-orm";

export interface IStorage {
  createSuggestion(userId: string, data: InsertSuggestion): Promise<Suggestion>;
  createSuggestions(userId: string, data: InsertSuggestion[]): Promise<Suggestion[]>;
  getSuggestions(userId: string, status?: string): Promise<Suggestion[]>;
  getSuggestion(id: number, userId: string): Promise<Suggestion | undefined>;
  updateSuggestionStatus(id: number, userId: string, status: string, editedContent?: string): Promise<Suggestion | undefined>;
  updateSuggestionImage(id: number, userId: string, imageUrl: string | null): Promise<Suggestion | undefined>;
  publishSuggestion(id: number, userId: string, xPostId: string): Promise<Suggestion | undefined>;

  logActivity(userId: string, action: string, entityType: string, entityId?: number, details?: string): Promise<ActivityLog>;
  getActivityLog(userId: string, limit?: number): Promise<ActivityLog[]>;

  saveXToken(userId: string, accessToken: string, refreshToken?: string, expiresAt?: Date, xUsername?: string): Promise<XToken>;
  getXToken(userId: string): Promise<XToken | undefined>;
  getAllXTokens(): Promise<XToken[]>;
  deleteXToken(userId: string): Promise<boolean>;
  markUserNeedsReconnect(userId: string): Promise<void>;

  getDashboardStats(userId: string): Promise<{
    totalSuggestions: number;
    approvedCount: number;
    publishedCount: number;
    pendingCount: number;
    rejectedCount: number;
    totalAutomations: number;
    activeAutomations: number;
  }>;

  createAutomation(userId: string, data: InsertAutomation): Promise<Automation>;
  getAutomations(userId: string): Promise<Automation[]>;
  getAutomation(id: number, userId: string): Promise<Automation | undefined>;
  updateAutomation(id: number, userId: string, data: Partial<InsertAutomation>): Promise<Automation | undefined>;
  deleteAutomation(id: number, userId: string): Promise<boolean>;

  getAutomationQueue(automationId: number, userId: string): Promise<AutomationQueue[]>;
  getAutomationHistory(automationId: number, userId: string): Promise<AutomationQueue[]>;
  addToQueue(userId: string, automationId: number, scheduledAt: Date): Promise<AutomationQueue>;
  updateQueueItem(id: number, data: Partial<{ status: string; tweetContent: string; xPostId: string; error: string; executedAt: Date }>): Promise<AutomationQueue | undefined>;
  getPendingQueueItems(): Promise<AutomationQueue[]>;
  clearPendingQueue(automationId: number): Promise<void>;

  // Scheduled tweets
  createScheduledTweet(userId: string, data: InsertScheduledTweet): Promise<ScheduledTweet>;
  getScheduledTweets(userId: string): Promise<ScheduledTweet[]>;
  getScheduledTweet(id: number, userId: string): Promise<ScheduledTweet | undefined>;
  updateScheduledTweet(id: number, userId: string, data: Partial<Pick<ScheduledTweet, "content" | "scheduledAt" | "status" | "xPostId" | "error" | "publishedAt">>): Promise<ScheduledTweet | undefined>;
  deleteScheduledTweet(id: number, userId: string): Promise<boolean>;
  getDueScheduledTweets(): Promise<ScheduledTweet[]>;
  claimScheduledTweetsBatch(batchSize?: number): Promise<ScheduledTweet[]>;
  markTweetPublished(id: number, xPostId: string): Promise<void>;
  markTweetFailed(id: number, error: string, needsReconnect?: boolean): Promise<void>;
}

class DatabaseStorage implements IStorage {
  async createSuggestion(userId: string, data: InsertSuggestion): Promise<Suggestion> {
    const [suggestion] = await db
      .insert(suggestions)
      .values({ ...data, userId })
      .returning();
    return suggestion;
  }

  async createSuggestions(userId: string, data: InsertSuggestion[]): Promise<Suggestion[]> {
    const values = data.map((d) => ({ ...d, userId }));
    return db.insert(suggestions).values(values).returning();
  }

  async getSuggestions(userId: string, status?: string): Promise<Suggestion[]> {
    let conditions = [eq(suggestions.userId, userId)];
    if (status) conditions.push(eq(suggestions.status, status));
    return db
      .select()
      .from(suggestions)
      .where(and(...conditions))
      .orderBy(desc(suggestions.createdAt));
  }

  async getSuggestion(id: number, userId: string): Promise<Suggestion | undefined> {
    const [suggestion] = await db
      .select()
      .from(suggestions)
      .where(and(eq(suggestions.id, id), eq(suggestions.userId, userId)));
    return suggestion;
  }

  async updateSuggestionImage(id: number, userId: string, imageUrl: string | null): Promise<Suggestion | undefined> {
    const [suggestion] = await db
      .update(suggestions)
      .set({ imageUrl })
      .where(and(eq(suggestions.id, id), eq(suggestions.userId, userId)))
      .returning();
    return suggestion;
  }

  async updateSuggestionStatus(
    id: number,
    userId: string,
    status: string,
    editedContent?: string
  ): Promise<Suggestion | undefined> {
    const updateData: any = { status };
    if (editedContent !== undefined) {
      updateData.editedContent = editedContent;
      updateData.charCount = editedContent.length;
    }
    const [suggestion] = await db
      .update(suggestions)
      .set(updateData)
      .where(and(eq(suggestions.id, id), eq(suggestions.userId, userId)))
      .returning();
    return suggestion;
  }

  async publishSuggestion(
    id: number,
    userId: string,
    xPostId: string
  ): Promise<Suggestion | undefined> {
    const [suggestion] = await db
      .update(suggestions)
      .set({
        status: "published",
        publishedAt: new Date(),
        xPostId,
      })
      .where(and(eq(suggestions.id, id), eq(suggestions.userId, userId)))
      .returning();
    return suggestion;
  }

  async logActivity(
    userId: string,
    action: string,
    entityType: string,
    entityId?: number,
    details?: string
  ): Promise<ActivityLog> {
    const [log] = await db
      .insert(activityLog)
      .values({ userId, action, entityType, entityId, details })
      .returning();
    return log;
  }

  async getActivityLog(userId: string, limit = 50): Promise<ActivityLog[]> {
    return db
      .select()
      .from(activityLog)
      .where(eq(activityLog.userId, userId))
      .orderBy(desc(activityLog.createdAt))
      .limit(limit);
  }

  async saveXToken(
    userId: string,
    accessToken: string,
    refreshToken?: string,
    expiresAt?: Date,
    xUsername?: string
  ): Promise<XToken> {
    const [token] = await db
      .insert(xTokens)
      .values({ userId, accessToken, refreshToken, expiresAt, xUsername })
      .onConflictDoUpdate({
        target: xTokens.userId,
        set: {
          accessToken,
          // Only overwrite the stored refresh token when X actually returns a new one.
          // If refreshToken is undefined (X didn't rotate), keep the existing value.
          ...(refreshToken !== undefined ? { refreshToken } : {}),
          expiresAt,
          xUsername,
          connectionStatus: "connected",
          updatedAt: new Date(),
        },
      })
      .returning();
    return token;
  }

  async getXToken(userId: string): Promise<XToken | undefined> {
    const [token] = await db
      .select()
      .from(xTokens)
      .where(eq(xTokens.userId, userId));
    return token;
  }

  async getAllXTokens(): Promise<XToken[]> {
    // Only return tokens that are still connected — skip permanently-broken ones
    return await db
      .select()
      .from(xTokens)
      .where(ne(xTokens.connectionStatus, "needs_reconnect"));
  }

  async deleteXToken(userId: string): Promise<boolean> {
    const result = await db
      .delete(xTokens)
      .where(eq(xTokens.userId, userId))
      .returning();
    return result.length > 0;
  }

  async markUserNeedsReconnect(userId: string): Promise<void> {
    await db
      .update(xTokens)
      .set({ connectionStatus: "needs_reconnect", updatedAt: new Date() })
      .where(eq(xTokens.userId, userId));
  }

  async getDashboardStats(userId: string) {
    const [totalSugg] = await db
      .select({ value: count() })
      .from(suggestions)
      .where(eq(suggestions.userId, userId));

    const statusCounts = await db
      .select({
        status: suggestions.status,
        count: count(),
      })
      .from(suggestions)
      .where(eq(suggestions.userId, userId))
      .groupBy(suggestions.status);

    const counts: Record<string, number> = {};
    statusCounts.forEach((s) => {
      counts[s.status] = s.count;
    });

    const [totalAuto] = await db
      .select({ value: count() })
      .from(automations)
      .where(eq(automations.userId, userId));

    const [activeAuto] = await db
      .select({ value: count() })
      .from(automations)
      .where(and(eq(automations.userId, userId), eq(automations.active, true)));

    return {
      totalSuggestions: totalSugg.value,
      approvedCount: counts["approved"] || 0,
      publishedCount: counts["published"] || 0,
      pendingCount: counts["pending"] || 0,
      rejectedCount: counts["rejected"] || 0,
      totalAutomations: totalAuto.value,
      activeAutomations: activeAuto.value,
    };
  }

  async createAutomation(userId: string, data: InsertAutomation): Promise<Automation> {
    const [automation] = await db
      .insert(automations)
      .values({ ...data, userId })
      .returning();
    return automation;
  }

  async getAutomations(userId: string): Promise<Automation[]> {
    return db
      .select()
      .from(automations)
      .where(eq(automations.userId, userId))
      .orderBy(desc(automations.createdAt));
  }

  async getAutomation(id: number, userId: string): Promise<Automation | undefined> {
    const [automation] = await db
      .select()
      .from(automations)
      .where(and(eq(automations.id, id), eq(automations.userId, userId)));
    return automation;
  }

  async updateAutomation(id: number, userId: string, data: Partial<InsertAutomation>): Promise<Automation | undefined> {
    const [automation] = await db
      .update(automations)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(automations.id, id), eq(automations.userId, userId)))
      .returning();

    if (automation && automation.active) {
      await this.clearPendingQueue(automation.id);
      const nextRun = new Date(Date.now() + (automation.intervalMinutes || 60) * 60 * 1000);
      await this.addToQueue(userId, automation.id, nextRun);
    }
    return automation;
  }

  async deleteAutomation(id: number, userId: string): Promise<boolean> {
    const result = await db
      .delete(automations)
      .where(and(eq(automations.id, id), eq(automations.userId, userId)))
      .returning();
    return result.length > 0;
  }

  async getAutomationQueue(automationId: number, userId: string): Promise<AutomationQueue[]> {
    return db
      .select()
      .from(automationQueue)
      .where(
        and(
          eq(automationQueue.automationId, automationId),
          eq(automationQueue.userId, userId),
          eq(automationQueue.status, "scheduled")
        )
      )
      .orderBy(asc(automationQueue.scheduledAt));
  }

  async getAutomationHistory(automationId: number, userId: string): Promise<AutomationQueue[]> {
    return db
      .select()
      .from(automationQueue)
      .where(
        and(
          eq(automationQueue.automationId, automationId),
          eq(automationQueue.userId, userId)
        )
      )
      .orderBy(desc(automationQueue.executedAt))
      .limit(50);
  }

  async addToQueue(userId: string, automationId: number, scheduledAt: Date): Promise<AutomationQueue> {
    // Prevent duplicate scheduling: Check if an item is already scheduled for this automation
    const existing = await db
      .select()
      .from(automationQueue)
      .where(
        and(
          eq(automationQueue.automationId, automationId),
          eq(automationQueue.status, "scheduled")
        )
      )
      .limit(1);

    if (existing.length > 0) {
      // If already scheduled, update the time if the new one is sooner, or just return existing
      return existing[0];
    }

    const [item] = await db
      .insert(automationQueue)
      .values({ userId, automationId, scheduledAt, status: "scheduled" })
      .returning();
    return item;
  }

  async updateQueueItem(id: number, data: Partial<{ status: string; tweetContent: string; xPostId: string; error: string; executedAt: Date }>): Promise<AutomationQueue | undefined> {
    const [item] = await db
      .update(automationQueue)
      .set(data)
      .where(eq(automationQueue.id, id))
      .returning();
    return item;
  }

  async getPendingQueueItems(): Promise<AutomationQueue[]> {
    const now = new Date();
    // Use log internally or remove it if not imported correctly
    console.log(`${new Date().toLocaleTimeString()} [automation] Checking for pending queue items at ${now.toISOString()}`);
    
    // First, cleanup old duplicates: any "scheduled" items for the same automation that are older than "now"
    // but not the absolute latest one among them (or just process the latest one).
    // Better strategy: process ONLY the single most recent overdue item for each automation
    // and fail/cancel the rest.
    
    return db
      .select()
      .from(automationQueue)
      .where(
        and(
          eq(automationQueue.status, "scheduled"),
          lte(automationQueue.scheduledAt, now)
        )
      )
      .orderBy(desc(automationQueue.scheduledAt)); // Process most recent first
  }

  async clearPendingQueue(automationId: number): Promise<void> {
    await db
      .delete(automationQueue)
      .where(
        and(
          eq(automationQueue.automationId, automationId),
          eq(automationQueue.status, "scheduled")
        )
      );
  }

  // ── Scheduled Tweets ────────────────────────────────────────────────────────
  async createScheduledTweet(userId: string, data: InsertScheduledTweet): Promise<ScheduledTweet> {
    const [item] = await db
      .insert(scheduledTweets)
      .values({ ...data, userId })
      .returning();
    return item;
  }

  async getScheduledTweets(userId: string): Promise<ScheduledTweet[]> {
    return db
      .select()
      .from(scheduledTweets)
      .where(eq(scheduledTweets.userId, userId))
      .orderBy(asc(scheduledTweets.scheduledAt));
  }

  async getScheduledTweet(id: number, userId: string): Promise<ScheduledTweet | undefined> {
    const [item] = await db
      .select()
      .from(scheduledTweets)
      .where(and(eq(scheduledTweets.id, id), eq(scheduledTweets.userId, userId)));
    return item;
  }

  async updateScheduledTweet(
    id: number,
    userId: string,
    data: Partial<Pick<ScheduledTweet, "content" | "scheduledAt" | "status" | "xPostId" | "error" | "publishedAt">>
  ): Promise<ScheduledTweet | undefined> {
    const [item] = await db
      .update(scheduledTweets)
      .set(data)
      .where(and(eq(scheduledTweets.id, id), eq(scheduledTweets.userId, userId)))
      .returning();
    return item;
  }

  async deleteScheduledTweet(id: number, userId: string): Promise<boolean> {
    const result = await db
      .delete(scheduledTweets)
      .where(and(eq(scheduledTweets.id, id), eq(scheduledTweets.userId, userId)))
      .returning();
    return result.length > 0;
  }

  async getDueScheduledTweets(): Promise<ScheduledTweet[]> {
    const now = new Date();
    return db
      .select()
      .from(scheduledTweets)
      .where(
        and(
          eq(scheduledTweets.publishStatus, "queued"),
          lte(scheduledTweets.scheduledAt, now)
        )
      )
      .orderBy(asc(scheduledTweets.scheduledAt));
  }

  async claimScheduledTweetsBatch(batchSize = 20): Promise<ScheduledTweet[]> {
    return db.transaction(async (tx) => {
      const now = new Date();
      const candidates = await tx
        .select({ id: scheduledTweets.id })
        .from(scheduledTweets)
        .where(
          and(
            eq(scheduledTweets.publishStatus, "queued"),
            lte(scheduledTweets.scheduledAt, now)
          )
        )
        .orderBy(asc(scheduledTweets.scheduledAt))
        .limit(batchSize);

      if (candidates.length === 0) return [];

      const ids = candidates.map((c) => c.id);
      return tx
        .update(scheduledTweets)
        .set({
          publishStatus: "publishing",
          publishAttempts: sql`${scheduledTweets.publishAttempts} + 1`,
          lastAttemptAt: now,
        })
        .where(inArray(scheduledTweets.id, ids))
        .returning();
    });
  }

  async markTweetPublished(id: number, xPostId: string): Promise<void> {
    await db
      .update(scheduledTweets)
      .set({
        publishStatus: "published",
        status: "published",
        xPostId,
        publishedAt: new Date(),
        lastError: null,
      })
      .where(eq(scheduledTweets.id, id));
  }

  async markTweetFailed(id: number, error: string, needsReconnect = false): Promise<void> {
    await db
      .update(scheduledTweets)
      .set({
        publishStatus: needsReconnect ? "needs_reconnect" : "failed",
        status: "failed",
        error,
        lastError: error,
      })
      .where(eq(scheduledTweets.id, id));
  }}

export const storage = new DatabaseStorage();