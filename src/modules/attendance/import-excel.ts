import "server-only";
import ExcelJS from "exceljs";
import JSZip from "jszip";
import {
  attendanceImportIdentity,
  IMPORT_HEADERS,
  MAX_IMPORT_ROWS,
  normalizeImportText,
  type AttendanceImportIssue,
  type AttendanceImportRecord,
} from "./import-contract";

export async function createAttendanceTemplate() {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Hospital Ángeles Querétaro";
  workbook.title = "Plantilla de registro de médicos · Día del Médico";
  const sheet = workbook.addWorksheet("Médicos", {
    views: [{ state: "frozen", ySplit: 1, showGridLines: false }],
    properties: { tabColor: { argb: "FF1265B0" } },
    pageSetup: {
      orientation: "portrait",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
    },
  });
  sheet.columns = [{ width: 54 }, { width: 24 }, { width: 24 }];
  sheet.getRow(1).values = [...IMPORT_HEADERS];
  sheet.getRow(1).height = 34;
  sheet.getRow(1).eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1265B0" },
    };
    cell.font = {
      name: "Calibri",
      size: 12,
      bold: true,
      color: { argb: "FFFFFFFF" },
    };
    cell.alignment = { vertical: "middle", horizontal: "center" };
  });
  for (let row = 2; row <= MAX_IMPORT_ROWS + 1; row++) {
    sheet.getRow(row).height = 24;
    for (let column = 1; column <= 3; column++) {
      const cell = sheet.getCell(row, column);
      cell.font = { name: "Calibri", size: 12, color: { argb: "FF253C53" } };
      cell.alignment = {
        vertical: "middle",
        horizontal: column === 1 ? "left" : "center",
      };
      cell.numFmt = "@";
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: row % 2 ? "FFF1F6FC" : "FFFFFFFF" },
      };
    }
    sheet.getCell(row, 2).dataValidation = {
      type: "list",
      allowBlank: false,
      formulae: ['"HAQ,HACS"'],
      showErrorMessage: true,
      errorStyle: "stop",
      errorTitle: "Hospital no válido",
      error: "Selecciona HAQ o HACS.",
      showInputMessage: true,
      promptTitle: "Hospital",
      prompt: "Selecciona HAQ o HACS en la lista.",
    };
    sheet.getCell(row, 3).dataValidation = {
      type: "list",
      allowBlank: false,
      formulae: ['"SI,NO"'],
      showErrorMessage: true,
      errorStyle: "stop",
      errorTitle: "Boleto no válido",
      error: "Selecciona SI o NO.",
      showInputMessage: true,
      promptTitle: "Boleto",
      prompt: "Indica si el médico tiene boleto: SI o NO.",
    };
  }
  sheet.autoFilter = `A1:C${MAX_IMPORT_ROWS + 1}`;
  sheet.pageSetup.printTitlesRow = "1:1";
  const instructions = workbook.addWorksheet("Instrucciones", {
    views: [{ showGridLines: false }],
  });
  instructions.columns = [
    { width: 26 },
    { width: 26 },
    { width: 26 },
    { width: 26 },
  ];
  const lines = [
    "Hospital Ángeles Querétaro · Día del Médico",
    "1. En la hoja Médicos, escribe un médico por fila debajo de los encabezados.",
    "2. NOMBRE DEL MEDICO: nombre completo, de 2 a 120 caracteres.",
    "3. HOSPITAL: selecciona únicamente HAQ o HACS.",
    "4. BOLETO: selecciona SI o NO. No se solicita número de boleto.",
    `5. Guarda el archivo en formato .xlsx. Máximo ${MAX_IMPORT_ROWS} médicos por archivo y 2 MB.`,
    "6. En Estadísticas, selecciona el archivo y pulsa Importar médicos.",
    "Los médicos se agregan a la lista como pendientes de llegada, sin número de boleto.",
    "Si hay errores, corrige las filas indicadas y vuelve a subir el archivo. No se guarda ninguna fila hasta que todas sean válidas.",
    "Si un nombre y hospital ya están en la lista, se conserva su registro, asistencia y boleto. No se vuelve a agregar.",
    "Conserva los tres encabezados y no agregues columnas ni fórmulas. Las filas completamente vacías se ignoran.",
  ];
  lines.forEach((line, index) => {
    const row = index + 1;
    instructions.mergeCells(row, 1, row, 4);
    const cell = instructions.getCell(row, 1);
    cell.value = line;
    cell.font = {
      name: "Calibri",
      size: index === 0 ? 16 : 12,
      bold: index === 0,
      color: { argb: index === 0 ? "FFFFFFFF" : "FF253C53" },
    };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: {
        argb: index === 0 ? "FF1265B0" : index % 2 ? "FFF1F6FC" : "FFFFFFFF",
      },
    };
    cell.alignment = { vertical: "middle", wrapText: true, indent: 1 };
    instructions.getRow(row).height = index === 0 ? 38 : 40;
  });
  return workbook.xlsx.writeBuffer();
}

function cellText(cell: ExcelJS.Cell): string | null {
  const value = cell.value;
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object" && "richText" in value) {
    return value.richText.map((part) => part.text).join("");
  }
  return null;
}

