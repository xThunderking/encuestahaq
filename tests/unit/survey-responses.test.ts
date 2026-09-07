import { beforeEach, describe, expect, it, vi } from "vitest";

const { upsert } = vi.hoisted(() => ({ upsert: vi.fn() }));

vi.mock("@/lib/db/prisma", () => ({
  prisma: { surveyResponse: { upsert } },
}));

import { POST } from "@/app/api/survey-responses/route";

const validSubmission = {
  submissionId: "a0df1018-e2dd-4f59-8f8d-aaf45844db27",
  surveyCode: "servicios_externos_diagnostico",
  locale: "es",
  answers: {
    servicios_externos_diagnostico_pregunta_1: 4,
    servicios_externos_diagnostico_pregunta_3: 7,
    servicios_externos_diagnostico_pregunta_15: "Excelente servicio",
  },
};

describe("POST /api/survey-responses", () => {
  beforeEach(() => upsert.mockReset());

  it("stores all answers and returns the database date", async () => {
    const submittedAt = new Date("2026-09-07T18:30:00.000Z");
    upsert.mockResolvedValue({ id: 1, submittedAt });

    const response = await POST(
      new Request("http://localhost/api/survey-responses", {
        method: "POST",
        body: JSON.stringify(validSubmission),
      }),
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      id: 1,
      submittedAt: submittedAt.toISOString(),
    });
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { submissionId: validSubmission.submissionId },
        create: expect.objectContaining({ answers: validSubmission.answers }),
      }),
    );
  });

  it("rejects malformed submissions before accessing the database", async () => {
    const response = await POST(
      new Request("http://localhost/api/survey-responses", {
        method: "POST",
        body: JSON.stringify({ answers: {} }),
      }),
    );

    expect(response.status).toBe(400);
    expect(upsert).not.toHaveBeenCalled();
  });
});
