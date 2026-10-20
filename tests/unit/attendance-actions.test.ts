import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  runTransaction,
  update,
  create,
  remove,
  documents,
  reservations,
  collection,
  resetQueue,
} = vi.hoisted(() => {
  const documents = new Map<string, Record<string, unknown>>();
  const reservations = new Map<string, Record<string, unknown>>();
  let nextId = 1;
  const collection = (name: string) => ({
    doc: (id?: string) => ({
      id: id ?? `new-doctor-${nextId++}`,
      collectionName: name,
    }),
    where: (field: string, _operator: string, value: unknown) => ({
      collectionName: name,
      field,
      value,
      isQuery: true,
    }),
  });
  const update = vi.fn(
    (reference: { id: string }, values: Record<string, unknown>) => {
      documents.set(reference.id, {
        ...documents.get(reference.id),
        ...values,
      });
    },
  );
  const create = vi.fn(
    (
      reference: { id: string; collectionName: string },
      values: Record<string, unknown>,
    ) => {
      const target =
        reference.collectionName === "medicalEventTicketNumbers"
          ? reservations
          : documents;
      target.set(reference.id, values);
    },
  );
  const remove = vi.fn((reference: { id: string; collectionName: string }) => {
    const target =
      reference.collectionName === "medicalEventTicketNumbers"
        ? reservations
        : documents;
    target.delete(reference.id);
  });
  let queue: Promise<unknown> = Promise.resolve();
  const runTransaction = vi.fn(
    (callback: (transaction: unknown) => Promise<unknown>) => {
      const result = queue.then(() =>
        callback({
          get: async (reference: {
            id?: string;
            collectionName: string;
            field?: string;
            value?: unknown;
            isQuery?: boolean;
          }) => {
            if (reference.isQuery) {
              const matches = [...documents.entries()]
                .filter(
                  ([, data]) => data[reference.field!] === reference.value,
                )
                .map(([id, data]) => ({ id, data }));
              return {
                docs: matches.map(({ id, data }) => ({ id, data: () => data })),
              };
            }
            const target =
              reference.collectionName === "medicalEventTicketNumbers"
                ? reservations
                : documents;
            const data = target.get(reference.id!);
            return {
              id: reference.id,
              exists: target.has(reference.id!),
              data: () => data,
            };
          },
          update,
          create,
          delete: remove,
        }),
      );
      queue = result.catch(() => {});
      return result;
    },
  );
  return {
    documents,
    reservations,
    update,
    create,
    remove,
    collection,
    runTransaction,
    resetQueue: () => {
      queue = Promise.resolve();
      nextId = 1;
    },
  };
});
vi.mock("@/lib/firebase-admin", () => ({
  adminDb: {
    collection,
    runTransaction,
  },
}));
vi.mock("firebase-admin/firestore", () => ({
  FieldValue: {
    serverTimestamp: () => "server-timestamp",
  },
}));

import { PATCH, POST } from "@/app/api/admin/attendance/route";

const checkIn = (id: string, ticketNumber?: string) =>
  PATCH(
    new Request("http://localhost/api/admin/attendance", {
      method: "PATCH",
      body: JSON.stringify({ id, action: "check-in", ticketNumber }),
    }),
  );

