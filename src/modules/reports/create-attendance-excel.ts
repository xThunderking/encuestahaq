import "server-only";

import ExcelJS from "exceljs";
import type { AttendanceGuest } from "@/modules/attendance/get-attendance-guests";

const TIME_ZONE = "America/Mexico_City";
const colors = {
  navy: "FF123B69",
  blue: "FF1265B0",
  cyan: "FF18B3CE",
  ink: "FF253C53",
  muted: "FF64788C",
  white: "FFFFFFFF",
  pale: "FFF1F6FC",
  line: "FFDFE8F2",
  green: "FF177657",
  greenLight: "FFE8F6EF",
  amber: "FF94600E",
  amberLight: "FFFFF4DE",
  purple: "FF7254A5",
  purpleLight: "FFF3EFFA",
};
const localDateTime = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function dateParts(date: Date) {
  return Object.fromEntries(
    localDateTime.formatToParts(date).map(({ type, value }) => [type, value]),
  );
}

export function attendanceExcelFilename(generatedAt: Date) {
  const p = dateParts(generatedAt);
  return `asistencia-dia-del-medico-${p.year}-${p.month}-${p.day}_${p.hour}-${p.minute}-${p.second}.xlsx`;
}

function fill(color: string): ExcelJS.Fill {
  return { type: "pattern", pattern: "solid", fgColor: { argb: color } };
}

function banner(
  sheet: ExcelJS.Worksheet,
  range: string,
  text: string,
  background: string,
  foreground = colors.white,
  size = 12,
) {
  sheet.mergeCells(range);
  const cell = sheet.getCell(range.split(":")[0]);
  cell.value = text;
  cell.fill = fill(background);
  cell.font = {
    name: "Calibri",
    size,
    bold: true,
    color: { argb: foreground },
  };
  cell.alignment = { vertical: "middle", wrapText: true, indent: 1 };
  return cell;
}

function reportSheet(
  workbook: ExcelJS.Workbook,
  name: string,
  subtitle: string,
  generatedAt: Date,
  tabColor: string,
  lastColumn = "H",
) {
  const sheet = workbook.addWorksheet(name, {
    properties: { tabColor: { argb: tabColor }, defaultRowHeight: 24 },
    views: [{ state: "frozen", ySplit: 6, showGridLines: false }],
    pageSetup: {
      paperSize: 9,
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      printTitlesRow: "1:6",
      margins: {
        left: 0.25,
        right: 0.25,
        top: 0.4,
        bottom: 0.4,
        header: 0.15,
        footer: 0.15,
      },
    },
    headerFooter: {
      oddFooter:
        "&LHospital Ángeles Health System&CDesayuno · Día del Médico&RPágina &P de &N",
    },
  });
  banner(
    sheet,
    `A1:${lastColumn}2`,
    "DESAYUNO · DÍA DEL MÉDICO",
    colors.navy,
    colors.white,
    22,
  );
  banner(
    sheet,
    `A3:${lastColumn}3`,
    `Hospital Ángeles Health System  |  ${subtitle}`,
    colors.blue,
  );
  const p = dateParts(generatedAt);
  banner(
    sheet,
    `A4:${lastColumn}4`,
    `Corte: ${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}:${p.second} · Hora de Ciudad de México`,
    colors.pale,
    colors.muted,
    11,
  );
  sheet.getRow(1).height = 24;
  sheet.getRow(2).height = 24;
  sheet.getRow(3).height = 28;
  sheet.getRow(4).height = 25;
  sheet.getRow(5).height = 12;
  return sheet;
}

function arrivalCells(isoDate: string | null): [Date | null, number | null] {
  if (!isoDate) return [null, null];
  const arrival = new Date(isoDate);
  if (Number.isNaN(arrival.getTime())) return [null, null];
  const p = dateParts(arrival);
  return [
    new Date(Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day))),
    (Number(p.hour) * 3600 + Number(p.minute) * 60 + Number(p.second)) / 86400,
  ];
}