async function normalizeSpreadsheetXmlPrefixes(buffer: ExcelJS.Buffer) {
  const zip = await JSZip.loadAsync(buffer);
  let changed = false;

  for (const [path, entry] of Object.entries(zip.files)) {
    if (entry.dir || !path.startsWith("xl/") || !path.endsWith(".xml"))
      continue;

    const xml = await entry.async("string");
    const namespace = xml.match(
      /xmlns:([A-Za-z_][A-Za-z0-9_.-]*)=(["'])http:\/\/schemas\.openxmlformats\.org\/spreadsheetml\/2006\/main\2/,
    );
    if (!namespace) continue;

    const prefix = namespace[1];
    const normalized = xml.replace(
      /<(\/?)([A-Za-z_][A-Za-z0-9_.-]*):([A-Za-z_][A-Za-z0-9_.-]*)/g,
      (tag, slash: string, tagPrefix: string, localName: string) =>
        tagPrefix === prefix ? `<${slash}${localName}` : tag,
    );
    if (normalized !== xml) {
      zip.file(path, normalized);
      changed = true;
    }
  }

  return changed
    ? ((await zip.generateAsync({
        type: "nodebuffer",
      })) as unknown as ExcelJS.Buffer)
    : buffer;
}

export async function parseAttendanceImport(buffer: ExcelJS.Buffer) {
  const workbook = new ExcelJS.Workbook();
  const readableBuffer = await normalizeSpreadsheetXmlPrefixes(buffer);
  await workbook.xlsx.load(readableBuffer, {
    ignoreNodes: [
      "dataValidations",
      "conditionalFormatting",
      "drawing",
      "picture",
      "extLst",
    ],
  });
  const records: AttendanceImportRecord[] = [];
  const issues: AttendanceImportIssue[] = [];
  let errorCount = 0;
  function issue(row: number, message: string) {
    errorCount++;
    if (issues.length < 50) issues.push({ row, message });
  }
  const matchingSheets = workbook.worksheets.filter((sheet) =>
    IMPORT_HEADERS.every(
      (header, index) =>
        normalizeImportText(cellText(sheet.getCell(1, index + 1)) ?? "") ===
        header,
    ),
  );
  if (matchingSheets.length !== 1) {
    issue(
      1,
      "Usa la plantilla con una sola hoja de datos y los encabezados NOMBRE DEL MEDICO, HOSPITAL y BOLETO, en ese orden.",
    );
    return { records, issues, errorCount };
  }
  const sheet = matchingSheets[0];
  const identities = new Map<string, number>();
  let populatedRows = 0;
  sheet.eachRow((row, rowNumber) => {
    let hasExtraColumns = false;
    row.eachCell((cell, column) => {
      if (column > 3 && cell.value !== null && cell.value !== "")
        hasExtraColumns = true;
    });
    if (rowNumber === 1) {
      if (hasExtraColumns)
        issue(
          1,
          "La plantilla debe contener únicamente las tres columnas solicitadas.",
        );
      return;
    }
    const values = [1, 2, 3].map((column) => cellText(row.getCell(column)));
    if (!hasExtraColumns && values.every((value) => value?.trim() === ""))
      return;
    populatedRows++;
    if (populatedRows > MAX_IMPORT_ROWS) {
      if (populatedRows === MAX_IMPORT_ROWS + 1)
        issue(
          rowNumber,
          `El archivo supera el máximo de ${MAX_IMPORT_ROWS} médicos. Divídelo en varios archivos.`,
        );
      return;
    }
    if (hasExtraColumns)
      issue(
        rowNumber,
        "Solo se permiten nombre del médico, hospital y boleto.",
      );
    if (values.some((value) => value === null)) {
      issue(
        rowNumber,
        "Escribe los datos como texto. No se admiten fórmulas, fechas ni valores calculados.",
      );
      return;
    }
    const doctorName = values[0]!.trim().replace(/\s+/g, " ");
    const hospital = normalizeImportText(values[1]!);
    const ticket = normalizeImportText(values[2]!);
    const before = errorCount;
    if (doctorName.length < 2 || doctorName.length > 120)
      issue(
        rowNumber,
        "El nombre del médico debe tener entre 2 y 120 caracteres.",
      );
    if (hospital !== "HAQ" && hospital !== "HACS")
      issue(rowNumber, "El hospital debe ser HAQ o HACS.");
    if (ticket !== "SI" && ticket !== "NO")
      issue(rowNumber, "Boleto debe ser SI o NO.");
    if (before !== errorCount || hasExtraColumns) return;
    const identity = attendanceImportIdentity(doctorName, hospital);
    const previousRow = identities.get(identity);
    if (previousRow !== undefined) {
      issue(
        rowNumber,
        `Este nombre y hospital ya aparecen en la fila ${previousRow}. Conserva una sola fila por médico.`,
      );
      return;
    }
    identities.set(identity, rowNumber);
    records.push({
      doctorName,
      hospital: hospital as AttendanceImportRecord["hospital"],
      hasTicket: ticket === "SI",
    });
  });
  if (!populatedRows)
    issue(
      2,
      "La plantilla no contiene médicos. Completa al menos una fila debajo de los encabezados.",
    );
  return { records, issues, errorCount };
}
