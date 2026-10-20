import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import {
  attendanceActionSchema,
  attendanceGuestSchema,
} from "@/modules/attendance/schema";
import {
  getAttendanceGuests,
  serializeAttendanceGuest,
} from "@/modules/attendance/get-attendance-guests";

function validateOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}

export async function GET() {
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
    const action = result.data;
    const outcome = await adminDb.runTransaction(async (transaction) => {
      const document = await transaction.get(reference);
      if (!document.exists)
        return { status: 404, error: "Invitado no encontrado." };
      const guest = document.data();
      if (action.action === "check-in") {
        // Concurrent attempts retry against the latest document and preserve the first ticket.
        if (guest?.checkedInAt)
          return { status: 200, registered: true, alreadyRegistered: true };
        const ticketNumber =
          guest?.hasTicket === true ? action.ticketNumber?.trim() : null;
        if (guest?.hasTicket === true && !ticketNumber) {
          return {
            status: 400,
            error: "Ingresa el número de boleto para registrar la asistencia.",
          };
        }
        transaction.update(reference, {
          checkedInAt: FieldValue.serverTimestamp(),
          ...(guest?.hasTicket === true ? { ticketNumber } : {}),
          updatedAt: FieldValue.serverTimestamp(),
        });
        return { status: 200, registered: true, alreadyRegistered: false };
      }
      if (guest?.checkedInAt) {
        if (
          serializeAttendanceGuest(document).checkedInAt !==
          action.expectedCheckedInAt
        ) {
          return {
            status: 409,
            error:
              "El registro cambió en otro equipo. Cierra esta ventana y revisa la asistencia antes de deshacerla.",
          };
        }
        transaction.update(reference, {
          checkedInAt: null,
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
      return { status: 200, registered: false };
    });
    const { status, ...body } = outcome;
    return Response.json(body, { status });
  } catch (error) {
    console.error("Unable to update medical event attendance", error);
    return Response.json(
      { error: "No fue posible actualizar el registro." },
      { status: 500 },
    );
  }
}
