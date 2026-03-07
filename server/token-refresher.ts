import { storage } from "./storage";
import { log } from "./index";

const REFRESH_INTERVAL_MS = 30 * 60 * 1000;      // كل 30 دقيقة
const REFRESH_BEFORE_EXPIRY_MS = 60 * 60 * 1000; // جدد إذا باقي أقل من ساعة

async function refreshTokenIfNeeded(userId: string): Promise<void> {
  try {
    const xToken = await storage.getXToken(userId);
    if (!xToken || !xToken.refreshToken) return;

    // Skip tokens already marked as broken — user must reconnect manually
    if (xToken.connectionStatus === "needs_reconnect") return;

    const needsRefresh =
      !xToken.expiresAt ||
      new Date(xToken.expiresAt) < new Date(Date.now() + REFRESH_BEFORE_EXPIRY_MS);

    if (!needsRefresh) return;

    const clientId = process.env.X_CLIENT_ID;
    const clientSecret = process.env.X_CLIENT_SECRET;
    if (!clientId || !clientSecret) return;

    log(`Refreshing X token for user ${userId}...`, "token-refresh");

    const response = await fetch("https://api.x.com/2/oauth2/token", {
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

    if (response.ok) {
      const data: any = await response.json();
      const newExpiresAt = data.expires_in
        ? new Date(Date.now() + data.expires_in * 1000)
        : undefined;
      await storage.saveXToken(
        userId,
        data.access_token,
        data.refresh_token || xToken.refreshToken,
        newExpiresAt,
        xToken.xUsername || undefined
      );
      log(`✅ Token refreshed for user ${userId}, expires: ${newExpiresAt?.toISOString()}`, "token-refresh");
    } else {
      const errText = await response.text();
      log(`❌ Token refresh failed for user ${userId}: ${errText}`, "token-refresh");

      // If the refresh token is permanently invalid, mark user as needing reconnect
      // so we stop retrying every 30 min (user must re-authenticate with X)
      try {
        const errJson = JSON.parse(errText);
        if (
          errJson.error === "invalid_request" ||
          errJson.error === "invalid_grant" ||
          response.status === 400 ||
          response.status === 401
        ) {
          await storage.markUserNeedsReconnect(userId);
          log(`⚠️ Marked user ${userId} as needs_reconnect — X token is invalid`, "token-refresh");
        }
      } catch {
        // errText was not JSON — still mark as invalid on 401
        if (response.status === 401) {
          await storage.markUserNeedsReconnect(userId);
          log(`⚠️ Marked user ${userId} as needs_reconnect (401)`, "token-refresh");
        }
      }
    }
  } catch (err: any) {
    log(`Token refresh error for user ${userId}: ${err.message}`, "token-refresh");
  }
}

export async function refreshAllTokens(): Promise<void> {
  try {
    const allTokens = await storage.getAllXTokens();
    if (allTokens.length === 0) return;

    log(`Checking ${allTokens.length} X tokens for refresh...`, "token-refresh");

    for (const token of allTokens) {
      await refreshTokenIfNeeded(token.userId);
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  } catch (err: any) {
    log(`Error in refreshAllTokens: ${err.message}`, "token-refresh");
  }
}

export function startTokenRefresher(): void {
  log(`Token refresher started — runs every ${REFRESH_INTERVAL_MS / 60000} minutes`, "token-refresh");
  refreshAllTokens();
  setInterval(refreshAllTokens, REFRESH_INTERVAL_MS);
}
