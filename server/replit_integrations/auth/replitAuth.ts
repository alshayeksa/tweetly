import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import connectPg from "connect-pg-simple";
import { authStorage } from "./storage";
import crypto from "crypto";

// ─── Password Helpers ─────────────────────────────────────────────────────────
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  const hashVerify = crypto.scryptSync(password, salt, 64).toString("hex");
  return hash === hashVerify;
}

// ─── Session Setup ────────────────────────────────────────────────────────────
export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000;
  const pgStore = connectPg(session);
  const databaseUrl = process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL;

  const sessionStore = new pgStore({
    conString: databaseUrl,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });

  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: sessionTtl,
    },
  });
}

// ─── Passport Setup ───────────────────────────────────────────────────────────
export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(
      { usernameField: "email", passwordField: "password" },
      async (email, password, done) => {
        try {
          const user = await authStorage.getUserByEmail(email.toLowerCase());
          if (!user || !user.passwordHash) {
            return done(null, false, { message: "Invalid email or password" });
          }
          if (!verifyPassword(password, user.passwordHash)) {
            return done(null, false, { message: "Invalid email or password" });
          }
          return done(null, user);
        } catch (err) {
          return done(err);
        }
      }
    )
  );

  passport.serializeUser((user: any, cb) => cb(null, user.id));
  passport.deserializeUser(async (id: string, cb) => {
    try {
      const user = await authStorage.getUser(id);
      cb(null, user ?? false);
    } catch (err) {
      cb(err);
    }
  });

  // ─── Google OAuth Strategy ────────────────────────────────────────────────
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    passport.use(
      new GoogleStrategy(
        {
          clientID: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          callbackURL: process.env.GOOGLE_CALLBACK_URL || "/api/auth/google/callback",
        },
        async (_accessToken, _refreshToken, profile, done) => {
          try {
            const { db } = await import("../../db");
            const { users } = await import("@shared/models/auth");
            const { eq, or } = await import("drizzle-orm");
            const { startTrial } = await import("../../subscription");

            const email = profile.emails?.[0]?.value?.toLowerCase();
            const googleId = profile.id;

            // Find by googleId first, then by email
            let [user] = await db.select().from(users).where(eq(users.googleId, googleId));

            if (!user && email) {
              [user] = await db.select().from(users).where(eq(users.email, email));
            }

            if (user) {
              // Update googleId if not set, and update name/avatar if missing
              const updates: any = {};
              if (!user.googleId) updates.googleId = googleId;
              if (!user.firstName && profile.name?.givenName) updates.firstName = profile.name.givenName;
              if (!user.lastName && profile.name?.familyName) updates.lastName = profile.name.familyName;
              if (!user.profileImageUrl && profile.photos?.[0]?.value) updates.profileImageUrl = profile.photos[0].value;
              if (Object.keys(updates).length > 0) {
                await db.update(users).set({ ...updates, updatedAt: new Date() }).where(eq(users.id, user.id));
                Object.assign(user, updates);
              }
              return done(null, user);
            }

            // Create new user
            const { nanoid } = await import("nanoid");
            const [newUser] = await db.insert(users).values({
              id: nanoid(),
              email: email || null,
              googleId,
              firstName: profile.name?.givenName || null,
              lastName: profile.name?.familyName || null,
              profileImageUrl: profile.photos?.[0]?.value || null,
            }).returning();

            await startTrial(newUser.id);
            return done(null, newUser);
          } catch (err) {
            return done(err as Error);
          }
        }
      )
    );
  } else {
    console.warn("[auth] GOOGLE_CLIENT_ID/SECRET not set — Google login disabled");
  }
}

// ─── Auth Middleware ──────────────────────────────────────────────────────────
export const isAuthenticated: RequestHandler = (req, res, next) => {
  if (req.isAuthenticated()) return next();
  res.status(401).json({ message: "Unauthorized" });
};
