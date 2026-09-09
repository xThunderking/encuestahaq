import "server-only";

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import ExcelJS from "exceljs";
import sharp from "sharp";
import type {
  ChartDatum,
  DashboardAnalytics,
  DashboardResponse,
} from "@/modules/responses/get-admin-dashboard-data";
import {
  motivationNames,
  ratingNames,
  serviceNames,
} from "@/modules/responses/get-admin-dashboard-data";

const answerPrefix = "servicios_externos_diagnostico_pregunta_";
const chartColors = ["#0063a6", "#17a6a1", "#7957a8", "#16805a"];
const chartFontFamily = "HAQChartFont";

// Sharp renders the SVG on the server, where system fonts such as Arial are
// not guaranteed to exist. Embed a font that ships with Next so that chart
// labels are rasterized as text, rather than replacement-glyph boxes.
const chartFontBase64 = readFile(
  join(
    process.cwd(),
    "node_modules",
    "next",
    "dist",
    "compiled",
    "@vercel",
    "og",
    "Geist-Regular.ttf",
  ),
).then((font) => font.toString("base64"));

const questionLabels: Record<string, string> = {
  "1": "Motivo de elección",
  "2": "Otro motivo",
  "3": "Servicio recibido",
  "6": "Satisfacción general",
  "7": "Atención al recibirle",
  "8": "Claridad de indicaciones",
  "9": "Tiempo de espera",
  "10": "Personal durante el procedimiento",
  "11": "Instalaciones y limpieza",
  "14": "Recomendación (0-10)",
  "15": "Comentarios y sugerencias",
  "17": "Empresa del convenio",
  "18": "Otro servicio",
  "20": "Tipo de check-up",
  "21": "Rapidez para agendar",
  "22": "Información previa",
  "23": "Personal de admisión",
  "24": "Instalaciones de check-up",
  "25": "Tiempos de check-up",
  "26": "Personal de enfermería",
  "27": "Personal médico",
  "28": "Satisfacción de check-up",
  "29": "Nombre y apellido",
  "30": "Correo",
  "31": "Teléfono",
  "32": "Acepta compartir contacto",
};

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function shorten(value: string, length = 34) {
  return value.length > length ? `${value.slice(0, length - 1)}…` : value;
}

async function renderBarChart(
  title: string,
  data: ChartDatum[],
  color: string,
) {
  const fontBase64 = await chartFontBase64;
  const rows = Math.max(data.length, 1);
  const width = 900;
  const height = 95 + rows * 38;
  const left = 290;
  const right = 70;
  const max = Math.max(...data.map((item) => item.value), 1);
  const bars = data.length
    ? data
        .map((item, index) => {
          const y = 72 + index * 38;
          const barWidth = Math.max(3, ((width - left - right) * item.value) / max);
          return `
            <text x="18" y="${y + 19}" font-size="15" fill="#29434c">${escapeXml(shorten(item.name))}</text>
            <rect x="${left}" y="${y}" width="${barWidth}" height="24" rx="5" fill="${color}" />
            <text x="${Math.min(left + barWidth + 9, width - 30)}" y="${y + 18}" font-size="14" font-weight="700" fill="#29434c">${item.value}</text>`;
        })
        .join("")
    : `<text x="18" y="100" font-size="16" fill="#61737a">Sin datos disponibles</text>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <style>
      @font-face {
        font-family: '${chartFontFamily}';
        src: url('data:font/ttf;base64,${fontBase64}') format('truetype');
      }
    </style>
    <rect width="100%" height="100%" rx="12" fill="#ffffff" />
    <rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="12" fill="none" stroke="#dce5e7" />
    <text x="18" y="37" font-family="${chartFontFamily}" font-size="22" font-weight="700" fill="#173f4a">${escapeXml(title)}</text>
    <g font-family="${chartFontFamily}">${bars}</g>
  </svg>`;
  return {
    buffer: await sharp(Buffer.from(svg)).png().toBuffer(),
    width,
    height,
  };
}

function styleHeader(row: ExcelJS.Row) {
  row.height = 28;
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0063A6" } };
    cell.alignment = { vertical: "middle", wrapText: true };
  });
}

function questionNumber(key: string) {
  return key.startsWith(answerPrefix) ? key.slice(answerPrefix.length) : key;
}

function displayAnswer(key: string, value: unknown) {
  const number = questionNumber(key);
  const raw = String(value ?? "");
  if (number === "1") return motivationNames[raw] ?? raw;
  if (number === "3") return serviceNames[raw] ?? raw;
  if (number === "32") return raw === "1" ? "Sí" : raw === "0" ? "No" : raw;
  if (ratingNames[raw]) return ratingNames[raw];
  if (typeof value === "object" && value !== null) return JSON.stringify(value);
  return value ?? "";
}

