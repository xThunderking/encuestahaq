import "server-only";

import PDFDocument from "pdfkit";
import type {
  ChartDatum,
  DashboardAnalytics,
  DashboardResponse,
} from "@/modules/responses/get-admin-dashboard-data";

const palette = ["#A8C5E8", "#9EDBD1", "#F7D49A", "#F3B6B5", "#C9B6E4"];
const textColor = "#29434C";
const mutedColor = "#61737A";
const pageWidth = 842;
const pageHeight = 595;
const margin = 38;
const chartWidth = pageWidth - margin * 2;

type PdfDocument = InstanceType<typeof PDFDocument>;

function addPage(doc: PdfDocument) {
  doc.addPage();
  return margin;
}

function writeChart(
  doc: PdfDocument,
  title: string,
  data: ChartDatum[],
  color: string,
  cursor: number,
) {
  const rowHeight = 24;
  const height = Math.max(90, 52 + Math.max(data.length, 1) * rowHeight);
  if (cursor + height > pageHeight - margin) cursor = addPage(doc);

  doc
    .roundedRect(margin, cursor, chartWidth, height, 10)
    .fillAndStroke("#FFFFFF", "#DCE5E7");
  doc
    .font("Helvetica-Bold")
    .fontSize(14)
    .fillColor(textColor)
    .text(title, margin + 16, cursor + 14);

  if (!data.length) {
    doc
      .font("Helvetica-Oblique")
      .fontSize(10)
      .fillColor(mutedColor)
      .text("Sin datos disponibles", margin + 16, cursor + 45);
    return cursor + height + 14;
  }

  const max = Math.max(...data.map((item) => item.value), 1);
  const labelWidth = 220;
  const valueWidth = 42;
  const barX = margin + labelWidth + 26;
  const barWidth = chartWidth - labelWidth - valueWidth - 58;

  data.forEach((item, index) => {
    const y = cursor + 46 + index * rowHeight;
    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor(textColor)
      .text(item.name, margin + 16, y + 3, { width: labelWidth - 20, ellipsis: true });
    doc.roundedRect(barX, y + 3, barWidth, 14, 4).fill("#EEF3F4");
    if (item.value > 0) {
      doc
        .roundedRect(barX, y + 3, Math.max(3, (item.value / max) * barWidth), 14, 4)
        .fill(color);
    }
    doc
      .font("Helvetica-Bold")
      .fontSize(9)
      .fillColor(textColor)
      .text(String(item.value), barX + barWidth + 10, y + 4, { width: valueWidth });
  });

  return cursor + height + 14;
}

export async function createSurveyPdf(
  responses: DashboardResponse[],
  analytics: DashboardAnalytics,
) {
  const document = new PDFDocument({
    size: "A4",
    layout: "landscape",
    margin,
    info: {
      Title: "Resultados de encuestas HAQ",
      Author: "Encuestas HAQ",
    },
  });
  const chunks: Buffer[] = [];
  const result = new Promise<Buffer>((resolve, reject) => {
    document.on("data", (chunk: Buffer) => chunks.push(chunk));
    document.on("end", () => resolve(Buffer.concat(chunks)));
    document.on("error", reject);
  });

  document
    .rect(0, 0, pageWidth, 82)
    .fill("#174E58")
    .font("Helvetica-Bold")
    .fontSize(23)
    .fillColor("#FFFFFF")
    .text("Panel de resultados · Encuestas HAQ", margin, 25);
  document
    .font("Helvetica")
    .fontSize(10)
    .fillColor("#D6EAEC")
    .text(`Generado el ${new Intl.DateTimeFormat("es-MX", { dateStyle: "long" }).format(new Date())}`, margin, 57);

  const metrics = [
    ["Total de respuestas", String(responses.length)],
    ["NPS", String(analytics.nps ?? "Sin datos")],
    ["Promedio recomendación", String(analytics.averageRecommendation ?? "Sin datos")],
    ["Acepta contacto", `${analytics.completionWithContact}%`],
  ];
  const metricWidth = (chartWidth - 30) / metrics.length;
  metrics.forEach(([label, value], index) => {
    const x = margin + index * (metricWidth + 10);
    document.roundedRect(x, 101, metricWidth, 58, 8).fill("#F4F8F9");
    document.font("Helvetica").fontSize(9).fillColor(mutedColor).text(label, x + 10, 112);
    document.font("Helvetica-Bold").fontSize(18).fillColor("#0063A6").text(value, x + 10, 130);
  });

  const charts: Array<[string, ChartDatum[]]> = [
    ["Respuestas por día", analytics.dailyResponses],
    ["Servicios atendidos", analytics.services],
    ["Motivos de elección", analytics.motivations],
    ["Satisfacción general", analytics.satisfaction],
    ["Idioma de respuesta", analytics.languages],
    ["Puntuación de recomendación NPS", analytics.npsDistribution],
    ["Calidad por atributo", analytics.attributeRatings],
    ["Datos de contacto", analytics.contactConsent],
  ];

  let cursor = 184;
  charts.forEach(([title, data], index) => {
    cursor = writeChart(document, title, data, palette[index % palette.length], cursor);
  });

  document.end();
  return result;
}
