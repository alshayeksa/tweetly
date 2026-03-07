import { sql } from "drizzle-orm";
import { boolean, index, integer, jsonb, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";

// Session storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)]
);

// User storage table.
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  passwordHash: varchar("password_hash"),
  // Paddle subscription fields (column names kept for backwards compat)
  paddleCustomerId: varchar("stripe_customer_id").unique(),
  paddleSubscriptionId: varchar("stripe_subscription_id").unique(),
  subscriptionStatus: varchar("subscription_status").default("trial"), // trial | active | expired | canceled | past_due | none
  trialEndsAt: timestamp("trial_ends_at"),
  subscriptionEndsAt: timestamp("subscription_ends_at"),
  // Connected X account
  xUsername: varchar("x_username"),
  // OAuth provider IDs for social login
  googleId: varchar("google_id").unique(),
  xAuthId: varchar("x_auth_id").unique(),
  // Free plan tweet usage tracking
  plan: varchar("plan", { length: 20 }).notNull().default("free"),
  monthlyTweetLimit: integer("monthly_tweet_limit").notNull().default(25),
  tweetsUsed: integer("tweets_used").notNull().default(0),
  tweetsResetAt: timestamp("tweets_reset_at"),
  // AI provider preference
  aiProvider: varchar("ai_provider", { length: 20 }).notNull().default("gemini"),
  // Admin flag
  isAdmin: boolean("is_admin").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

import { serial } from "drizzle-orm/pg-core";

export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  token: varchar("token", { length: 64 }).notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").defaultNow(),
});