function guestSheet(
  workbook: ExcelJS.Workbook,
  name: string,
  tableName: string,
  guests: AttendanceGuest[],
  generatedAt: Date,
  tabColor: string,
  headerColor = colors.blue,
) {
  const sheet = reportSheet(
    workbook,
    name,
    `${name} · ${guests.length} médicos`,
    generatedAt,
    tabColor,
    "G",
  );
  const labels = [
    "No.",
    "Nombre del médico",
    "Asistencia",
    "¿Tiene boleto?",
    "No. de boleto",
    "Fecha de llegada",
    "Hora de llegada",
  ];
  [7, 46, 20, 18, 24, 20, 20].forEach((width, index) => {
    sheet.getColumn(index + 1).width = width;
  });
  const rows = guests.map((guest, index) => {
    const [date, time] = arrivalCells(guest.checkedInAt);
    return [
      index + 1,
      guest.doctorName,
      guest.checkedInAt ? "Asistió" : "Sin asistencia",
      guest.hasTicket ? "Sí" : "No",
      guest.hasTicket ? guest.ticketNumber || "Sin asignar" : "No aplica",
      date,
      time,
    ];
  });
  if (rows.length) {
    sheet.addTable({
      name: tableName,
      ref: "A6",
      headerRow: true,
      style: { theme: "TableStyleMedium2", showRowStripes: true },
      columns: labels.map((label) => ({ name: label, filterButton: true })),
      rows,
    });
  } else {
    sheet.getRow(6).values = labels;
    banner(
      sheet,
      "A7:G8",
      "No hay médicos en esta categoría al momento del corte.",
      colors.pale,
      colors.muted,
    );
  }
  sheet.getRow(6).height = 32;
  sheet.getRow(6).eachCell((cell) => {
    cell.fill = fill(headerColor);
    cell.font = {
      name: "Calibri",
      size: 11,
      bold: true,
      color: { argb: colors.white },
    };
    cell.alignment = {
      horizontal: "center",
      vertical: "middle",
      wrapText: true,
    };
  });
  guests.forEach((guest, index) => {
    const row = sheet.getRow(index + 7);
    row.height = Math.max(
      30,
      Math.ceil(guest.doctorName.length / 40) * 16 + 12,
    );
    row.eachCell({ includeEmpty: true }, (cell, column) => {
      cell.font = { name: "Calibri", size: 11, color: { argb: colors.ink } };
      cell.alignment = {
        horizontal: column === 2 ? "left" : "center",
        vertical: "middle",
        wrapText: true,
      };
      cell.border = { bottom: { style: "hair", color: { argb: colors.line } } };
      cell.fill = fill(index % 2 ? colors.pale : colors.white);
    });
    const status = row.getCell(3);
    status.font = {
      name: "Calibri",
      size: 11,
      bold: true,
      color: { argb: guest.checkedInAt ? colors.green : colors.amber },
    };
    status.fill = fill(
      guest.checkedInAt ? colors.greenLight : colors.amberLight,
    );
    row.getCell(5).numFmt = "@";
    row.getCell(5).font = {
      name: "Consolas",
      size: 11,
      color: { argb: colors.blue },
    };
    row.getCell(6).numFmt = "dd/mm/yyyy";
    row.getCell(7).numFmt = "hh:mm:ss";
  });
  sheet.pageSetup.printArea = `A1:G${Math.max(8, guests.length + 6)}`;
}

