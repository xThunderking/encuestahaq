import { afterEach, describe, expect, it, vi } from "vitest";

const { collection, create } = vi.hoisted(() => {
  const create = vi.fn();
  const document = { create };
  const collection = vi.fn(() => ({ doc: vi.fn(() => document) }));
  return { collection, create };
});

vi.mock("@/lib/firebase-admin", () => ({
  adminDb: { collection },
}));
vi.mock("firebase-admin/firestore", () => ({
  FieldValue: { serverTimestamp: () => "server-time" },
}));

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

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  collection.mockClear();
  create.mockReset();
  vi.resetModules();
});

describe("POST /api/survey-responses", () => {
  it("returns unavailable while the survey module is disabled", async () => {
    vi.stubEnv("ENABLE_SURVEYS", "false");
    vi.resetModules();
    const { POST } = await import("@/app/api/survey-responses/route");

    const response = await POST(
      new Request("http://localhost/api/survey-responses", {
        method: "POST",
        body: JSON.stringify(validSubmission),
      }),
    );

    expect(response.status).toBe(404);
    expect(collection).not.toHaveBeenCalled();
  });

  it("stores a valid submission when surveys are explicitly enabled", async () => {
    vi.stubEnv("ENABLE_SURVEYS", "true");
    vi.resetModules();
    create.mockResolvedValue(undefined);
    const { POST } = await import("@/app/api/survey-responses/route");

    const response = await POST(
      new Request("http://localhost/api/survey-responses", {
        method: "POST",
        body: JSON.stringify(validSubmission),
      }),
    );

    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({
      id: validSubmission.submissionId,
      submittedAt: expect.any(String),
    });
    expect(collection).toHaveBeenCalledWith("surveyResponses");
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        submissionId: validSubmission.submissionId,
        answers: validSubmission.answers,
        submittedAt: "server-time",
      }),
    );
  });

  it("rejects malformed enabled submissions before accessing Firestore", async () => {
    vi.stubEnv("ENABLE_SURVEYS", "true");
    vi.resetModules();
    const { POST } = await import("@/app/api/survey-responses/route");

    const response = await POST(
      new Request("http://localhost/api/survey-responses", {
        method: "POST",
        body: JSON.stringify({ answers: {} }),
      }),
    );

    expect(response.status).toBe(400);
    expect(collection).not.toHaveBeenCalled();
  });
});
