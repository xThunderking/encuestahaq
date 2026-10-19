import { cookies } from "next/headers";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import {
  ADMIN_SESSION_COOKIE,
  verifyAdminSessionToken,
} from "@/lib/security/admin-session";
import {
  attendanceActionSchema,
  attendanceGuestSchema,
} from "@/modules/attendance/schema";
import { getAttendanceGuests } from "@/modules/attendance/get-attendance-guests";

async function isAuthenticated() {
  const token = (await cookies()).get(ADMIN_SESSION_COOKIE)?.value;
  return verifyAdminSessionToken(token);
}

function validateOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}

export async function GET() {
  if (!(await isAuthenticated())) {
    return Response.json({ error: "No autorizado." }, { status: 401 });
  }

  try {
    const guests = await getAttendanceGuests();
    return Response.json(guests, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    console.error("Unable to load medical event guests", error);
    return Response.json(
      { error: "No fue posible cargar la lista de invitados." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  if (!(await isAuthenticated())) {
    return Response.json({ error: "No autorizado." }, { status: 401 });
  }
  if (!validateOrigin(request)) {
    return Response.json({ error: "Origen no permitido." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Solicitud no válida." }, { status: 400 });
  }

  const result = attendanceGuestSchema.safeParse(body);
  if (!result.success) {
    return Response.json(
      { error: "Revisa el nombre, hospital y datos del boleto." },
      { status: 400 },
    );
  }

  try {
    const reference = await adminDb.collection("medicalEventGuests").add({
      ...result.data,
      checkedInAt: null,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return Response.json({ id: reference.id }, { status: 201 });
  } catch (error) {
    console.error("Unable to add medical event guest", error);
    return Response.json(
      { error: "No fue posible agregar al invitado." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  if (!(await isAuthenticated())) {
    return Response.json({ error: "No autorizado." }, { status: 401 });
  }
  if (!validateOrigin(request)) {
    return Response.json({ error: "Origen no permitido." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Solicitud no válida." }, { status: 400 });
  }

  const result = attendanceActionSchema.safeParse(body);
  if (!result.success) {
    return Response.json({ error: "Registro no válido." }, { status: 400 });
  }

  try {
    const reference = adminDb
      .collection("medicalEventGuests")
      .doc(result.data.id);
    const document = await reference.get();
    if (!document.exists) {
      return Response.json({ error: "Invitado no encontrado." }, { status: 404 });
    }

    await reference.update({
      checkedInAt:
        result.data.action === "check-in" ? FieldValue.serverTimestamp() : null,
      updatedAt: FieldValue.serverTimestamp(),
    });
    return Response.json({ registered: result.data.action === "check-in" });
  } catch (error) {
    console.error("Unable to update medical event attendance", error);
    return Response.json(
      { error: "No fue posible actualizar el registro." },
      { status: 500 },
    );
  }
}
