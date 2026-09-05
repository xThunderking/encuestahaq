import { describe, expect, it } from "vitest";

import { GET } from "@/app/api/health/route";

describe("GET /api/health", () => {
  it("returns the application health payload", async () => {
    const response = GET();

    await expect(response.json()).resolves.toEqual({
      status: "ok",
      application: "encuestashaq",
    });
  });
});
