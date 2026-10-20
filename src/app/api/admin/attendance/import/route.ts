import { isAllowedRequestOrigin } from "@/lib/security/request-origin";
import { importAttendanceGuests } from "@/modules/attendance/import-attendance-guests";
import { MAX_IMPORT_FILE_BYTES } from "@/modules/attendance/import-contract";
import { parseAttendanceImport } from "@/modules/attendance/import-excel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  if (!isAllowedRequestOrigin(request)) {
    return Response.json({ error: "Origen no permitido." }, { status: 403 });
  }
  const length = Number(request.headers.get("content-length"));
  if (length > MAX_IMPORT_FILE_BYTES + 64 * 1024) {
    return Response.json(
      { error: "El archivo debe pesar como máximo 2 MB." },
      { status: 413 },
    );
  }
  let file: FormDataEntryValue | null;
  try {
    file = (await request.formData()).get("file");
  } catch {
    return Response.json(
      { error: "Selecciona la plantilla de Excel para subirla." },
      { status: 400 },
    );
  }
  if (!(file instanceof File) || !file.size || !/\.xlsx$/i.test(file.name)) {
    return Response.json(
      { error: "Selecciona un archivo Excel .xlsx con datos de médicos." },
      { status: 400 },
    );
  }
  if (file.size > MAX_IMPORT_FILE_BYTES) {
    return Response.json(
      { error: "El archivo debe pesar como máximo 2 MB." },
      { status: 413 },
    );
  }
  let parsed: Awaited<ReturnType<typeof parseAttendanceImport>>;
  try {
    parsed = await parseAttendanceImport(await file.arrayBuffer());
  } catch (error) {
    console.error("Unable to read medical event import workbook", error);
    return Response.json(
      {
        error:
          "No pudimos abrir este archivo de Excel. Ábrelo en Excel y guárdalo como Libro de Excel (*.xlsx), o descarga una plantilla nueva y copia ahí los datos.",
      },
      { status: 400 },
    );
  }
  if (parsed.errorCount) {
    return Response.json(
      {
        error:
          "No se guardó ningún médico. Corrige las filas indicadas y vuelve a subir el archivo.",
        issues: parsed.issues,
        errorCount: parsed.errorCount,
      },
      { status: 400 },
    );
  }
  try {
    const result = await importAttendanceGuests(parsed.records);
    return Response.json(result, {
      status: result.imported ? 201 : 200,
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    console.error("Unable to import medical event guests", error);
    return Response.json(
      {
        error:
          "No fue posible agregar los médicos. Intenta subir el mismo archivo nuevamente; los registros ya existentes se conservarán.",
      },
      { status: 500 },
    );
  }
}
