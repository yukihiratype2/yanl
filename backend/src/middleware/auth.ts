import { Context, Next } from "hono";
import { getSetting } from "../db/settings";

function isPrivateIp(ip: string): boolean {
  if (ip === "::1" || ip === "localhost") return true;

  // Handle IPv6 mapped IPv4
  if (ip.startsWith("::ffff:")) {
    ip = ip.substring(7);
  }

  const parts = ip.split(".");
  // Simple check for IPv4 format
  if (parts.length !== 4) return false;
  const ok = parts.every((p) => /^\d+$/.test(p));
  if (!ok) return false;

  const n = parts.map((p) => parseInt(p, 10));

  // 127.0.0.0/8 (Localhost)
  if (n[0] === 127) return true;
  // 10.0.0.0/8 (Private A)
  if (n[0] === 10) return true;
  // 192.168.0.0/16 (Private C)
  if (n[0] === 192 && n[1] === 168) return true;
  // 172.16.0.0/12 (Private B: 172.16 - 172.31)
  if (n[0] === 172 && n[1] >= 16 && n[1] <= 31) return true;

  return false;
}

function getClientIp(c: Context): string | undefined {
  // 1. Check standard proxy header
  const forwarded = c.req.header("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }

  // 2. Try to get IP from Bun server context
  try {
    // @ts-ignore: c.env is determined by the adapter (Bun)
    const server = c.env;
    // @ts-ignore
    if (server && typeof server.requestIP === "function") {
      // @ts-ignore
      const info = server.requestIP(c.req.raw);
      return info?.address;
    }
  } catch (e) {
    // Ignore
  }

  return undefined;
}

export async function authMiddleware(c: Context, next: Next) {
  // Allow OPTIONS requests for CORS
  if (c.req.method === "OPTIONS") {
    return next();
  }

  // Allow requests from local network without token
  const ip = getClientIp(c);
  if (ip && isPrivateIp(ip)) {
    return next();
  }

  const authHeader = c.req.header("Authorization");
  if (!authHeader) {
    return c.json({ error: "Missing Authorization header" }, 401);
  }

  const token = authHeader.replace("Bearer ", "");
  const apiToken = getSetting("api_token");

  if (!apiToken || token !== apiToken) {
    return c.json({ error: "Invalid token" }, 401);
  }

  await next();
}
