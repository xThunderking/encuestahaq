import { createAttendanceTemplate } from "@/modules/attendance/import-excel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const report = await createAttendanceTemplate();
    return new Response(new Uint8Array(report), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition":
          'attachment; filename="plantilla-registro-medicos.xlsx"',
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Unable to generate doctor registration template", error);
    return Response.json(
      { error: "No fue posible descargar la plantilla. Inténtalo nuevamente." },
      { status: 500 },
    );
  }
}
