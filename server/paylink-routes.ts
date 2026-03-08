import type { Express } from "express";
import { isAuthenticated } from "./replit_integrations/auth/replitAuth";
import { db } from "./db";
import { users } from "@shared/models/auth";
import { subscriptionRenewals, vouchers, voucherUses } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { getSubscriptionInfo, updateSubscriptionFromPaylink, PLAN_PRICES_SAR, getPlanPrices, PLAN_TWEET_LIMITS } from "./subscription";

// ─────────────────────────────────────────────────────────
// Paylink.sa base URLs
// ─────────────────────────────────────────────────────────
const PAYLINK_BASE =
  process.env.PAYLINK_ENV === "production"
    ? "https://restapi.paylink.sa"
    : "https://restpilot.paylink.sa"; // sandbox / test

// ─────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────

const FETCH_TIMEOUT_MS = 15_000; // 15 seconds

/** fetch() wrapper with a hard timeout to prevent hanging requests */

// ── Parse orderNumber safely (userId may contain underscores) ────────────────
// Format: {userId}_{plan}_{[voucherCode_]timestamp}
// Strategy: plan is always starter|creator|pro — find it, then split around it
function parseOrderNumber(orderNumber: string): { userId: string; plan: string; ts: string; voucherCode: string | undefined } | null {
  const VALID_PLANS = ["starter", "creator", "pro"];
  for (const plan of VALID_PLANS) {
    const marker = `_${plan}_`;
    const idx = orderNumber.indexOf(marker);
    if (idx === -1) continue;
    const userId = orderNumber.slice(0, idx);
    const rest   = orderNumber.slice(idx + marker.length); // "timestamp" or "VOUCHER_timestamp"
    const restParts = rest.split("_");
    const ts = restParts[restParts.length - 1];
    const voucherCode = restParts.length >= 2 ? restParts.slice(0, -1).join("_") : undefined;
    if (!userId || !ts || isNaN(Number(ts))) continue;
    return { userId, plan, ts, voucherCode };
  }
  return null;
}

