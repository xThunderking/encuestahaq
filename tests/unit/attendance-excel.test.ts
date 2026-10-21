import ExcelJS from "exceljs";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AttendanceGuest } from "@/modules/attendance/get-attendance-guests";

const { getAttendanceGuests } = vi.hoisted(() => ({
  getAttendanceGuests: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/modules/attendance/get-attendance-guests", () => ({
  getAttendanceGuests,
}));

import {
  attendanceExcelFilename,
  createAttendanceExcel,
} from "@/modules/reports/create-attendance-excel";
import { GET } from "@/app/api/admin/attendance/export/route";

const cut = new Date("2026-10-21T02:10:00Z");
const guests: AttendanceGuest[] = [
  {
    id: "3",
    doctorName: "Carla Ruiz",
    hospital: "HACS",
    hasTicket: false,
    ticketNumber: null,
    checkedInAt: "2026-10-20T15:05:00Z",
  },
  {
    id: "1",
    doctorName: "Ana Álvarez",
    hospital: "HAQ",
    hasTicket: true,
    ticketNumber: "00017",
    checkedInAt: "2026-10-21T02:07:09Z",
  },
  {
    id: "2",
    doctorName: "Bruno López",
    hospital: "HAQ",
    hasTicket: true,
    ticketNumber: null,
    checkedInAt: null,
  },
];

async function loadReport(data = guests) {
  const bytes = await createAttendanceExcel(data, cut);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(bytes);
  return workbook;
}

afterEach(() => {
  vi.restoreAllMocks();
  getAttendanceGuests.mockReset();
});

describe("attendance Excel report", () => {
  it("exports complete, alphabetical lists, separated attendance and ticket sheets, and matching totals", async () => {
    const workbook = await loadReport();
    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual([
      "Resumen",
      "Todos los médicos",
      "Asistieron",
      "Sin asistencia",
      "Boletos",
    ]);
    const summary = workbook.getWorksheet("Resumen")!;
    expect(summary.getCell("A7").value).toBe(3);
    expect(summary.getCell("C7").value).toBe(2);
    expect(summary.getCell("E7").value).toBe(1);
    expect(summary.getCell("G7").value).toBeCloseTo(2 / 3);
    expect(summary.getCell("A4").text).toContain("20/10/2026 20:10:00");
    expect(summary.getCell("H11").value).toBe(2);
    expect(summary.getCell("H12").value).toBe(1);
    expect(summary.getCell("H13").value).toBe(1);
    expect(summary.getCell("H14").value).toBe(1);

    const all = workbook.getWorksheet("Todos los médicos")!;
    expect([7, 8, 9].map((row) => all.getCell(row, 2).value)).toEqual([
      "Ana Álvarez",
      "Bruno López",
      "Carla Ruiz",
    ]);
    expect(all.getCell("E6").value).toBe("No. de boleto");
    expect(all.getCell("E7").value).toBe("00017");
    expect(all.getCell("E7").numFmt).toBe("@");
    expect(all.getCell("E8").value).toBe("Sin asignar");
    expect(all.getCell("E9").value).toBe("No aplica");
    expect(all.getCell("F7").value).toEqual(new Date("2026-10-20T00:00:00Z"));
    expect(all.getCell("G7").value).toEqual(new Date("1899-12-30T20:07:09Z"));
    expect(all.getCell("G7").numFmt).toBe("hh:mm:ss");
    expect(all.getCell("F8").value).toBeNull();
    expect(all.getCell("G8").value).toBeNull();
    expect(all.views[0]).toMatchObject({ state: "frozen", ySplit: 6 });
    expect(all.getTable("TodosLosMedicos").headerRow).toBe(true);
    expect(workbook.getWorksheet("Asistieron")!.getCell("B8").value).toBe(
      "Carla Ruiz",
    );
    expect(workbook.getWorksheet("Sin asistencia")!.getCell("B7").value).toBe(
      "Bruno López",
    );
    expect(workbook.getWorksheet("Boletos")!.getCell("B8").value).toBe(
      "Bruno López",
    );
    expect(guests[0].doctorName).toBe("Carla Ruiz");
    expect(attendanceExcelFilename(cut)).toBe(
      "asistencia-dia-del-medico-2026-10-20_20-10-00.xlsx",
    );
  });

  it("keeps user-entered text as text rather than executable spreadsheet formulas", async () => {
    const workbook = await loadReport([
      {
        ...guests[1],
        doctorName: '=HYPERLINK("https://example.com")',
        ticketNumber: "=1+1",
      },
    ]);
    const sheet = workbook.getWorksheet("Todos los médicos")!;
    expect(sheet.getCell("B7").value).toBe('=HYPERLINK("https://example.com")');
    expect(sheet.getCell("B7").type).toBe(ExcelJS.ValueType.String);
    expect(sheet.getCell("E7").value).toBe("=1+1");
    expect(sheet.getCell("E7").type).toBe(ExcelJS.ValueType.String);
  });

  it("orders tickets numerically with unassigned numbers at the end", async () => {
    const workbook = await loadReport([
      { ...guests[1], id: "a", doctorName: "Ana", ticketNumber: "0010" },
      { ...guests[1], id: "b", doctorName: "Bruno", ticketNumber: "0002" },
      { ...guests[1], id: "c", doctorName: "Carla", ticketNumber: null },
    ]);
    const sheet = workbook.getWorksheet("Boletos")!;
    expect([7, 8, 9].map((row) => sheet.getCell(row, 5).value)).toEqual([
      "0002",
      "0010",
      "Sin asignar",
    ]);
  });

  it("creates a usable empty workbook without inventing doctor rows or dividing by zero", async () => {
    const workbook = await loadReport([]);
    expect(workbook.getWorksheet("Resumen")!.getCell("G7").value).toBe(0);
    for (const sheet of workbook.worksheets.slice(1)) {
      expect(sheet.getCell("B6").value).toBe("Nombre del médico");
      expect(sheet.getCell("A7").text).toContain("No hay médicos");
    }
  });

  it("downloads a fresh server snapshot on each request with XLSX headers and no caching", async () => {
    getAttendanceGuests
      .mockResolvedValueOnce(guests)
      .mockResolvedValueOnce([guests[1]]);
    const first = await GET();
    expect(first.status).toBe(200);
    expect(first.headers.get("Content-Type")).toContain("spreadsheetml.sheet");
    expect(first.headers.get("Content-Disposition")).toMatch(
      /attachment; filename="asistencia-dia-del-medico-.*\.xlsx"/,
    );
    expect(first.headers.get("Cache-Control")).toBe("private, no-store");
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await first.arrayBuffer());
    expect(workbook.getWorksheet("Resumen")!.getCell("A7").value).toBe(3);
    const second = await GET();
    await workbook.xlsx.load(await second.arrayBuffer());
    expect(workbook.getWorksheet("Resumen")!.getCell("A7").value).toBe(1);
    expect(getAttendanceGuests).toHaveBeenCalledTimes(2);
  });

  it("returns a readable error instead of a broken Excel file when the shared list is unavailable", async () => {
    getAttendanceGuests.mockRejectedValueOnce(
      new Error("Fixture connection failure"),
    );
    vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await GET();
    expect(response.status).toBe(500);
    expect(response.headers.get("Content-Type")).toContain("application/json");
    expect(await response.json()).toMatchObject({
      error: expect.stringContaining("No fue posible generar el Excel"),
    });
  });
});
