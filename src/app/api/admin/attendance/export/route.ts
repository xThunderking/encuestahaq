import { getAttendanceGuests } from "@/modules/attendance/get-attendance-guests";
import {
  attendanceExcelFilename,
  createAttendanceExcel,
} from "@/modules/reports/create-attendance-excel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const guests = await getAttendanceGuests();
    const generatedAt = new Date();
    const report = await createAttendanceExcel(guests, generatedAt);
    return new Response(new Uint8Array(report), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${attendanceExcelFilename(generatedAt)}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Unable to export medical event attendance", error);
    return Response.json(
      {
        error:
          "No fue posible generar el Excel. Intenta descargarlo nuevamente.",
      },
      { status: 500, headers: { "Cache-Control": "private, no-store" } },
    );
  }
}
