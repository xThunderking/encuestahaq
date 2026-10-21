import ExcelJS from "exceljs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { documents, runTransaction, failCommit, reset } = vi.hoisted(() => {
  const documents = new Map<string, Record<string, unknown>>();
  let queue: Promise<unknown> = Promise.resolve();
  let shouldFail = false;
  const snapshot = (id: string) => ({
    id,
    exists: documents.has(id),
    data: () => documents.get(id),
  });
  const runTransaction = vi.fn(
    (callback: (transaction: unknown) => Promise<unknown>) => {
      const result = queue.then(async () => {
        const writes: { id: string; data: Record<string, unknown> }[] = [];
        const outcome = await callback({
          get: async () => ({ docs: [...documents.keys()].map(snapshot) }),
          getAll: async (...refs: { id: string }[]) =>
            refs.map((ref) => snapshot(ref.id)),
          create: (ref: { id: string }, data: Record<string, unknown>) =>
            writes.push({ id: ref.id, data }),
        });
        if (shouldFail) throw new Error("Fixture commit failed");
        for (const write of writes) {
          if (documents.has(write.id))
            throw new Error("Document already exists");
        }
        for (const write of writes) documents.set(write.id, write.data);
        return outcome;
      });
      queue = result.catch(() => {});
      return result;
    },
  );
  return {
    documents,
    runTransaction,
    failCommit: (value: boolean) => {
      shouldFail = value;
    },
    reset: () => {
      documents.clear();
      queue = Promise.resolve();
      shouldFail = false;
      runTransaction.mockClear();
    },
  };
});
vi.mock("server-only", () => ({}));
vi.mock("@/lib/firebase-admin", () => ({
  adminDb: {
    collection: () => ({ doc: (id: string) => ({ id }) }),
    runTransaction,
  },
}));
vi.mock("firebase-admin/firestore", () => ({
  FieldValue: { serverTimestamp: () => "server-time" },
}));

import {
  createAttendanceTemplate,
  parseAttendanceImport,
} from "@/modules/attendance/import-excel";
import {
  MAX_IMPORT_ROWS,
  MAX_IMPORT_FILE_BYTES,
} from "@/modules/attendance/import-contract";
import { POST } from "@/app/api/admin/attendance/import/route";
import { GET as templateGET } from "@/app/api/admin/attendance/template/route";

async function spreadsheet(rows: ExcelJS.CellValue[][]) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Médicos");
  sheet.addRow(["NOMBRE DEL MEDICO", "HOSPITAL", "BOLETO"]);
  sheet.addRows(rows);
  return workbook.xlsx.writeBuffer();
}
function upload(
  bytes: ExcelJS.Buffer,
  name = "medicos.xlsx",
  headers?: HeadersInit,
) {
  const body = new FormData();
  body.append("file", new File([new Uint8Array(bytes)], name));
  return POST(
    new Request("http://localhost/api/admin/attendance/import", {
      method: "POST",
      body,
      headers,
    }),
  );
}
beforeEach(reset);