async function fetchWithTimeout(url: string, options: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (err: any) {
    if (err.name === "AbortError") {
      throw new Error(`Paylink request timed out after ${FETCH_TIMEOUT_MS / 1000}s: ${url}`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/** Authenticate with Paylink and return a JWT token */
async function getPaylinkToken(): Promise<string> {
  const apiId     = process.env.PAYLINK_API_ID!;
  const secretKey = process.env.PAYLINK_SECRET_KEY!;

  const res = await fetchWithTimeout(`${PAYLINK_BASE}/api/auth`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ apiId, secretKey, persistToken: false }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Paylink auth failed: ${err}`);
  }

  const data = await res.json();
  const token = data?.id_token;
  if (!token) throw new Error("Paylink auth: no id_token in response");
  return token;
}

/** Create a Paylink invoice and return { transactionNo, url } */
async function createPaylinkInvoice(params: {
  orderNumber: string;
  amount:      number;
  clientName:  string;
  clientEmail: string;
  clientMobile?: string;
  productTitle: string;
  callBackUrl:  string;
  cancelUrl:    string;
}): Promise<{ transactionNo: string; url: string }> {
  const token = await getPaylinkToken();

  const body = {
    orderNumber:  params.orderNumber,
    amount:       params.amount,
    callBackUrl:  params.callBackUrl,
    cancelUrl:    params.cancelUrl,
    clientName:   params.clientName,
    clientEmail:  params.clientEmail,
    clientMobile: params.clientMobile || "0500000000",
    currency:     "SAR",
    note:         params.productTitle,
    products: [
      {
        title:       params.productTitle,
        price:       params.amount,
        qty:         1,
        description: params.productTitle,
        isDigital:   true,
        specificVat: 15,
        productCost: params.amount,
      },
    ],
    supportedCardBrands: ["mada", "visaMastercard", "amex", "stcpay"],
    displayPending: true,
  };

  const res = await fetchWithTimeout(`${PAYLINK_BASE}/api/addInvoice`, {
    method:  "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Paylink createInvoice failed: ${err}`);
  }

  const data = await res.json();
  const transactionNo: string = data?.transactionNo;
  const url: string = data?.url;

  if (!transactionNo || !url) {
    throw new Error("Paylink: missing transactionNo or url in response");
  }

  return { transactionNo, url };
}

/** Verify invoice status by transactionNo */
async function getPaylinkInvoice(transactionNo: string): Promise<{
  orderStatus: string;
  amount:      number;
  orderNumber: string;
}> {
  const token = await getPaylinkToken();

  const res = await fetchWithTimeout(`${PAYLINK_BASE}/api/getInvoice/${transactionNo}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) throw new Error(`Paylink getInvoice failed: ${res.statusText}`);
  return res.json();
}

// ─────────────────────────────────────────────────────────
// Routes
// ─────────────────────────────────────────────────────────
export function registerPaylinkRoutes(app: Express) {

  // ── Plan prices (public — no auth required) ──────────────────────────────
  app.get("/api/plans/prices", async (_req, res) => {
    try {
      const { sar, usd } = getPlanPrices();
      res.json({
        starter: { sar: sar.starter, usd: usd.starter },
        creator: { sar: sar.creator, usd: usd.creator },
        pro:     { sar: sar.pro,     usd: usd.pro     },
      });
    } catch {
      res.status(500).json({ message: "Failed to fetch plan prices" });
    }
  });

  // ── Get plan config (features + limits) — read from server constants ──────
  app.get("/api/plans/config", async (_req, res) => {
    try {
      const { sar, usd } = getPlanPrices();
      res.json({
        free: {
          key: "free",
          label: "Free",
          tweetLimit: 30,
          threadLimit: 3,
          autopilot: false,
          advancedScheduling: false,
          aiWrite: true,
          aiRewrite: false,
          aiToneTraining: false,
          prioritySupport: false,
          usd: 0,
          sar: 0,
        },
        starter: {
          key: "starter",
          label: "Starter",
          tweetLimit: 300,
          threadLimit: 6,
          autopilot: false,
          advancedScheduling: false,
          aiWrite: true,
          aiRewrite: false,
          aiToneTraining: false,
          prioritySupport: false,
          usd: usd.starter ?? 15,
          sar: sar.starter ?? 55,
        },
        creator: {
          key: "creator",
          label: "Creator",
          tweetLimit: 600,
          threadLimit: 999,
          autopilot: false,
          advancedScheduling: true,
          aiWrite: true,
          aiRewrite: true,
          aiToneTraining: false,
          prioritySupport: false,
          usd: usd.creator ?? 29,
          sar: sar.creator ?? 109,
        },
        pro: {
          key: "pro",
          label: "Autopilot",
          tweetLimit: 1500,
          threadLimit: 999,
          autopilot: true,
          advancedScheduling: true,
          aiWrite: true,
          aiRewrite: true,
          aiToneTraining: true,
          prioritySupport: true,
          usd: usd.pro ?? 69,
          sar: sar.pro ?? 259,
        },
      });
    } catch {
      res.status(500).json({ message: "Failed to fetch plan config" });
    }
  });

  // ── Get subscription info ──────────────────────────────
  app.get("/api/subscription", isAuthenticated, async (req: any, res) => {
    try {
      const info = await getSubscriptionInfo(req.user?.id);
      res.json(info);
    } catch {
      res.status(500).json({ message: "Failed to get subscription info" });
    }
  });

  // ── Validate voucher code ──────────────────────────────
  // POST /api/voucher/validate
  // Body: { code: string, plan?: string }
  app.post("/api/voucher/validate", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id as string;
      const code   = (req.body.code as string)?.trim().toUpperCase();
      const plan   = (req.body.plan as string)?.toLowerCase();

      if (!code) return res.status(400).json({ valid: false, message: "Voucher code is required" });

      const [voucher] = await db.select().from(vouchers).where(eq(vouchers.code, code));

      if (!voucher)            return res.json({ valid: false, message: "Invalid voucher code" });
      if (!voucher.isActive)   return res.json({ valid: false, message: "This voucher is no longer active" });
      if (voucher.expiresAt && voucher.expiresAt <= new Date())
                               return res.json({ valid: false, message: "This voucher has expired" });
      if (voucher.maxUses !== null && voucher.usedCount >= voucher.maxUses)
                               return res.json({ valid: false, message: "This voucher has reached its usage limit" });
      if (voucher.plan && plan && voucher.plan !== plan)
                               return res.json({ valid: false, message: `This voucher is only valid for the ${voucher.plan} plan` });

      // Check if this user already used this voucher
      const [alreadyUsed] = await db
        .select()
        .from(voucherUses)
        .where(and(eq(voucherUses.voucherId, voucher.id), eq(voucherUses.userId, userId)));
      if (alreadyUsed) return res.json({ valid: false, message: "You have already used this voucher" });

      res.json({
        valid:           true,
        discountPercent: voucher.discountPercent,
        voucherPlan:     voucher.plan ?? null,  // null = valid for all plans
      });
    } catch (err: any) {
      console.error("[voucher] Validate error:", err);
      res.status(500).json({ valid: false, message: "Failed to validate voucher" });
    }
  });

  // ── Create checkout invoice ────────────────────────────
  // POST /api/subscription/checkout
  // Body: { plan: "starter" | "creator" | "pro", voucherCode?: string }
  app.post("/api/subscription/checkout", isAuthenticated, async (req: any, res) => {
    try {
      if (!process.env.PAYLINK_API_ID || !process.env.PAYLINK_SECRET_KEY) {
        return res.status(503).json({ message: "Payments not configured" });
      }

      const userId      = req.user?.id as string;
      const plan        = (req.body.plan as string)?.toLowerCase() || "starter";
      const rawCode     = (req.body.voucherCode as string | undefined)?.trim().toUpperCase();
      const voucherCode = rawCode || undefined;

      const [user] = await db.select().from(users).where(eq(users.id, userId));
      if (!user) return res.status(404).json({ message: "User not found" });

      // Price in SAR from DB (with env fallback)
      const { sar: sarPrices } = getPlanPrices();
      let amountSAR = sarPrices[plan] ?? PLAN_PRICES_SAR["starter"];
      let appliedVoucherId: number | undefined;

      // Apply voucher discount if provided
      if (voucherCode) {
        const [voucher] = await db.select().from(vouchers).where(eq(vouchers.code, voucherCode));
        const now = new Date();
        const voucherValid =
          voucher &&
          voucher.isActive &&
          (!voucher.expiresAt || voucher.expiresAt > now) &&
          (voucher.maxUses === null || voucher.usedCount < voucher.maxUses);

        if (voucherValid) {
          // Check user hasn't already used this voucher
          const [alreadyUsed] = await db
            .select()
            .from(voucherUses)
            .where(and(eq(voucherUses.voucherId, voucher.id), eq(voucherUses.userId, userId)));
          if (!alreadyUsed) {
            amountSAR = Math.round(amountSAR * (1 - voucher.discountPercent / 100));
            appliedVoucherId = voucher.id;
          }
        }
      }

      const baseUrl = `${req.headers["x-forwarded-proto"] || req.protocol}://${req.headers.host}`;

      // orderNumber encodes userId + plan + [voucherCode +] timestamp for webhook lookup
      // Format: userId_plan_timestamp  OR  userId_plan_VOUCHERCODE_timestamp
      const orderNumber = voucherCode && appliedVoucherId
        ? `${userId}_${plan}_${voucherCode}_${Date.now()}`
        : `${userId}_${plan}_${Date.now()}`;

      const planLabels: Record<string, string> = {
        starter: `Tweetly Starter – ${PLAN_TWEET_LIMITS["starter"]} تغريدة/شهر`,
        creator: `Tweetly Creator – ${PLAN_TWEET_LIMITS["creator"]} تغريدة/شهر`,
        pro:     `Tweetly Autopilot – ${PLAN_TWEET_LIMITS["pro"]} تغريدة/شهر + أتمتة`,
      };

      const { url } = await createPaylinkInvoice({
        orderNumber,
        amount:       amountSAR,
        clientName:   `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || "Customer",
        clientEmail:  user.email ?? "",
        productTitle: planLabels[plan] ?? `Tweetly ${plan}`,
        callBackUrl:  `${baseUrl}/settings?success=subscribed&plan=${plan}&order=${orderNumber}`,
        cancelUrl:    `${baseUrl}/pricing?canceled=1`,
      });

      res.json({ url });
    } catch (err: any) {
      console.error("[paylink] Checkout error:", err);
      res.status(500).json({ message: err.message || "Failed to create checkout" });
    }
  });

  // ── Payment Webhook ────────────────────────────────────────────────────────
  // Paylink POSTs here when payment is completed.
  // Configure in My Paylink → Settings → API → Webhook URL:
  //   https://YOUR_DOMAIN/api/webhooks/paylink
  app.post("/api/webhooks/paylink", async (req: any, res) => {
    try {
      // ── 1. Verify secret header (primary security) ───────────────────────
      const headerSecret = process.env.PAYLINK_WEBHOOK_SECRET;
      if (headerSecret) {
        const incoming = req.headers["x-paylink-secret"] || req.headers["x-webhook-secret"];
        if (incoming !== headerSecret) {
          console.warn("[paylink] Webhook: invalid secret header");
          return res.status(401).json({ message: "Unauthorized" });
        }
      }

      const body = req.body;
      console.log("[paylink] Webhook received:", JSON.stringify(body));

      // ── 2. Parse payload — support Paylink v1 (orderStatus) and v2 (status) ──
      const orderStatus:   string = body?.orderStatus ?? body?.status ?? "";
      const orderNumber:   string = body?.merchantOrderNumber ?? body?.orderNumber ?? "";
      const transactionNo: string = body?.transactionNo ?? "";
      const amount:        number = Number(body?.amount ?? 0);

      // Only process paid orders
      if (orderStatus !== "Paid") {
        console.log(`[paylink] Webhook: skipping status="${orderStatus}" (not Paid)`);
        return res.json({ received: true, status: orderStatus });
      }

      // ── 3. Optional API verification (best-effort — never blocks processing) ──
      // If transactionNo is available, verify with Paylink API as extra security.
      // On failure (wrong PAYLINK_ENV, network error, etc.) we trust the secret header.
      if (transactionNo) {
        try {
          const invoice = await getPaylinkInvoice(transactionNo);
          if (invoice.orderStatus !== "Paid") {
            console.warn(`[paylink] Webhook: API says not Paid (${invoice.orderStatus}) — skipping`);
            return res.status(400).json({ message: "Payment not verified" });
          }
          console.log("[paylink] Webhook: API verification passed");
        } catch (e) {
          // Don't block: secret header already verified. Log and continue.
          console.warn("[paylink] Webhook: API verification skipped (trusting secret header):", (e as any)?.message);
        }
      }

      // ── 4. Parse orderNumber safely (handles userIds containing underscores) ──
      const parsed = parseOrderNumber(orderNumber);
      if (!parsed) {
        console.warn(`[paylink] Webhook: skipping unrecognised orderNumber="${orderNumber}" — looks like a test or external invoice`);
        return res.json({ received: true });
      }
      const { userId, plan, ts, voucherCode: webhookVoucherCode } = parsed;

      // ── 5. Activate subscription ─────────────────────────────────────────
      const now           = new Date();
      const periodStart   = now;
      const periodEnd     = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      await updateSubscriptionFromPaylink(userId, plan, periodStart, periodEnd, {
        transactionNo,
        orderNumber,
        amount,
        rawPayload: body,
      });

      // ── Record voucher usage if a voucher was applied ──
      if (webhookVoucherCode) {
        try {
          const [voucher] = await db
            .select()
            .from(vouchers)
            .where(eq(vouchers.code, webhookVoucherCode));

          if (voucher) {
            // Increment used_count
            await db
              .update(vouchers)
              .set({ usedCount: voucher.usedCount + 1 })
              .where(eq(vouchers.id, voucher.id));

            // Calculate original and discounted amounts for the audit trail
            const { sar: sarPricesW } = getPlanPrices();
            const originalAmount    = sarPricesW[plan] ?? 0;
            const discountedAmount  = Math.round(originalAmount * (1 - voucher.discountPercent / 100));

            // Insert use record (ignore if already exists for this user+voucher)
            const [alreadyUsed] = await db
              .select()
              .from(voucherUses)
              .where(and(eq(voucherUses.voucherId, voucher.id), eq(voucherUses.userId, userId)));

            if (!alreadyUsed) {
              await db.insert(voucherUses).values({
                voucherId:        voucher.id,
                userId,
                plan,
                originalAmount,
                discountedAmount,
              });
            }
            console.log(`[paylink] 🎟️ Voucher "${webhookVoucherCode}" used: user=${userId} plan=${plan} ${originalAmount}→${discountedAmount} SAR`);
          }
        } catch (vErr) {
          // Non-fatal: subscription was already activated above
          console.error("[paylink] Webhook: failed to record voucher use", vErr);
        }
      }

      console.log(`[paylink] ✅ Payment confirmed: user=${userId} plan=${plan} amount=${amount} SAR`);
      res.json({ received: true });
    } catch (err: any) {
      console.error("[paylink] Webhook handler error:", err);
      res.status(500).json({ message: "Webhook handler failed" });
    }
  });

  // ── Direct payment verify (called by frontend after redirect) ──
  // GET /api/subscription/verify?order=userId_plan_timestamp
  app.get("/api/subscription/verify", isAuthenticated, async (req: any, res) => {
    try {
      const userId    = req.user?.id as string;
      const orderNum  = (req.query.order as string)?.trim();

      if (!orderNum) return res.status(400).json({ message: "Missing order" });

      // Parse orderNumber safely (userId may contain underscores)
      const parsedOrder = parseOrderNumber(orderNum);
      if (!parsedOrder) {
        return res.status(400).json({ message: "Invalid order format" });
      }
      const { userId: orderUserId, plan, ts } = parsedOrder;

      // Security: only the owner can verify their order
      if (orderUserId !== userId) {
        console.warn(`[paylink] verify: forbidden — orderUserId="${orderUserId}" vs userId="${userId}"`);
        return res.status(403).json({ message: "Forbidden" });
      }

      // Check if already activated (webhook may have already processed it)
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      if (user && user.plan === plan && user.subscriptionStatus === "active") {
        return res.json({ verified: true, alreadyActive: true, plan });
      }

      // Strategy: webhook activates the subscription async.
      // verify endpoint checks DB first, then falls back to Paylink API.
      console.log(`[paylink] verify: checking order="${orderNum}" user=${userId} plan=${plan}`);

      // Re-check DB (webhook may have just fired)
      const [freshUser] = await db.select().from(users).where(eq(users.id, userId));
      if (freshUser && freshUser.plan === plan && freshUser.subscriptionStatus === "active") {
        console.log(`[paylink] verify: webhook already activated user=${userId} plan=${plan}`);
        return res.json({ verified: true, alreadyActive: true, plan });
      }

      // Fallback: call Paylink API to verify and activate manually
      let verified = false;
      let transactionNo = "";
      let amount = 0;

      try {
        const authRes = await fetchWithTimeout(`${PAYLINK_BASE}/api/auth`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            apiId: process.env.PAYLINK_API_ID,
            secretKey: process.env.PAYLINK_SECRET_KEY,
            persistToken: false,
          }),
        });
        const authData = await authRes.json();
        const token = authData.id_token;
        if (!token) {
          console.error("[paylink] verify: auth failed", JSON.stringify(authData));
          return res.status(502).json({ message: "Paylink auth failed" });
        }

        // Try getInvoice by transactionNo if available in query
        const txParam = (req.query.tx as string)?.trim();
        let match: any = null;

        if (txParam) {
          try {
            const txRes = await fetchWithTimeout(`${PAYLINK_BASE}/api/getInvoice/${txParam}`,
              { headers: { Authorization: `Bearer ${token}` } }
            );
            const txData = await txRes.json();
            console.log(`[paylink] verify: tx lookup:`, JSON.stringify(txData).slice(0, 200));
            if (txData?.orderStatus === "Paid" &&
               (txData?.merchantOrderNumber === orderNum || txData?.orderNumber === orderNum)) {
              match = txData;
            }
          } catch { /* ignore */ }
        }

        // Fallback: search by merchantOrderNumber across pages
        if (!match) {
          for (const page of [0, 1]) {
            try {
              const listRes = await fetchWithTimeout(
                `${PAYLINK_BASE}/api/getInvoices?page=${page}&pageSize=50&orderby=createdAt&order=desc`,
                { headers: { Authorization: `Bearer ${token}` } }
              );
              const listData = await listRes.json();
              const invoices: any[] = listData?.invoices ?? listData?.content ?? [];
              console.log(`[paylink] verify: page=${page} invoices=${invoices.length}`);
              match = invoices.find((inv: any) =>
                inv.merchantOrderNumber === orderNum || inv.orderNumber === orderNum
              );
              if (match) break;
            } catch { break; }
          }
        }

        if (match?.orderStatus === "Paid") {
          verified = true;
          transactionNo = match.transactionNo ?? "";
          amount = Number(match.amount ?? 0);
          console.log(`[paylink] verify: found via API tx=${transactionNo}`);
        } else {
          console.warn(`[paylink] verify: not found in Paylink API`);
        }
      } catch (e) {
        console.error("[paylink] verify: API error", e);
        return res.status(502).json({ message: "Could not reach Paylink" });
      }

      if (!verified) {
        return res.json({ verified: false, message: "Payment not confirmed yet" });
      }

      const now       = new Date();
      const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      await updateSubscriptionFromPaylink(userId, plan, now, periodEnd, {
        transactionNo,
        orderNumber: orderNum,
        amount,
        rawPayload: { source: "verify-endpoint" },
      });

      console.log(`[paylink] ✅ Verified via endpoint: user=${userId} plan=${plan}`);
      return res.json({ verified: true, plan });

    } catch (err: any) {
      console.error("[paylink] verify error:", err);
      res.status(500).json({ message: "Verification failed" });
    }
  });

  // ── Cancel / downgrade ─────────────────────────────────
  app.post("/api/subscription/cancel", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id as string;
      await db.update(users)
        .set({ subscriptionStatus: "canceled", updatedAt: new Date() })
        .where(eq(users.id, userId));
      res.json({ success: true });
    } catch {
      res.status(500).json({ message: "Failed to cancel subscription" });
    }
  });
}
