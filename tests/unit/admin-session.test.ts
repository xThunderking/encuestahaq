import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({
  env: { AUTH_SECRET: "test-admin-secret" },
}));

import {
  ADMIN_SESSION_DURATION_SECONDS,
  createAdminSessionToken,
  validateAdminCredentials,
  verifyAdminSessionToken,
} from "@/lib/security/admin-session";

describe("admin session", () => {
  it("accepts only the configured credentials", () => {
    expect(validateAdminCredentials("Admin", "Admin")).toBe(true);
    expect(validateAdminCredentials("admin", "Admin")).toBe(false);
    expect(validateAdminCredentials("Admin", "incorrecta")).toBe(false);
  });

  it("signs a session that expires after eight hours", () => {
    const now = new Date("2026-09-07T12:00:00.000Z").getTime();
    const token = createAdminSessionToken(now);

    expect(verifyAdminSessionToken(token, now)).toBe(true);
    expect(
      verifyAdminSessionToken(
        token,
        now + ADMIN_SESSION_DURATION_SECONDS * 1000,
      ),
    ).toBe(false);
  });

  it("rejects altered tokens", () => {
    const token = createAdminSessionToken();
    expect(verifyAdminSessionToken(`${token}alterado`)).toBe(false);
  });
});
