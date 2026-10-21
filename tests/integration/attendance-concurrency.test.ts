import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { performance } from "node:perf_hooks";
import { mkdirSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import ExcelJS from "exceljs";

vi.hoisted(() => {
  if (
    process.env.FIRESTORE_EMULATOR_HOST !== "127.0.0.1:8787" ||
    process.env.FIREBASE_PROJECT_ID !== "demo-attendance-audit"
  )
    throw new Error(
      "This suite requires the isolated local attendance emulator; production access is forbidden.",
    );
});
vi.mock("server-only", () => ({}));

import { adminDb } from "@/lib/firebase-admin";
import { PATCH, POST } from "@/app/api/admin/attendance/route";
import { POST as IMPORT } from "@/app/api/admin/attendance/import/route";
import { GET as EXPORT } from "@/app/api/admin/attendance/export/route";
import { createAttendanceStream } from "@/modules/attendance/attendance-stream";
import { shareAttendanceSubscription } from "@/modules/attendance/shared-attendance-subscription";
import {
  attendanceGuestsQuery,
  serializeAttendanceGuest,
  type AttendanceGuest,
} from "@/modules/attendance/get-attendance-guests";

const projectId = "demo-attendance-audit";
const guests = adminDb.collection("medicalEventGuests");
const checkIn = (id: string, ticketNumber: string) =>
  PATCH(
    new Request("http://localhost/api/admin/attendance", {
      method: "PATCH",
      body: JSON.stringify({ id, ticketNumber, action: "check-in" }),
    }),
  );

async function clearEmulator() {
  const response = await fetch(
    `http://127.0.0.1:8787/emulator/v1/projects/${projectId}/databases/(default)/documents`,
    { method: "DELETE" },
  );
  if (!response.ok) throw new Error("Unable to reset the isolated emulator");
}

async function waitFor(check: () => boolean, timeout = 20_000) {
  const started = Date.now();
  while (!check()) {
    if (Date.now() - started > timeout)
      throw new Error("Seven-screen synchronization timed out");
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}

describe("real Firestore emulator attendance concurrency", () => {
  beforeAll(clearEmulator);
  afterAll(async () => {
    await adminDb.terminate();
  });

  it("preserves one arrival when six stations submit the same doctor", async () => {
    await guests.doc("race-same-doctor").set({
      doctorName: "Race same doctor",
      hasTicket: true,
      checkedInAt: null,
    });
    const responses = await Promise.all(
      Array.from({ length: 6 }, (_, i) =>
        checkIn("race-same-doctor", String(800 + i)),
      ),
    );
    expect(responses.every((response) => response.status === 200)).toBe(true);
    const results = await Promise.all(
      responses.map((response) => response.json()),
    );
    expect(
      results.filter((body) => body.alreadyRegistered === false),
    ).toHaveLength(1);
    expect(
      results.filter((body) => body.alreadyRegistered === true),
    ).toHaveLength(5);
    const reservations = await adminDb
      .collection("medicalEventTicketNumbers")
      .get();
    expect(reservations.size).toBe(1);
  });

  it("lets only one of six stations reserve a contested ticket", async () => {
    await Promise.all(
      Array.from({ length: 6 }, (_, i) =>
        guests.doc(`race-ticket-${i}`).set({
          doctorName: `Race ticket ${i}`,
          hasTicket: true,
          checkedInAt: null,
        }),
      ),
    );
    const responses = await Promise.all(
      Array.from({ length: 6 }, (_, i) => checkIn(`race-ticket-${i}`, "999")),
    );
    expect(responses.map((response) => response.status).sort()).toEqual([
      200, 409, 409, 409, 409, 409,
    ]);
    const registered = await guests.where("ticketNumber", "==", "999").get();
    expect(registered.size).toBe(1);
  });

  it("does not duplicate an extra when six requests reuse a submission", async () => {
    const responses = await Promise.all(
      Array.from({ length: 6 }, () =>
        POST(
          new Request("http://localhost/api/admin/attendance", {
            method: "POST",
            body: JSON.stringify({
              doctorName: "Extra concurrency",
              requestId: "fdff244a-ebce-47e8-a789-d688162e787b",
            }),
          }),
        ),
      ),
    );
    expect(responses.every((response) => response.ok)).toBe(true);
    const bodies = await Promise.all(
      responses.map((response) => response.json()),
    );
    expect(new Set(bodies.map((body) => body.id)).size).toBe(1);
    expect((await guests.where("isExtra", "==", true).get()).size).toBe(1);
  });

  it("registers six different extras at once", async () => {
    const responses = await Promise.all(
      Array.from({ length: 6 }, (_, i) =>
        POST(
          new Request("http://localhost/api/admin/attendance", {
            method: "POST",
            body: JSON.stringify({
              doctorName: `Extra independiente ${i}`,
              requestId: randomUUID(),
            }),
          }),
        ),
      ),
    );
    expect(responses.every((response) => response.status === 201)).toBe(true);
    const bodies = await Promise.all(
      responses.map((response) => response.json()),
    );
    expect(new Set(bodies.map((body) => body.id)).size).toBe(6);
    expect((await guests.where("isExtra", "==", true).get()).size).toBe(7);
  });

  it("registers all 570 doctors with six workers and synchronizes seven live streams", async () => {
    await clearEmulator();
    const input = new ExcelJS.Workbook();
    const sheet = input.addWorksheet("Invitados");
    sheet.addRow(["NOMBRE DEL MEDICO", "BOLETO"]);
    for (let i = 0; i < 570; i++)
      sheet.addRow([`Médico de carga ${String(i).padStart(3, "0")}`, "SI"]);
    const bytes = await input.xlsx.writeBuffer();
    const upload = () => {
      const form = new FormData();
      form.append(
        "file",
        new File([new Uint8Array(bytes)], "invitados-570.xlsx"),
      );
      return IMPORT(
        new Request("http://localhost/api/admin/attendance/import", {
          method: "POST",
          body: form,
        }),
      );
    };
    const imported = await upload();
    expect(imported.status).toBe(201);
    expect(await imported.json()).toEqual({
      imported: 570,
      skipped: 0,
      total: 570,
    });
    const guestIds = (await attendanceGuestsQuery().get()).docs.map(
      (doc) => doc.id,
    );
    const subscribe = shareAttendanceSubscription((notify, fail) =>
      attendanceGuestsQuery().onSnapshot(
        (snapshot) => notify(snapshot.docs.map(serializeAttendanceGuest)),
        fail,
      ),
    );
    const monitors = Array.from({ length: 7 }, () => {
      const abort = new AbortController();
      const reader = createAttendanceStream(
        abort.signal,
        subscribe,
      ).getReader();
      const state = { count: -1, arrivals: 0, updates: 0 };
      const draining = (async () => {
        while (true) {
          const message = await reader.read();
          if (message.done) break;
          const text = new TextDecoder().decode(message.value);
          if (!text.startsWith("event: guests\n")) continue;
          const snapshot = JSON.parse(
            text.slice("event: guests\ndata: ".length).trim(),
          ) as AttendanceGuest[];
          state.count = snapshot.length;
          state.arrivals = snapshot.filter((guest) => guest.checkedInAt).length;
          state.updates++;
        }
      })();
      return { state, abort, draining };
    });
    const times: number[] = [];
    const errors: string[] = [];
    const started = performance.now();
    try {
      await waitFor(() =>
        monitors.every((monitor) => monitor.state.count === 570),
      );
      let next = 0;
      await Promise.all(
        Array.from({ length: 6 }, async () => {
          while (next < 570) {
            const i = next++;
            const start = performance.now();
            const response =
              i % 10 === 0
                ? await PATCH(
                    new Request("http://localhost/api/admin/attendance", {
                      method: "PATCH",
                      body: JSON.stringify({
                        id: guestIds[i],
                        action: "check-in-no-ticket",
                      }),
                    }),
                  )
                : await checkIn(guestIds[i], String(i + 1).padStart(3, "0"));
            times.push(performance.now() - start);
            if (response.status !== 200)
              errors.push(`${i}: ${response.status} ${await response.text()}`);
          }
        }),
      );
      const savesDone = performance.now();
      expect(errors).toEqual([]);
      try {
        await waitFor(() =>
          monitors.every((monitor) => monitor.state.arrivals === 570),
        );
      } catch (error) {
        console.error(
          "Final stream states",
          monitors.map((monitor) => monitor.state),
        );
        throw error;
      }
      const synchronizedAt = performance.now();
      const snapshot = await guests.get();
      expect(snapshot.size).toBe(570);
      expect(
        snapshot.docs.every((doc) => doc.data().checkedInAt?.toDate()),
      ).toBe(true);
      const numbers = snapshot.docs
        .map((doc) => doc.data().ticketNumber)
        .filter(Boolean);
      expect(numbers).toHaveLength(513);
      expect(new Set(numbers).size).toBe(513);
      expect(numbers.every((number) => /^(?!000)[0-9]{3}$/.test(number))).toBe(
        true,
      );
      expect(
        (await adminDb.collection("medicalEventTicketNumbers").get()).size,
      ).toBe(513);
      const repeated = await upload();
      expect(repeated.status).toBe(200);
      expect(await repeated.json()).toEqual({
        imported: 0,
        skipped: 570,
        total: 570,
      });
      expect(
        (await guests.get()).docs.filter((doc) => doc.data().checkedInAt),
      ).toHaveLength(570);
      const exported = await EXPORT();
      expect(exported.status).toBe(200);
      const reportWorkbook = new ExcelJS.Workbook();
      await reportWorkbook.xlsx.load(await exported.arrayBuffer());
      expect(reportWorkbook.getWorksheet("Resumen")!.getCell("A7").value).toBe(
        570,
      );
      expect(reportWorkbook.getWorksheet("Resumen")!.getCell("C7").value).toBe(
        570,
      );
      expect(reportWorkbook.getWorksheet("Resumen")!.getCell("E7").value).toBe(
        0,
      );
      expect(reportWorkbook.getWorksheet("Todos los médicos")!.rowCount).toBe(
        576,
      );
      const sorted = times.toSorted((a, b) => a - b);
      const report = {
        mode: "isolated-local-firestore-emulator",
        doctors: 570,
        workers: 6,
        screens: 7,
        successful: times.length - errors.length,
        errors,
        durationMs: Math.round(savesDone - started),
        p50Ms: Math.round(sorted[Math.floor(sorted.length * 0.5)]),
        p95Ms: Math.round(sorted[Math.floor(sorted.length * 0.95)]),
        maxMs: Math.round(sorted.at(-1)!),
        finalSyncDelayMs: Math.round(synchronizedAt - savesDone),
        screensState: monitors.map((monitor) => monitor.state),
      };
      mkdirSync("node_modules/.cache/attendance-audit", { recursive: true });
      writeFileSync(
        "node_modules/.cache/attendance-audit/results.json",
        JSON.stringify(report, null, 2),
      );
      console.log(JSON.stringify(report));
    } finally {
      monitors.forEach((monitor) => monitor.abort.abort());
      await Promise.all(monitors.map((monitor) => monitor.draining));
    }
  });
});
