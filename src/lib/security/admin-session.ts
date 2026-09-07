import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";

export const ADMIN_SESSION_COOKIE = "encuestashaq_admin_session";
export const ADMIN_SESSION_DURATION_SECONDS = 8 * 60 * 60;

const ADMIN_USERNAME = "Admin";
const ADMIN_PASSWORD = "Admin";

function safeEqual(value: string, expected: string) {
  const valueBuffer = Buffer.from(value);
  const expectedBuffer = Buffer.from(expected);
  return (
    valueBuffer.length === expectedBuffer.length &&
    timingSafeEqual(valueBuffer, expectedBuffer)
  );
}

function sign(payload: string) {
  return createHmac("sha256", env.AUTH_SECRET)
    .update(payload)
    .digest("base64url");
}

export function validateAdminCredentials(username: string, password: string) {
  return (
    safeEqual(username, ADMIN_USERNAME) && safeEqual(password, ADMIN_PASSWORD)
  );
}

export function createAdminSessionToken(now = Date.now()) {
  const expiresAt = now + ADMIN_SESSION_DURATION_SECONDS * 1000;
  const payload = Buffer.from(`${ADMIN_USERNAME}:${expiresAt}`).toString(
    "base64url",
  );
  return `${payload}.${sign(payload)}`;
}

export function verifyAdminSessionToken(
  token: string | undefined,
  now = Date.now(),
) {
  if (!token) return false;
  const [payload, signature] = token.split(".");
  if (!payload || !signature || !safeEqual(signature, sign(payload)))
    return false;

  try {
    const decoded = Buffer.from(payload, "base64url").toString("utf8");
    const separator = decoded.lastIndexOf(":");
    const username = decoded.slice(0, separator);
    const expiresAt = Number(decoded.slice(separator + 1));
    return (
      username === ADMIN_USERNAME &&
      Number.isFinite(expiresAt) &&
      expiresAt > now
    );
  } catch {
    return false;
  }
}