function addAnalyticsTables(
  worksheet: ExcelJS.Worksheet,
  analytics: DashboardAnalytics,
) {
  const groups: Array<[string, ChartDatum[]]> = [
    ["Respuestas por día", analytics.dailyResponses],
    ["Servicios", analytics.services],
    ["Motivos de elección", analytics.motivations],
    ["Satisfacción general", analytics.satisfaction],
    ["Idiomas", analytics.languages],
    ["Distribución NPS", analytics.npsDistribution],
    ["Datos de contacto", analytics.contactConsent],
    ["Calidad por atributo", analytics.attributeRatings],
  ];
  worksheet.columns = [{ width: 38 }, { width: 18 }];
  let rowIndex = 1;
  for (const [title, data] of groups) {
    const titleCell = worksheet.getCell(rowIndex, 1);
    titleCell.value = title;
    titleCell.font = { size: 15, bold: true, color: { argb: "FF173F4A" } };
    rowIndex += 1;
    const header = worksheet.getRow(rowIndex);
    header.values = ["Categoría", "Valor"];
    styleHeader(header);
    rowIndex += 1;
    for (const item of data) {
      worksheet.getRow(rowIndex).values = [item.name, item.value];
      rowIndex += 1;
    }
    rowIndex += 2;
  }
}

export async function createSurveyExcel(
  responses: DashboardResponse[],
  analytics: DashboardAnalytics,
) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Encuestas HAQ";
  workbook.created = new Date();

  const summary = workbook.addWorksheet("Resumen", {
    views: [{ showGridLines: false }],
    properties: { defaultRowHeight: 20 },
  });
  summary.columns = Array.from({ length: 14 }, () => ({ width: 10 }));
  summary.mergeCells("A1:N2");
  const title = summary.getCell("A1");
  title.value = "Panel de resultados · Encuestas HAQ";
  title.font = { size: 24, bold: true, color: { argb: "FFFFFFFF" } };
  title.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF174E58" } };
  title.alignment = { vertical: "middle", horizontal: "left" };

  const metrics = [
    ["Total de respuestas", responses.length],
    ["NPS", analytics.nps ?? "Sin datos"],
    ["Promedio recomendación", analytics.averageRecommendation ?? "Sin datos"],
    ["Acepta contacto", `${analytics.completionWithContact}%`],
  ];
  metrics.forEach(([label, value], index) => {
    const start = 1 + index * 3;
    summary.mergeCells(4, start, 4, start + 1);
    summary.mergeCells(5, start, 6, start + 1);
    const labelCell = summary.getCell(4, start);
    labelCell.value = label;
    labelCell.font = { bold: true, color: { argb: "FF607178" } };
    const valueCell = summary.getCell(5, start);
    valueCell.value = value;
    valueCell.font = { size: 22, bold: true, color: { argb: "FF0063A6" } };
    valueCell.alignment = { vertical: "middle" };
  });

  const chartGroups: Array<[string, ChartDatum[]]> = [
    ["Respuestas de los últimos 14 días", analytics.dailyResponses],
    ["Servicios atendidos", analytics.services],
    ["Motivos de elección", analytics.motivations],
    ["Satisfacción general", analytics.satisfaction],
    ["Distribución de recomendación NPS", analytics.npsDistribution],
    ["Calidad promedio por atributo", analytics.attributeRatings],
    ["Idioma de respuesta", analytics.languages],
    ["Consentimiento para contacto", analytics.contactConsent],
  ];
  let imageRow = 8;
  for (const [index, [chartTitle, data]] of chartGroups.entries()) {
    const chart = await renderBarChart(
      chartTitle,
      data,
      chartColors[index % chartColors.length],
    );
    const imageId = workbook.addImage({
      base64: chart.buffer.toString("base64"),
      extension: "png",
    });
    summary.addImage(imageId, {
      tl: { col: 0, row: imageRow },
      ext: { width: chart.width, height: chart.height },
    });
    imageRow += Math.ceil(chart.height / 20) + 2;
  }

  const details = workbook.addWorksheet("Todas las respuestas", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  const answerKeys = [
    ...new Set(responses.flatMap((response) => Object.keys(response.answers))),
  ].sort((a, b) => Number(questionNumber(a)) - Number(questionNumber(b)));
  details.columns = [
    { header: "Folio", key: "id", width: 38 },
    { header: "Fecha", key: "submittedAt", width: 22 },
    { header: "Código de encuesta", key: "surveyCode", width: 34 },
    { header: "Idioma", key: "locale", width: 12 },
    ...answerKeys.map((key) => ({
      header: questionLabels[questionNumber(key)] ?? questionNumber(key),
      key,
      width: questionNumber(key) === "15" ? 55 : 30,
    })),
  ];
  styleHeader(details.getRow(1));
  details.autoFilter = { from: "A1", to: details.getCell(1, details.columnCount).address };
  for (const response of responses) {
    const row: Record<string, unknown> = {
      id: response.submissionId,
      submittedAt: response.submittedAt,
      surveyCode: response.surveyCode,
      locale: response.locale === "en" ? "Inglés" : "Español",
    };
    for (const key of answerKeys) row[key] = displayAnswer(key, response.answers[key]);
    const added = details.addRow(row);
    added.alignment = { vertical: "top", wrapText: true };
  }
  details.getColumn("submittedAt").numFmt = "dd/mm/yyyy hh:mm";

  const chartData = workbook.addWorksheet("Datos de gráficas", {
    views: [{ showGridLines: false }],
  });
  addAnalyticsTables(chartData, analytics);

  return workbook.xlsx.writeBuffer();
}
