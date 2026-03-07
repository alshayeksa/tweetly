import type { Express } from "express";
import passport from "passport";
import { authStorage } from "./storage";
import { isAuthenticated, hashPassword } from "./replitAuth";
import { logLoginEvent } from "../../auth-logger";
import type { User } from "@shared/models/auth";

// Strip all server-only / credential fields before sending to the client.
function sanitizeUser(user: User) {
  const { passwordHash, stripeCustomerId, stripeSubscriptionId, ...safe } = user as any;
  return safe;
}

export function registerAuthRoutes(app: Express): void {
  // ─── Get current user ─────────────────────────────────────────────────────
  app.get("/api/auth/user", isAuthenticated, async (req: any, res) => {
    try {
      const user = await authStorage.getUser(req.user.id);
      res.json(user ? sanitizeUser(user) : null);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // ─── Register ─────────────────────────────────────────────────────────────
  app.post("/api/auth/register", async (req, res) => {
    try {
      const { email, password, firstName, lastName } = req.body;

      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
      }
      if (password.length < 8) {
        return res.status(400).json({ message: "Password must be at least 8 characters" });
      }

      const existing = await authStorage.getUserByEmail(email.toLowerCase());
      if (existing) {
        return res.status(409).json({ message: "An account with this email already exists" });
      }

      const passwordHash = hashPassword(password);
      const user = await authStorage.createUser({ email, passwordHash, firstName, lastName });

      // Start free trial automatically
      const { startTrial } = await import("../../subscription");
      await startTrial(user.id);

      req.login(user, (err) => {
        if (err) return res.status(500).json({ message: "Login failed after registration" });
        logLoginEvent({ req, userId: user.id, email: user.email ?? null, method: "email", status: "success" });
        res.status(201).json(sanitizeUser(user));
      });
    } catch (error) {
      console.error("Registration error:", error);
      res.status(500).json({ message: "Registration failed" });
    }
  });

  // ─── Login ────────────────────────────────────────────────────────────────
  app.post("/api/login", (req, res, next) => {
    passport.authenticate("local", (err: any, user: any, info: any) => {
      if (err) return next(err);
      if (!user) {
        logLoginEvent({ req, userId: null, email: req.body?.email ?? null, method: "email", status: "failed" });
        return res.status(401).json({ message: info?.message || "Invalid credentials" });
      }
      req.login(user, (loginErr) => {
        if (loginErr) return next(loginErr);
        logLoginEvent({ req, userId: user.id, email: user.email ?? null, method: "email", status: "success" });
        res.json(sanitizeUser(user));
      });
    })(req, res, next);
  });

  // ─── Logout ───────────────────────────────────────────────────────────────
  app.post("/api/logout", (req, res) => {
    req.logout(() => {
      res.json({ message: "Logged out" });
    });
  });

  // Keep legacy GET /api/logout for backward compatibility
  app.get("/api/logout", (req, res) => {
    req.logout(() => {
      res.redirect("/");
    });
  });

  // ─── Delete Account ─────────────────────────────────────────────────────────
  // Deletes the user row; all related data is removed via ON DELETE CASCADE.
  app.delete("/api/user", isAuthenticated, async (req: any, res) => {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    try {
      const { db } = await import("../../db");
      const { users } = await import("@shared/models/auth");
      const { eq } = await import("drizzle-orm");

      await db.delete(users).where(eq(users.id, userId));

      req.logout(() => {
        res.json({ message: "Account deleted" });
      });
    } catch (err) {
      console.error("[delete-account]", err);
      res.status(500).json({ message: "Failed to delete account" });
    }
  });

  // ─── Forgot Password ────────────────────────────────────────────────────────
  app.post("/api/auth/forgot-password", async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) return res.status(400).json({ message: "Email is required" });

      const user = await authStorage.getUserByEmail(email.toLowerCase());

      // Always return 200 to prevent email enumeration
      if (!user) {
        return res.json({ message: "If this email exists, a reset link has been sent" });
      }

      // Generate secure token
      const { db } = await import("../../db");
      const { passwordResetTokens } = await import("@shared/models/auth");
      const { eq } = await import("drizzle-orm");
      const crypto = await import("crypto");

      // Delete any existing tokens for this user
      await db.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, user.id));

      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await db.insert(passwordResetTokens).values({
        userId: user.id,
        token,
        expiresAt,
      });

      // Send email via Resend HTTP API (SMTP is blocked on Render)
      const appUrl = process.env.APP_URL || `https://${req.headers.host}`;
      const resetUrl = `${appUrl}/reset-password?token=${token}`;

      const { Resend } = await import("resend");
      const resend = new Resend(process.env.RESEND_API_KEY);

      const { error: emailError } = await resend.emails.send({
        from: "Tweetly <support@tweetly.ai>",
        to: user.email!,
        subject: "Reset Your Password",
        html: `
          <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
            <h2 style="color: #0f172a;">Reset Your Password</h2>
            <p>Hello ${user.firstName || "there"},</p>
            <p>We received a request to reset your password. Click the button below to create a new password:</p>
            <a href="${resetUrl}" style="display:inline-block;background:#0f172a;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;margin:16px 0;font-weight:600;">
              Reset Password
            </a>
            <p style="color:#64748b;font-size:14px;">This link expires in <strong>1 hour</strong>. If you didn't request this, you can safely ignore this email.</p>
            <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;">
            <p style="color:#94a3b8;font-size:12px;">Or copy this link: ${resetUrl}</p>
          </div>
        `,
      });

      if (emailError) {
        console.error("[auth] Resend error:", emailError);
        throw new Error(emailError.message);
      }

      console.log(`[auth] Password reset email sent to: ${user.email}`);
      res.json({ message: "If this email exists, a reset link has been sent" });
    } catch (error) {
      console.error("Forgot password error:", error);
      res.status(500).json({ message: "Failed to send reset email" });
    }
  });

  // ─── Reset Password ──────────────────────────────────────────────────────────
  app.post("/api/auth/reset-password", async (req, res) => {
    try {
      const { token, password } = req.body;

      if (!token || !password) {
        return res.status(400).json({ message: "Token and password are required" });
      }
      if (password.length < 8) {
        return res.status(400).json({ message: "Password must be at least 8 characters" });
      }

      const { db } = await import("../../db");
      const { passwordResetTokens, users } = await import("@shared/models/auth");
      const { eq, and, gt } = await import("drizzle-orm");

      // Find valid token
      const [resetToken] = await db
        .select()
        .from(passwordResetTokens)
        .where(
          and(
            eq(passwordResetTokens.token, token),
            gt(passwordResetTokens.expiresAt, new Date())
          )
        );

      if (!resetToken || resetToken.usedAt) {
        return res.status(400).json({ message: "Invalid or expired reset link" });
      }

      // Update password
      const newHash = hashPassword(password);
      await db.update(users)
        .set({ passwordHash: newHash, updatedAt: new Date() })
        .where(eq(users.id, resetToken.userId));

      // Mark token as used
      await db.update(passwordResetTokens)
        .set({ usedAt: new Date() })
        .where(eq(passwordResetTokens.id, resetToken.id));

      res.json({ message: "Password updated successfully" });
    } catch (error) {
      console.error("Reset password error:", error);
      res.status(500).json({ message: "Failed to reset password" });
    }
  });

  // ─── Google OAuth ──────────────────────────────────────────────────────────
  app.get("/api/auth/google",
    passport.authenticate("google", { scope: ["profile", "email"] })
  );

  app.get("/api/auth/google/callback",
    passport.authenticate("google", { failureRedirect: "/login?error=google_failed" }),
    (req: any, res) => {
      if (req.user) {
        logLoginEvent({ req, userId: req.user.id, email: req.user.email ?? null, method: "google", status: "success" });
      }
      res.redirect("/");
    }
  );

  // ─── X (Twitter) Sign-In ───────────────────────────────────────────────────
  // Reuses the existing X OAuth 2.0 app credentials but creates/logs in a user
  app.get("/api/auth/x/signin", async (req, res) => {
    try {
      const { X_CLIENT_ID, X_CALLBACK_URL } = process.env;
      if (!X_CLIENT_ID) return res.redirect("/login?error=x_not_configured");

      const crypto = await import("crypto");
      const state = crypto.randomBytes(16).toString("hex");
      const codeVerifier = crypto.randomBytes(32).toString("base64url");
      const codeChallenge = crypto.createHash("sha256").update(codeVerifier).digest("base64url");

      // Reuse the same /api/x/callback URL; flag distinguishes sign-in vs connect
      (req.session as any).xSigninState = state;
      (req.session as any).xSigninCodeVerifier = codeVerifier;
      (req.session as any).xAuthPurpose = "signin";

      const callbackUrl = X_CALLBACK_URL ||
        `${req.headers["x-forwarded-proto"] || req.protocol}://${req.headers.host}/api/x/callback`;

      const params = new URLSearchParams({
        response_type: "code",
        client_id: X_CLIENT_ID,
        redirect_uri: callbackUrl,
        scope: "tweet.read tweet.write users.read offline.access media.write",
        state,
        code_challenge: codeChallenge,
        code_challenge_method: "S256",
      });

      res.redirect(`https://x.com/i/oauth2/authorize?${params}`);
    } catch (err) {
      console.error("X sign-in error:", err);
      res.redirect("/login?error=x_failed");
    }
  });

}
