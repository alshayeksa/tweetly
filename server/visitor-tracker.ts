import type { Request, Response, NextFunction } from "express";

// Parse browser name from User-Agent string
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

// Parse OS name from User-Agent string
function parseOS(ua: string): string {
  if (!ua) return "Unknown";
  if (/Windows NT 10/i.test(ua)) return "Windows 10";
  if (/Windows NT 11/i.test(ua)) return "Windows 11";
  if (/Windows NT/i.test(ua)) return "Windows";
  if (/Mac OS X/i.test(ua)) return "MacOS";
  if (/Android/i.test(ua)) return "Android";
  if (/iPhone|iPad|iPod/i.test(ua)) return "iOS";
  if (/Linux/i.test(ua)) return "Linux";
  return "Unknown";
}

// Parse device type from User-Agent string
function parseDeviceType(ua: string): string {
  if (!ua) return "Unknown";
  if (/Mobile|Android|iPhone|iPad|iPod/i.test(ua)) return "Mobile";
  if (/Tablet/i.test(ua)) return "Tablet";
  return "Desktop";
}

// Fetch geo + ISP data from ip-api.com (free, no key needed)
async function fetchGeoData(ip: string): Promise<{
  country: string;
  countryCode: string;
  region: string;
  city: string;
  isp: string;
} | null> {
  // Skip private/local IPs
  if (
    ip === "127.0.0.1" ||
    ip === "::1" ||
    ip.startsWith("192.168.") ||
    ip.startsWith("10.") ||
    ip.startsWith("172.")
  ) {
    return null;
  }
  try {
    const res = await fetch(
      `http://ip-api.com/json/${ip}?fields=country,countryCode,regionName,city,isp&lang=en`,
      { signal: AbortSignal.timeout(3000) }
    );
    if (!res.ok) return null;
    const data: any = await res.json();
    if (data.status === "fail") return null;
    return {
      country: data.country ?? "",
      countryCode: data.countryCode ?? "",
      region: data.regionName ?? "",
      city: data.city ?? "",
      isp: data.isp ?? "",
    };
  } catch {
    return null;
  }
}

// Get real client IP(s) — returns both IPv4 and IPv6 if both are present
function getClientIP(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  const socketIP = req.socket?.remoteAddress ?? "";

  let forwardedIP = "";
  if (forwarded) {
    // X-Forwarded-For may be "client, proxy1, proxy2" — take first (real client)
    const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded;
    forwardedIP = raw.split(",")[0].trim();
  }

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

// Static asset extensions to skip tracking
const SKIP_EXTENSIONS = /\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|map|json|txt|xml|webp|avif)$/i;

export function visitorTrackerMiddleware(req: Request, res: Response, next: NextFunction) {
  // Only track GET requests to HTML pages (not API, not static assets)
  if (
    req.method !== "GET" ||
    req.path.startsWith("/api/") ||
    SKIP_EXTENSIONS.test(req.path)
  ) {
    return next();
  }

  // Fire-and-forget — do not block the request
  (async () => {
    try {
      const ip = getClientIP(req);
      // For geo lookup, prefer IPv4 if both stored; otherwise use whatever we have
      const geoIP = ip.includes(" / ") ? ip.split(" / ")[0] : ip;
      const ua = req.headers["user-agent"] ?? "";
      const pageUrl = req.path;

      const browser = parseBrowser(ua);
      const os = parseOS(ua);
      const deviceType = parseDeviceType(ua);
      const geo = await fetchGeoData(geoIP);

      const { db } = await import("./db");
      const { sql } = await import("drizzle-orm");

      await db.execute(sql`
        INSERT INTO visitor_tracking
          (visitor_ip, user_agent, visited_at, page_url, device_type, country, country_code, city, region, isp, os, browser)
        VALUES
          (${ip}, ${ua}, NOW(), ${pageUrl}, ${deviceType},
           ${geo?.country ?? ""}, ${geo?.countryCode ?? ""}, ${geo?.city ?? ""}, ${geo?.region ?? ""},
           ${geo?.isp ?? ""}, ${os}, ${browser})
      `);
    } catch (err) {
      // Never crash the server due to tracking failure
      console.error("[visitor-tracker] insert error:", err);
    }
  })();

  next();
}
