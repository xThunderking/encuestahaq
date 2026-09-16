import {
  createHash,
  createHmac,
  randomInt,
  timingSafeEqual,
} from "node:crypto";
import { env } from "@/lib/env";

export const ADMIN_SESSION_COOKIE = "encuestashaq_admin_session";
export const ADMIN_LOGIN_CHALLENGE_COOKIE =
  "encuestashaq_admin_login_challenge";
export const ADMIN_SESSION_DURATION_SECONDS = 8 * 60 * 60;
export const ADMIN_LOGIN_CODE_DURATION_SECONDS = 10 * 60;
export const ADMIN_LOGIN_CODE_RESEND_SECONDS = 60;
export const ADMIN_LOGIN_CODE_MAX_ATTEMPTS = 5;

type LoginChallenge = {
  attempts: number;
  codeHash: string;
  emailHash: string;
  expiresAt: number;
  sentAt: number;
};

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

function signPayload(value: unknown) {
  const payload = Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function parseSignedPayload(token: string | undefined): unknown {
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature || !safeEqual(signature, sign(payload))) {
    return null;
  }

  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function hashEmail(email: string) {
  return createHash("sha256").update(normalizeEmail(email)).digest("base64url");
}

function hashCode(emailHash: string, code: string) {
  return createHmac("sha256", env.AUTH_SECRET)
    .update(`${emailHash}:${code}`)
    .digest("base64url");
}

function parseLoginChallenge(
  token: string | undefined,
  email: string,
  now = Date.now(),
): LoginChallenge | null {
  const payload = parseSignedPayload(token);
  if (!payload || typeof payload !== "object") return null;

  const challenge = payload as Partial<LoginChallenge>;
  const { attempts, codeHash, emailHash, expiresAt, sentAt } = challenge;
  if (
    typeof emailHash !== "string" ||
    typeof codeHash !== "string" ||
    typeof expiresAt !== "number" ||
    typeof sentAt !== "number" ||
    typeof attempts !== "number" ||
    !Number.isFinite(expiresAt) ||
    !Number.isFinite(sentAt) ||
    !Number.isInteger(attempts) ||
    attempts < 0 ||
    expiresAt <= now ||
    emailHash !== hashEmail(email)
  ) {
    return null;
  }

  return { attempts, codeHash, emailHash, expiresAt, sentAt };
}

export function createAdminLoginCode() {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

export function createAdminLoginChallenge(
  email: string,
  code: string,
  now = Date.now(),
) {
  const emailHash = hashEmail(email);
  return signPayload({
    attempts: 0,
    codeHash: hashCode(emailHash, code),
    emailHash,
    expiresAt: now + ADMIN_LOGIN_CODE_DURATION_SECONDS * 1000,
    sentAt: now,
  } satisfies LoginChallenge);
}

export function getAdminLoginCodeRetryAfter(
  token: string | undefined,
  email: string,
  now = Date.now(),
) {
  const challenge = parseLoginChallenge(token, email, now);
  if (!challenge) return 0;
  return Math.max(
    0,
    Math.ceil(
      (challenge.sentAt + ADMIN_LOGIN_CODE_RESEND_SECONDS * 1000 - now) / 1000,
    ),
  );
}

export function verifyAdminLoginCode(
  token: string | undefined,
  email: string,
  code: string,
  now = Date.now(),
):
  | { authenticated: true; userId: string }
  | { authenticated: false; retryToken?: string } {
  const challenge = parseLoginChallenge(token, email, now);
  if (!challenge || challenge.attempts >= ADMIN_LOGIN_CODE_MAX_ATTEMPTS) {
    return { authenticated: false };
  }

  if (safeEqual(challenge.codeHash, hashCode(challenge.emailHash, code))) {
    return { authenticated: true, userId: challenge.emailHash };
  }

  const attempts = challenge.attempts + 1;
  if (attempts >= ADMIN_LOGIN_CODE_MAX_ATTEMPTS) {
    return { authenticated: false };
  }

  return {
    authenticated: false,
    retryToken: signPayload({ ...challenge, attempts }),
  };
}

export function createAdminSessionToken(userId: string, now = Date.now()) {
  const expiresAt = now + ADMIN_SESSION_DURATION_SECONDS * 1000;
  return signPayload({ userId, expiresAt });
}

export function verifyAdminSessionToken(
  token: string | undefined,
  now = Date.now(),
) {
  const payload = parseSignedPayload(token);
  if (!payload || typeof payload !== "object") return false;

  const session = payload as { expiresAt?: unknown; userId?: unknown };
  return (
    typeof session.userId === "string" &&
    session.userId.length > 0 &&
    Number.isFinite(session.expiresAt) &&
    Number(session.expiresAt) > now
  );
}
