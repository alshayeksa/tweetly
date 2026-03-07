import type { Request } from "express";

// ── UA parsers (same logic as visitor-tracker.ts) ───────────────────────────
function parseBrowser(ua: string): string {
  if (!ua) return "Unknown";
  if (/Edg\//i.test(ua)) return "Edge";
  if (/OPR\//i.test(ua) || /Opera/i.test(ua)) return "Opera";
  if (/Chrome\//i.test(ua) && !/Chromium/i.test(ua)) return "Chrome";
  if (/Firefox\//i.test(ua)) return "Firefox";
  if (/Safari\//i.test(ua) && !/Chrome/i.test(ua)) return "Safari";
  if (/MSIE|Trident/i.test(ua)) return "Internet Explorer";
  return "Unknown";
}

function parseOS(ua: string): string {
  if (!ua) return "Unknown";
  if (/Windows NT 10|Windows NT 11/i.test(ua)) return "Windows";
  if (/Windows NT/i.test(ua)) return "Windows";
  if (/Mac OS X/i.test(ua)) return "MacOS";
  if (/Android/i.test(ua)) return "Android";
  if (/iPhone|iPad|iPod/i.test(ua)) return "iOS";
  if (/Linux/i.test(ua)) return "Linux";
  return "Unknown";
}

function parseDevice(ua: string): string {
  if (!ua) return "Unknown";
  if (/Mobile|Android|iPhone|iPad|iPod/i.test(ua)) return "Mobile";
  if (/Tablet/i.test(ua)) return "Tablet";
  return "Desktop";
}

function getClientIP(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  const socketIP  = req.socket?.remoteAddress ?? "";
  const raw       = Array.isArray(forwarded) ? forwarded[0] : forwarded ?? "";
  const forwardedIP = raw.split(",")[0].trim();
  const isIPv4 = (ip: string) => /^\d+\.\d+\.\d+\.\d+$/.test(ip);
  const isIPv6 = (ip: string) => ip.includes(":");
  const ips = new Set<string>();
  if (forwardedIP) ips.add(forwardedIP);
  if (socketIP) ips.add(socketIP);
  const v4 = [...ips].find(isIPv4) ?? "";
  const v6 = [...ips].find(isIPv6) ?? "";
  if (v4 && v6) return `${v4} / ${v6}`;
  return v4 || v6 || "Unknown";
}

async function fetchGeoData(ip: string): Promise<{
  country: string; countryCode: string; region: string; city: string; isp: string;
} | null> {
  const clean = ip.includes(" / ") ? ip.split(" / ")[0] : ip;
  if (!clean || clean === "Unknown" || clean === "::1" || clean === "127.0.0.1"
    || clean.startsWith("192.168.") || clean.startsWith("10.") || clean.startsWith("172."))
    return null;
  try {
    const res = await fetch(
      `http://ip-api.com/json/${clean}?fields=country,countryCode,regionName,city,isp&lang=en`,
      { signal: AbortSignal.timeout(3000) }
    );
    if (!res.ok) return null;
    const data: any = await res.json();
    if (data.status === "fail") return null;
    return {
      country:     data.country     ?? "",
      countryCode: data.countryCode ?? "",
      region:      data.regionName  ?? "",
      city:        data.city        ?? "",
      isp:         data.isp         ?? "",
    };
  } catch {
    return null;
  }
}

// ── Main export ──────────────────────────────────────────────────────────────
export async function logLoginEvent(params: {
  req:    Request;
  userId: string | null;
  email:  string | null;
  method: "email" | "google" | "x";
  status: "success" | "failed";
}): Promise<void> {
  // Fire-and-forget — never block the auth response
  (async () => {
    try {
      const ip      = getClientIP(params.req);
      const ua      = params.req.headers["user-agent"] ?? "";
      const browser = parseBrowser(ua);
      const os      = parseOS(ua);
      const device  = parseDevice(ua);
      const geo     = await fetchGeoData(ip);

      const { db } = await import("./db");
      const { loginHistory } = await import("@shared/schema");

      await db.insert(loginHistory).values({
        userId:      params.userId,
        email:       params.email,
        method:      params.method,
        status:      params.status,
        ip,
        userAgent:   ua,
        browser,
        os,
        device,
        country:     geo?.country     ?? "",
        countryCode: geo?.countryCode ?? "",
        city:        geo?.city        ?? "",
        region:      geo?.region      ?? "",
        isp:         geo?.isp         ?? "",
      });
    } catch (err) {
      console.error("[auth-logger] insert error:", err);
    }
  })();
}