describe("Excel doctor registration", () => {
  it("downloads a blank template with the name and ticket fields", async () => {
    const response = await templateGET();
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Disposition")).toContain(
      "plantilla-registro-medicos.xlsx",
    );
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await response.arrayBuffer());
    const sheet = workbook.getWorksheet("Médicos")!;
    expect((sheet.getRow(1).values as ExcelJS.CellValue[]).slice(1)).toEqual([
      "NOMBRE DEL MEDICO",
      "BOLETO",
    ]);
    expect(sheet.getCell("A2").value).toBeNull();
    expect(sheet.getCell("B2").dataValidation.formulae).toEqual(['"SI,NO"']);
    expect(sheet.getCell("B571").dataValidation.formulae).toEqual(['"SI,NO"']);
    expect(sheet.getCell("C2").value).toBeNull();
    expect(sheet.views[0]).toMatchObject({ state: "frozen", ySplit: 1 });
    expect(runTransaction).not.toHaveBeenCalled();
    const empty = await parseAttendanceImport(await createAttendanceTemplate());
    expect(empty.records).toHaveLength(0);
    expect(empty.errorCount).toBe(1);
  });

  it("reads accented SI, trims text and ignores completely blank rows", async () => {
    const parsed = await parseAttendanceImport(
      await spreadsheet([
        ["  Dra. Ana   López ", " haq ", " sí "],
        [],
        ["Dr. Bruno", "hacs", "no"],
      ]),
    );
    expect(parsed.issues).toEqual([]);
    expect(parsed.records).toEqual([
      { doctorName: "Dra. Ana López", hasTicket: true },
      { doctorName: "Dr. Bruno", hasTicket: false },
    ]);
  });

  it("ignores a legacy hospital value and rejects an invalid ticket value", async () => {
    const response = await upload(
      await spreadsheet([
        ["Doctor válido", "HAQ", "SI"],
        ["Doctor incorrecto", "OTRO", "QUIZA"],
      ]),
    );
    expect(response.status).toBe(400);
    const result = await response.json();
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          row: 3,
          message: expect.stringContaining("SI o NO"),
        }),
      ]),
    );
    expect(result.issues).toHaveLength(1);
    expect(runTransaction).not.toHaveBeenCalled();
    expect(documents.size).toBe(0);
  });

  it("identifies repeated doctors by name within the same Excel file", async () => {
    const parsed = await parseAttendanceImport(
      await spreadsheet([
        ["Ana López", "HAQ", "SI"],
        [" ANA LOPEZ ", "HAQ", "NO"],
      ]),
    );
    expect(parsed.issues[0]).toMatchObject({
      row: 3,
      message: expect.stringContaining("fila 2"),
    });
  });

  it("rejects extra columns, formulas and files using the report headers", async () => {
    for (const rows of [
      [["Ana", "HAQ", "SI", "0001"]],
      [["Ana", "HAQ", { formula: '"SI"', result: "SI" }]],
    ] as ExcelJS.CellValue[][][]) {
      expect((await upload(await spreadsheet(rows))).status).toBe(400);
    }
    const workbook = new ExcelJS.Workbook();
    workbook
      .addWorksheet("Reporte")
      .addRow(["Nombre", "Hospital", "No. boleto"]);
    expect((await upload(await workbook.xlsx.writeBuffer())).status).toBe(400);
    expect(runTransaction).not.toHaveBeenCalled();
  });

  it("enforces the maximum number of doctors before writing", async () => {
    const response = await upload(
      await spreadsheet(
        Array.from({ length: MAX_IMPORT_ROWS + 1 }, (_, index) => [
          `Doctor ${index}`,
          "HAQ",
          "NO",
        ]),
      ),
    );
    expect(response.status).toBe(400);
    expect((await response.json()).issues).toContainEqual(
      expect.objectContaining({
        message: expect.stringContaining(`máximo de ${MAX_IMPORT_ROWS}`),
      }),
    );
    expect(runTransaction).not.toHaveBeenCalled();
  });

  it("imports only pending doctors without numbers and makes repeated or concurrent uploads idempotent", async () => {
    const file = await spreadsheet([
      ["Ana López", "HAQ", "SI"],
      ["Bruno Díaz", "HACS", "NO"],
    ]);
    const responses = await Promise.all([upload(file), upload(file)]);
    expect(responses.map((response) => response.status)).toEqual([201, 200]);
    expect(await responses[0].json()).toEqual({
      imported: 2,
      skipped: 0,
      total: 2,
    });
    expect(await responses[1].json()).toEqual({
      imported: 0,
      skipped: 2,
      total: 2,
    });
    expect(documents.size).toBe(2);
    for (const data of documents.values()) {
      expect(data.checkedInAt).toBeNull();
      expect(data.ticketNumber).toBeNull();
      expect(data.ticketNumberNormalized).toBeNull();
      expect(data.createdAt).toBe("server-time");
    }
    expect([...documents.values()].map((data) => data.hasTicket)).toEqual([
      true,
      false,
    ]);
  });

  it("accepts the full 570-doctor list using Firestore-safe transactions", async () => {
    const response = await upload(
      await spreadsheet(
        Array.from({ length: MAX_IMPORT_ROWS }, (_, index) => [
          `Doctor ${index}`,
          "HAQ",
          "SI",
        ]),
      ),
    );
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({
      imported: 570,
      skipped: 0,
      total: 570,
    });
    expect(documents.size).toBe(570);
    expect(runTransaction).toHaveBeenCalledTimes(2);
  });

  it("preserves the data, ticket and arrival of doctors already added manually", async () => {
    const original = {
      doctorName: "Ana López",
      hospital: "HAQ",
      hasTicket: true,
      ticketNumber: "00017",
      checkedInAt: "previous-arrival",
    };
    documents.set("manual-id", original);
    const response = await upload(
      await spreadsheet([
        ["ANA LOPEZ", "HAQ", "NO"],
        ["Bruno Díaz", "HACS", "SI"],
      ]),
    );
    expect(await response.json()).toEqual({
      imported: 1,
      skipped: 1,
      total: 2,
    });
    expect(documents.get("manual-id")).toEqual(original);
    expect(documents.size).toBe(2);
  });

  it("does not leave partial records if the transaction fails, and allows a safe retry", async () => {
    const file = await spreadsheet([
      ["Ana López", "HAQ", "SI"],
      ["Bruno Díaz", "HACS", "NO"],
    ]);
    failCommit(true);
    const logging = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect((await upload(file)).status).toBe(500);
      expect(documents.size).toBe(0);
      failCommit(false);
      expect((await upload(file)).status).toBe(201);
      expect(documents.size).toBe(2);
    } finally {
      logging.mockRestore();
    }
  });

  it("rejects invalid formats, oversized files and unrelated origins", async () => {
    const file = await spreadsheet([["Ana", "HAQ", "SI"]]);
    expect((await upload(file, "medicos.xls")).status).toBe(400);
    expect(
      (
        await upload(file, "medicos.xlsx", {
          origin: "https://another-site.example",
        })
      ).status,
    ).toBe(403);
    const tooLarge = new ArrayBuffer(MAX_IMPORT_FILE_BYTES + 1);
    expect((await upload(tooLarge)).status).toBe(413);
    expect((await upload(new ArrayBuffer(10))).status).toBe(400);
    expect(runTransaction).not.toHaveBeenCalled();
  });
});
