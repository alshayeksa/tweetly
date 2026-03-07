export * from "./models/auth";

import { sql } from "drizzle-orm";
import {
  pgTable,
  serial,
  text,
  varchar,
  integer,
  timestamp,
  boolean,
  jsonb,
  decimal,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "./models/auth";

export const suggestions = pgTable("suggestions", {
  id: serial("id").primaryKey(),
  topicId: integer("topic_id"),
  userId: varchar("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  charCount: integer("char_count").notNull(),
  status: varchar("status", { length: 20 }).notNull().default("pending"),
  editedContent: text("edited_content"),
  publishedAt: timestamp("published_at"),
  xPostId: varchar("x_post_id"),
  prompt: text("prompt"),
  automationId: integer("automation_id"),
  imageUrl: text("image_url"),
  threadId: varchar("thread_id"),
  threadOrder: integer("thread_order"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const activityLog = pgTable("activity_log", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  action: varchar("action", { length: 50 }).notNull(),
  entityType: varchar("entity_type", { length: 30 }).notNull(),
  entityId: integer("entity_id"),
  details: text("details"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const xTokens = pgTable("x_tokens", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token"),
  expiresAt: timestamp("expires_at"),
  xUsername: varchar("x_username"),
  connectionStatus: varchar("connection_status", { length: 20 }).notNull().default("connected"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const automations = pgTable("automations", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  prompt: text("prompt").notNull(),
  tweetsPerBatch: integer("tweets_per_batch").notNull().default(3),
  intervalMinutes: integer("interval_minutes").notNull().default(60),
  language: varchar("language", { length: 20 }),
  tone: varchar("tone", { length: 50 }),
  hashtags: text("hashtags").array().notNull().default(sql`'{}'::text[]`),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const automationQueue = pgTable("automation_queue", {
  id: serial("id").primaryKey(),
  automationId: integer("automation_id")
    .notNull()
    .references(() => automations.id, { onDelete: "cascade" }),
  userId: varchar("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  scheduledAt: timestamp("scheduled_at").notNull(),
  status: varchar("status", { length: 20 }).notNull().default("scheduled"),
  tweetContent: text("tweet_content"),
  xPostId: varchar("x_post_id"),
  error: text("error"),
  executedAt: timestamp("executed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const scheduledTweets = pgTable("scheduled_tweets", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  scheduledAt: timestamp("scheduled_at").notNull(),
  status: varchar("status", { length: 20 }).notNull().default("pending"), // pending | published | failed | cancelled
  xPostId: varchar("x_post_id"),
  error: text("error"),
  publishedAt: timestamp("published_at"),
  publishStatus: varchar("publish_status", { length: 30 }).notNull().default("queued"),
  publishAttempts: integer("publish_attempts").notNull().default(0),
  lastAttemptAt: timestamp("last_attempt_at"),
  lastError: text("last_error"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertScheduledTweetSchema = createInsertSchema(scheduledTweets).omit({
  id: true,
  userId: true,
  createdAt: true,
  publishedAt: true,
  xPostId: true,
  error: true,
  status: true,
}).extend({
  scheduledAt: z.coerce.date(),
});

export type ScheduledTweet = typeof scheduledTweets.$inferSelect;
export type InsertScheduledTweet = z.infer<typeof insertScheduledTweetSchema>;
export type ScheduledTweetPublishStatus = "queued" | "publishing" | "published" | "failed" | "needs_reconnect";

export const insertSuggestionSchema = createInsertSchema(suggestions).omit({
  id: true,
  topicId: true,
  userId: true,
  createdAt: true,
  publishedAt: true,
  xPostId: true,
});

export const insertAutomationSchema = createInsertSchema(automations).omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAutomationQueueSchema = createInsertSchema(automationQueue).omit({
  id: true,
  userId: true,
  createdAt: true,
  executedAt: true,
});

export type Suggestion = typeof suggestions.$inferSelect;
export type InsertSuggestion = z.infer<typeof insertSuggestionSchema>;
export type ActivityLog = typeof activityLog.$inferSelect;
export type XToken = typeof xTokens.$inferSelect;
export type Automation = typeof automations.$inferSelect;
export type InsertAutomation = z.infer<typeof insertAutomationSchema>;
export type AutomationQueue = typeof automationQueue.$inferSelect;
export type InsertAutomationQueue = z.infer<typeof insertAutomationQueueSchema>;

// ── Subscription Renewal History ──────────────────────────────────────────────
export const subscriptionRenewals = pgTable("subscription_renewals", {
  id:                   serial("id").primaryKey(),
  userId:               varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  paddleCustomerId:     varchar("paddle_customer_id"),
  paddleSubscriptionId: varchar("paddle_subscription_id"),
  paddleTransactionId:  varchar("paddle_transaction_id"),
  plan:                 varchar("plan", { length: 20 }).notNull(),
  monthlyTweetLimit:    integer("monthly_tweet_limit").notNull(),
  eventType:            varchar("event_type", { length: 30 }).notNull(),
  periodStart:          timestamp("period_start").notNull(),
  periodEnd:            timestamp("period_end").notNull(),
  status:               varchar("status", { length: 20 }).notNull(),
  amountSar:            integer("amount_sar"),
  rawPayload:           jsonb("raw_payload"),
  createdAt:            timestamp("created_at").defaultNow().notNull(),
});

export type SubscriptionRenewal = typeof subscriptionRenewals.$inferSelect;

// ── Vouchers ──────────────────────────────────────────────────────────────────
export const vouchers = pgTable("vouchers", {
  id:              serial("id").primaryKey(),
  code:            varchar("code", { length: 50 }).notNull().unique(),
  discountPercent: integer("discount_percent").notNull(),
  expiresAt:       timestamp("expires_at"),
  maxUses:         integer("max_uses"),          // null = unlimited
  usedCount:       integer("used_count").notNull().default(0),
  isActive:        boolean("is_active").notNull().default(true),
  plan:            varchar("plan", { length: 20 }), // null = all plans
  createdAt:       timestamp("created_at").defaultNow().notNull(),
});

export const voucherUses = pgTable("voucher_uses", {
  id:               serial("id").primaryKey(),
  voucherId:        integer("voucher_id").notNull().references(() => vouchers.id, { onDelete: "cascade" }),
  userId:           varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  usedAt:           timestamp("used_at").defaultNow().notNull(),
  plan:             varchar("plan", { length: 20 }).notNull(),
  originalAmount:   integer("original_amount").notNull(),
  discountedAmount: integer("discounted_amount").notNull(),
});

export type Voucher = typeof vouchers.$inferSelect;
export type VoucherUse = typeof voucherUses.$inferSelect;

// ── Prompt Categories ─────────────────────────────────────────────────────────
export const promptCategories = pgTable("prompt_categories", {
  id:        serial("id").primaryKey(),
  value:     varchar("value", { length: 50 }).notNull().unique(),
  labelAr:   varchar("label_ar", { length: 100 }).notNull(),
  labelEn:   varchar("label_en", { length: 100 }).notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type PromptCategory = typeof promptCategories.$inferSelect;

// ── Prompt Templates ──────────────────────────────────────────────────────────
export const promptTemplates = pgTable("prompt_templates", {
  id:         serial("id").primaryKey(),
  categoryId: integer("category_id").notNull().references(() => promptCategories.id, { onDelete: "cascade" }),
  titleAr:    varchar("title_ar", { length: 200 }).notNull(),
  titleEn:    varchar("title_en", { length: 200 }).notNull(),
  promptText: text("prompt_text").notNull(),
  language:   varchar("language", { length: 10 }).notNull().default("ar"),
  isActive:   boolean("is_active").notNull().default(true),
  sortOrder:  integer("sort_order").notNull().default(0),
  createdAt:  timestamp("created_at").defaultNow().notNull(),
});

export type PromptTemplate = typeof promptTemplates.$inferSelect;

// plan_prices table removed — prices now managed via ENV variables
// PRICE_STARTER_SAR, PRICE_STARTER_USD, PRICE_CREATOR_SAR, PRICE_CREATOR_USD, PRICE_PRO_SAR, PRICE_PRO_USD

// ── Login History ───────────────────────────────────────────────────
export const loginHistory = pgTable("login_history", {
  id:          serial("id").primaryKey(),
  userId:      varchar("user_id").references(() => users.id, { onDelete: "set null" }),
  email:       varchar("email", { length: 255 }),     // snapshot at login time
  method:      varchar("method", { length: 20 }).notNull(), // email | google | x
  status:      varchar("status", { length: 20 }).notNull(), // success | failed
  ip:          varchar("ip", { length: 90 }),
  userAgent:   text("user_agent"),
  browser:     varchar("browser", { length: 50 }),
  os:          varchar("os", { length: 50 }),
  device:      varchar("device", { length: 20 }),
  country:     varchar("country", { length: 100 }),
  countryCode: varchar("country_code", { length: 10 }),
  city:        varchar("city", { length: 100 }),
  region:      varchar("region", { length: 100 }),
  isp:         varchar("isp", { length: 200 }),
  createdAt:   timestamp("created_at").defaultNow().notNull(),
});

export type LoginHistory = typeof loginHistory.$inferSelect;