describe("concurrent attendance registration", () => {
  beforeEach(() => {
    documents.clear();
    reservations.clear();
    update.mockClear();
    create.mockClear();
    remove.mockClear();
    runTransaction.mockClear();
    resetQueue();
  });

  it("registers five different doctors using independent transactions", async () => {
    for (let i = 0; i < 5; i++)
      documents.set(String(i), { hasTicket: true, checkedInAt: null });
    const responses = await Promise.all(
      Array.from({ length: 5 }, (_, i) => checkIn(String(i), `00${i}`)),
    );
    expect(responses.every((response) => response.ok)).toBe(true);
    expect(update).toHaveBeenCalledTimes(5);
    for (let i = 0; i < 5; i++)
      expect(documents.get(String(i))?.ticketNumber).toBe(`00${i}`);
  });

  it("preserves the first arrival and ticket when another computer registers the same doctor", async () => {
    documents.set("same-doctor", { hasTicket: true, checkedInAt: null });
    const responses = await Promise.all([
      checkIn("same-doctor", "0123"),
      checkIn("same-doctor", "0999"),
    ]);
    expect(await responses[0].json()).toMatchObject({
      registered: true,
      alreadyRegistered: false,
    });
    expect(await responses[1].json()).toMatchObject({
      registered: true,
      alreadyRegistered: true,
    });
    expect(update).toHaveBeenCalledOnce();
    expect(documents.get("same-doctor")?.ticketNumber).toBe("0123");
  });

  it("requires a ticket only for a doctor who has one", async () => {
    documents.set("with-ticket", { hasTicket: true, checkedInAt: null });
    documents.set("without-ticket", { hasTicket: false, checkedInAt: null });
    expect((await checkIn("with-ticket")).status).toBe(400);
    expect((await checkIn("without-ticket")).status).toBe(200);
    expect(update).toHaveBeenCalledOnce();
  });

  it("returns 404 when another station references a missing doctor", async () => {
    expect((await checkIn("missing", "01")).status).toBe(404);
    expect(update).not.toHaveBeenCalled();
  });

  it("rejects an old cancellation after another computer records a new arrival", async () => {
    const currentArrival = "2026-10-19T15:05:00.000Z";
    documents.set("doctor", {
      hasTicket: true,
      ticketNumber: "new-ticket",
      checkedInAt: { toDate: () => new Date(currentArrival) },
    });
    const response = await PATCH(
      new Request("http://localhost/api/admin/attendance", {
        method: "PATCH",
        body: JSON.stringify({
          id: "doctor",
          action: "undo",
          expectedCheckedInAt: "2026-10-19T15:00:00.000Z",
        }),
      }),
    );
    expect(response.status).toBe(409);
    expect(update).not.toHaveBeenCalled();
    expect(documents.get("doctor")?.ticketNumber).toBe("new-ticket");
  });

  it("allows cancellation of the same arrival that the operator reviewed", async () => {
    const arrival = "2026-10-19T15:00:00.000Z";
    documents.set("doctor", {
      hasTicket: false,
      checkedInAt: { toDate: () => new Date(arrival) },
    });
    const response = await PATCH(
      new Request("http://localhost/api/admin/attendance", {
        method: "PATCH",
        body: JSON.stringify({
          id: "doctor",
          action: "undo",
          expectedCheckedInAt: arrival,
        }),
      }),
    );
    expect(response.status).toBe(200);
    expect(documents.get("doctor")?.checkedInAt).toBeNull();
  });

  it("requires the reviewed arrival time before cancelling", async () => {
    const response = await PATCH(
      new Request("http://localhost/api/admin/attendance", {
        method: "PATCH",
        body: JSON.stringify({ id: "doctor", action: "undo" }),
      }),
    );
    expect(response.status).toBe(400);
    expect(runTransaction).not.toHaveBeenCalled();
  });

  const publicOrigin = "https://evento.us-central1.hosted.app";
  const internalUrl = "http://localhost:8080/api/admin/attendance";
  const publicHeaders = {
    origin: publicOrigin,
    "x-forwarded-host": "evento.us-central1.hosted.app",
    "x-forwarded-proto": "https",
  };

  const sendFromOrigin = async (url: string, headers: HeadersInit) => {
    const arrival = await PATCH(
      new Request(url, {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          id: "doctor",
          action: "check-in",
          ticketNumber: "12345",
        }),
      }),
    );
    const creation = await POST(
      new Request(url, {
        method: "POST",
        headers,
        body: JSON.stringify({
          doctorName: "Doctor de prueba",
          hospital: "HACS",
          hasTicket: true,
        }),
      }),
    );
    return [arrival, creation];
  };

  const acceptedOrigins: {
    name: string;
    url: string;
    headers: Record<string, string>;
  }[] = [
    {
      name: "a direct request",
      url: `${publicOrigin}/api/admin/attendance`,
      headers: { origin: publicOrigin },
    },
    {
      name: "App Hosting with an internal HTTP URL",
      url: internalUrl,
      headers: publicHeaders,
    },
    {
      name: "browser same-origin metadata when hosting rewrites all host headers",
      url: internalUrl,
      headers: { origin: publicOrigin, "sec-fetch-site": "same-origin" },
    },
    {
      name: "a public Host header with TLS terminated at the proxy",
      url: internalUrl,
      headers: {
        origin: publicOrigin,
        host: "evento.us-central1.hosted.app",
        "x-forwarded-proto": "https",
      },
    },
    {
      name: "the first host and protocol in a proxy chain",
      url: internalUrl,
      headers: {
        origin: publicOrigin,
        "x-forwarded-host": "evento.us-central1.hosted.app, internal:8080",
        "x-forwarded-proto": "https, http",
      },
    },
  ];

  it.each(acceptedOrigins)(
    "allows doctor creation and arrival from $name",
    async ({ url, headers }) => {
      documents.set("doctor", { hasTicket: true, checkedInAt: null });
      const [arrival, creation] = await sendFromOrigin(url, headers);
      expect(arrival.status).toBe(200);
      expect(documents.get("doctor")?.ticketNumber).toBe("12345");
      expect(creation.status).toBe(201);
      expect(create).toHaveBeenCalledTimes(2);
    },
  );

  it.each([
    { ...publicHeaders, origin: "https://another-site.example" },
    { ...publicHeaders, origin: `${publicOrigin}.another-site.example` },
    { ...publicHeaders, origin: "null" },
    { ...publicHeaders, origin: "not-a-url" },
    { ...publicHeaders, origin: `${publicOrigin}/unexpected-path` },
    { ...publicHeaders, origin: "http://evento.us-central1.hosted.app" },
    { ...publicHeaders, origin: "https://evento.us-central1.hosted.app:8443" },
    { ...publicHeaders, "sec-fetch-site": "cross-site" },
    { ...publicHeaders, "sec-fetch-site": "same-site" },
  ])(
    "rejects an unrelated or invalid origin before writing: %j",
    async (headers) => {
      const responses = await sendFromOrigin(internalUrl, headers);
      expect(responses.map((response) => response.status)).toEqual([403, 403]);
      expect(runTransaction).not.toHaveBeenCalled();
      expect(create).not.toHaveBeenCalled();
    },
  );
});
