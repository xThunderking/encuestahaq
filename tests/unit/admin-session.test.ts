import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({
  env: { AUTH_SECRET: "test-admin-secret" },
}));

import {
  ADMIN_LOGIN_CODE_MAX_ATTEMPTS,
  ADMIN_SESSION_DURATION_SECONDS,
  createAdminLoginChallenge,
  createAdminLoginCode,
  createAdminSessionToken,
  getAdminLoginCodeRetryAfter,
  verifyAdminLoginCode,
  verifyAdminSessionToken,
} from "@/lib/security/admin-session";

describe("admin session", () => {
  it("creates six-digit codes", () => {
    expect(createAdminLoginCode()).toMatch(/^\d{6}$/);
  });

  it("accepts a correct, unexpired email code only for its email", () => {
    const now = new Date("2026-09-07T12:00:00.000Z").getTime();
    const token = createAdminLoginChallenge(
      "admin@hospital.com",
      "123456",
      now,
    );

    expect(getAdminLoginCodeRetryAfter(token, "admin@hospital.com", now)).toBe(
      60,
    );
    expect(
      verifyAdminLoginCode(token, "otra@hospital.com", "123456", now),
    ).toEqual({ authenticated: false });
    expect(
      verifyAdminLoginCode(token, "admin@hospital.com", "123456", now),
    ).toMatchObject({ authenticated: true });
  });

  it("rejects a code after the maximum number of failed attempts", () => {
    let token = createAdminLoginChallenge("admin@hospital.com", "123456");

    for (
      let attempt = 1;
      attempt < ADMIN_LOGIN_CODE_MAX_ATTEMPTS;
      attempt += 1
    ) {
      const result = verifyAdminLoginCode(
        token,
        "admin@hospital.com",
        "000000",
      );
      expect(result.authenticated).toBe(false);
      if (!result.authenticated) {
        expect(result.retryToken).toBeTruthy();
        token = result.retryToken ?? token;
      }
    }

    expect(verifyAdminLoginCode(token, "admin@hospital.com", "000000")).toEqual(
      { authenticated: false },
    );
  });

  it("signs a session that expires after eight hours", () => {
    const now = new Date("2026-09-07T12:00:00.000Z").getTime();
    const token = createAdminSessionToken("hashed-email", now);

    expect(verifyAdminSessionToken(token, now)).toBe(true);
    expect(
      verifyAdminSessionToken(
        token,
        now + ADMIN_SESSION_DURATION_SECONDS * 1000,
      ),
    ).toBe(false);
  });

  it("rejects altered session tokens", () => {
    const token = createAdminSessionToken("hashed-email");
    expect(verifyAdminSessionToken(`${token}alterado`)).toBe(false);
  });
});