export async function createAttendanceExcel(
  guests: AttendanceGuest[],
  generatedAt = new Date(),
) {
  const sorted = [...guests.filter((guest) => guest.isExtra !== true)].sort(
    (a, b) =>
      a.doctorName.localeCompare(b.doctorName, "es", { sensitivity: "base" }) ||
      a.id.localeCompare(b.id),
  );
  const extras = [...guests.filter((guest) => guest.isExtra === true)].sort(
    (a, b) =>
      a.doctorName.localeCompare(b.doctorName, "es", { sensitivity: "base" }) ||
      a.id.localeCompare(b.id),
  );
  const attended = sorted.filter((guest) => guest.checkedInAt);
  const pending = sorted.filter((guest) => !guest.checkedInAt);
  const extrasAttended = extras.filter((guest) => guest.checkedInAt);
  const withTicket = sorted.filter((guest) => guest.hasTicket);
  const orderedTickets = [...withTicket].sort((a, b) => {
    const aNumber = a.ticketNumber?.trim();
    const bNumber = b.ticketNumber?.trim();
    if (!aNumber && bNumber) return 1;
    if (aNumber && !bNumber) return -1;
    return (
      (aNumber ?? "").localeCompare(bNumber ?? "", "es", {
        numeric: true,
        sensitivity: "base",
      }) ||
      a.doctorName.localeCompare(b.doctorName, "es", { sensitivity: "base" })
    );
  });
  const assignedTicket = withTicket.filter((guest) =>
    guest.ticketNumber?.trim(),
  );
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Hospital Ángeles Health System";
  workbook.title = "Lista de invitados · Desayuno Día del Médico";
  workbook.subject = "Control de asistencia y boletos";
  workbook.created = generatedAt;
  workbook.modified = generatedAt;

  const summary = reportSheet(
    workbook,
    "Resumen",
    "Lista oficial y extras separados",
    generatedAt,
    colors.cyan,
  );
  summary.views = [{ showGridLines: false }];
  summary.columns = Array.from({ length: 8 }, () => ({ width: 18 }));
  const cards = [
    {
      from: "A",
      to: "B",
      label: "MÉDICOS EN LISTA",
      value: sorted.length,
      color: colors.blue,
      bg: colors.pale,
    },
    {
      from: "C",
      to: "D",
      label: "ASISTIERON",
      value: attended.length,
      color: colors.green,
      bg: colors.greenLight,
    },
    {
      from: "E",
      to: "F",
      label: "SIN ASISTENCIA",
      value: pending.length,
      color: colors.amber,
      bg: colors.amberLight,
    },
    {
      from: "G",
      to: "H",
      label: "ASISTENCIA GENERAL",
      value: sorted.length ? attended.length / sorted.length : 0,
      color: colors.blue,
      bg: colors.pale,
    },
  ];
  for (const card of cards) {
    banner(
      summary,
      `${card.from}6:${card.to}6`,
      card.label,
      card.bg,
      card.color,
      11,
    );
    const cell = banner(
      summary,
      `${card.from}7:${card.to}8`,
      "",
      card.bg,
      card.color,
      30,
    );
    cell.value = card.value;
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.numFmt = card.from === "G" ? "0.0%" : "0";
  }
  banner(summary, "A10:D10", "PROGRESO GENERAL", colors.blue);
  const attendanceMetrics: [string, number][] = [
    ["Médicos en lista", sorted.length],
    ["Asistieron", attended.length],
    ["Pendientes", pending.length],
  ];
  attendanceMetrics.forEach(([label, count], index) => {
    const row = index + 11;
    summary.mergeCells(`A${row}:C${row}`);
    summary.getCell(`A${row}`).value = label;
    summary.getCell(`D${row}`).value = count;
    for (const cell of [
      summary.getCell(`A${row}`),
      summary.getCell(`D${row}`),
    ]) {
      cell.fill = fill(index % 2 ? colors.pale : colors.white);
      cell.font = {
        name: "Calibri",
        size: 12,
        bold: cell.address === `D${row}`,
        color: { argb: colors.ink },
      };
      cell.alignment = {
        vertical: "middle",
        horizontal: cell.address === `D${row}` ? "center" : "left",
        indent: cell.address === `A${row}` ? 1 : 0,
      };
    }
  });
  banner(summary, "E10:H10", "CONTROL DE BOLETOS", colors.blue);
  const ticketMetrics: [string, number][] = [
    ["Médicos con boleto", withTicket.length],
    ["Médicos sin boleto", sorted.length - withTicket.length],
    ["Con número asignado", assignedTicket.length],
    ["Boleto sin número asignado", withTicket.length - assignedTicket.length],
    [
      "Asistieron con boleto",
      attended.filter((guest) => guest.hasTicket).length,
    ],
  ];
  ticketMetrics.forEach(([label, count], index) => {
    const row = index + 11;
    summary.mergeCells(`E${row}:G${row}`);
    summary.getCell(`E${row}`).value = label;
    summary.getCell(`H${row}`).value = count;
    summary.getCell(`E${row}`).fill = fill(
      index % 2 ? colors.pale : colors.white,
    );
    summary.getCell(`E${row}`).alignment = { vertical: "middle", indent: 1 };
    summary.getCell(`H${row}`).fill = fill(
      index % 2 ? colors.pale : colors.white,
    );
    summary.getCell(`H${row}`).font = {
      name: "Calibri",
      size: 12,
      bold: true,
      color: { argb: colors.blue },
    };
    summary.getCell(`H${row}`).alignment = {
      horizontal: "center",
      vertical: "middle",
    };
  });
  const contentRow = 18;
  banner(
    summary,
    `A${contentRow}:H${contentRow}`,
    "HOJAS DEL REPORTE",
    colors.blue,
  );
  const sections = [
    [
      "Todos los médicos",
      "Lista oficial, ordenada por nombre, con asistencia y boletos.",
    ],
    [
      "Asistieron",
      "Médicos oficiales con llegada confirmada, con fecha y hora del registro.",
    ],
    [
      "Sin asistencia",
      "Invitados oficiales que no tienen llegada confirmada al momento del corte.",
    ],
    [
      "Boletos",
      "Médicos oficiales con boleto, número asignado y estado de asistencia.",
    ],
  ];
  if (extras.length)
    sections.push([
      "EXTRAS",
      "Doctores agregados fuera de la lista oficial, con su asistencia.",
    ]);
  sections.forEach(([title, description], index) => {
    const row = contentRow + index + 1;
    summary.mergeCells(`A${row}:B${row}`);
    summary.getCell(`A${row}`).value = {
      text: title,
      hyperlink: `#'${title}'!A1`,
    };
    summary.getCell(`A${row}`).font = {
      name: "Calibri",
      size: 11,
      bold: true,
      color: { argb: colors.blue },
      underline: true,
    };
    summary.mergeCells(`C${row}:H${row}`);
    summary.getCell(`C${row}`).value = description;
  });
  let noteRow = contentRow + 6;
  if (extras.length) {
    const extrasHeadingRow = contentRow + 7;
    const extrasMetricsRow = contentRow + 8;
    banner(
      summary,
      `A${extrasHeadingRow}:H${extrasHeadingRow}`,
      "EXTRAS",
      colors.purple,
    );
    const extraMetrics = [
      {
        label: "Total",
        from: "A",
        to: "B",
        valueColumn: "C",
        value: extras.length,
      },
      {
        label: "Asistieron",
        from: "D",
        to: "E",
        valueColumn: "F",
        value: extrasAttended.length,
      },
      {
        label: "Pendientes",
        from: "G",
        to: "G",
        valueColumn: "H",
        value: extras.length - extrasAttended.length,
      },
    ];
    extraMetrics.forEach(({ label, from, to, valueColumn, value }) => {
      if (from !== to)
        summary.mergeCells(
          `${from}${extrasMetricsRow}:${to}${extrasMetricsRow}`,
        );
      const labelCell = summary.getCell(`${from}${extrasMetricsRow}`);
      const valueCell = summary.getCell(`${valueColumn}${extrasMetricsRow}`);
      labelCell.value = label;
      valueCell.value = value;
      [labelCell, valueCell].forEach((cell) => {
        cell.fill = fill(colors.purpleLight);
        cell.alignment = { vertical: "middle", horizontal: "center" };
      });
      valueCell.font = {
        name: "Calibri",
        size: 12,
        bold: true,
        color: { argb: colors.purple },
      };
    });
    noteRow = contentRow + 10;
  }
  banner(
    summary,
    `A${noteRow}:H${noteRow + 1}`,
    "El reporte refleja un corte de la lista compartida. “Sin asistencia” significa que no hay una llegada confirmada a esa hora. Las fechas y horas corresponden a Ciudad de México.",
    colors.pale,
    colors.muted,
    11,
  );
  summary.eachRow((row) => {
    row.eachCell((cell) => {
      if (!cell.font)
        cell.font = { name: "Calibri", size: 11, color: { argb: colors.ink } };
      if (!cell.alignment)
        cell.alignment = { vertical: "middle", wrapText: true };
    });
  });
  summary.pageSetup.printTitlesRow = "1:4";
  summary.pageSetup.printArea = `A1:H${noteRow + 1}`;
  guestSheet(
    workbook,
    "Todos los médicos",
    "TodosLosMedicos",
    sorted,
    generatedAt,
    colors.blue,
  );
  guestSheet(
    workbook,
    "Asistieron",
    "MedicosAsistieron",
    attended,
    generatedAt,
    colors.green,
  );
  guestSheet(
    workbook,
    "Sin asistencia",
    "MedicosSinAsistencia",
    pending,
    generatedAt,
    colors.amber,
  );
  guestSheet(
    workbook,
    "Boletos",
    "BoletosMedicos",
    orderedTickets,
    generatedAt,
    colors.cyan,
  );
  if (extras.length)
    guestSheet(
      workbook,
      "EXTRAS",
      "MedicosExtras",
      extras,
      generatedAt,
      colors.purple,
      colors.purple,
    );
  return workbook.xlsx.writeBuffer();
}
