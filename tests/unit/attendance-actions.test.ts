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
import { ticketReservationId } from "@/modules/attendance/ticket-number";

const checkIn = (id: string, ticketNumber?: string) =>
  PATCH(
    new Request("http://localhost/api/admin/attendance", {
      method: "PATCH",
      body: JSON.stringify({ id, action: "check-in", ticketNumber }),
    }),
  );

const checkInWithoutTicket = (id: string) =>
  PATCH(
    new Request("http://localhost/api/admin/attendance", {
      method: "PATCH",
      body: JSON.stringify({ id, action: "check-in-no-ticket" }),
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

  it("registers six different doctors using independent transactions", async () => {
    for (let i = 0; i < 6; i++)
      documents.set(String(i), { hasTicket: true, checkedInAt: null });
    const responses = await Promise.all(
      Array.from({ length: 6 }, (_, i) =>
        checkIn(String(i), String(i + 1).padStart(3, "0")),
      ),
    );
    expect(responses.every((response) => response.ok)).toBe(true);
    expect(update).toHaveBeenCalledTimes(6);
    for (let i = 0; i < 6; i++)
      expect(documents.get(String(i))?.ticketNumber).toBe(
        String(i + 1).padStart(3, "0"),
      );
  });

  it.each([
    "000",
    "1",
    "01",
    "1000",
    "0123",
    "-01",
    "1e2",
    "12A",
    " 001",
    "001 ",
    "００１",
    "001\n",
  ])(
    "rejects invalid ticket %j before a database transaction",
    async (ticket) => {
      documents.set("doctor", { hasTicket: true, checkedInAt: null });
      expect((await checkIn("doctor", ticket)).status).toBe(400);
      expect(runTransaction).not.toHaveBeenCalled();
    },
  );

  it.each(["001", "999"])(
    "accepts the ticket boundary %s exactly",
    async (ticket) => {
      documents.set("doctor", { hasTicket: true, checkedInAt: null });
      expect((await checkIn("doctor", ticket)).status).toBe(200);
      expect(documents.get("doctor")?.ticketNumber).toBe(ticket);
    },
  );

  it("assigns a contested ticket to only one of six doctors", async () => {
    for (let i = 0; i < 6; i++)
      documents.set(String(i), { hasTicket: true, checkedInAt: null });
    const responses = await Promise.all(
      Array.from({ length: 6 }, (_, i) => checkIn(String(i), "555")),
    );
    expect(responses.map((response) => response.status).sort()).toEqual([
      200, 409, 409, 409, 409, 409,
    ]);
    expect(update).toHaveBeenCalledOnce();
    expect(reservations.size).toBe(1);
  });

  it.each(["bad/id", ".", ".."])(
    "rejects an invalid guest path %s",
    async (id) => {
      expect((await checkIn(id, "001")).status).toBe(400);
      expect(runTransaction).not.toHaveBeenCalled();
    },
  );

  it("creates one extra when six requests retry the same submission", async () => {
    const payload = {
      doctorName: "Doctora extra",
      requestId: "17823961-0365-4e70-91d9-71482308cb09",
    };
    const send = (doctorName = payload.doctorName) =>
      POST(
        new Request("http://localhost/api/admin/attendance", {
          method: "POST",
          body: JSON.stringify({ ...payload, doctorName }),
        }),
      );
    const responses = await Promise.all(
      Array.from({ length: 6 }, () => send()),
    );
    expect(responses.map((response) => response.status).sort()).toEqual([
      200, 200, 200, 200, 200, 201,
    ]);
    const bodies = await Promise.all(
      responses.map((response) => response.json()),
    );
    expect(new Set(bodies.map((body) => body.id)).size).toBe(1);
    expect(create).toHaveBeenCalledOnce();
    expect(documents.size).toBe(1);
    expect((await send("Otro médico")).status).toBe(409);
    expect(documents.size).toBe(1);
  });

  it("preserves the first arrival and ticket when another computer registers the same doctor", async () => {
    documents.set("same-doctor", { hasTicket: true, checkedInAt: null });
    const responses = await Promise.all([
      checkIn("same-doctor", "123"),
      checkIn("same-doctor", "999"),
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
    expect(documents.get("same-doctor")?.ticketNumber).toBe("123");
  });

  it("requires a ticket only for a doctor who has one", async () => {
    documents.set("with-ticket", { hasTicket: true, checkedInAt: null });
    documents.set("without-ticket", { hasTicket: false, checkedInAt: null });
    expect((await checkIn("with-ticket")).status).toBe(400);
    expect((await checkIn("without-ticket")).status).toBe(200);
    expect(update).toHaveBeenCalledOnce();
  });

  it("registers a ticketed doctor who arrives without a ticket number", async () => {
    documents.set("without-number", {
      hasTicket: true,
      ticketNumber: null,
      ticketNumberNormalized: null,
      checkedInAt: null,
    });

    const response = await checkInWithoutTicket("without-number");

    expect(response.status).toBe(200);
    expect(documents.get("without-number")).toMatchObject({
      checkedInAt: "server-timestamp",
      ticketNumber: null,
      ticketNumberNormalized: null,
    });
    expect(create).not.toHaveBeenCalled();
  });

  it("clears a prior number and releases its reservation when no ticket is brought", async () => {
    const ticket = "123";
    const reservationId = ticketReservationId(ticket);
    documents.set("without-ticket", {
      hasTicket: true,
      ticketNumber: ticket,
      ticketNumberNormalized: ticket,
      checkedInAt: null,
    });
    reservations.set(reservationId, { guestId: "without-ticket" });

    const response = await checkInWithoutTicket("without-ticket");

    expect(response.status).toBe(200);
    expect(documents.get("without-ticket")).toMatchObject({
      ticketNumber: null,
      ticketNumberNormalized: null,
    });
    expect(reservations.has(reservationId)).toBe(false);
    expect(remove).toHaveBeenCalledOnce();
  });

  it("does not allow the no-ticket option for a doctor without a ticket", async () => {
    documents.set("no-ticket-required", {
      hasTicket: false,
      checkedInAt: null,
    });

    expect((await checkInWithoutTicket("no-ticket-required")).status).toBe(400);
    expect(update).not.toHaveBeenCalled();
  });

  it("returns 404 when another station references a missing doctor", async () => {
    expect((await checkIn("missing", "001")).status).toBe(404);
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
          ticketNumber: "123",
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
      expect(documents.get("doctor")?.ticketNumber).toBe("123");
      expect(creation.status).toBe(201);
      expect(create).toHaveBeenCalledTimes(2);
      expect(documents.get("new-doctor-1")).toMatchObject({
        doctorName: "Doctor de prueba",
        isExtra: true,
        hasTicket: false,
        ticketNumber: null,
        checkedInAt: "server-timestamp",
      });
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
