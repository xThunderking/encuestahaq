import { FieldValue, type Transaction } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { isAllowedRequestOrigin } from "@/lib/security/request-origin";
import {
  normalizeTicketNumber,
  ticketReservationId,
} from "@/modules/attendance/ticket-number";
import {
  attendanceActionSchema,
  extraDoctorSchema,
} from "@/modules/attendance/schema";
import {
  getAttendanceGuests,
  serializeAttendanceGuest,
} from "@/modules/attendance/get-attendance-guests";

const guestsCollection = () => adminDb.collection("medicalEventGuests");

function ticketReservationReference(normalizedTicketNumber: string) {
  return adminDb
    .collection("medicalEventTicketNumbers")
    .doc(ticketReservationId(normalizedTicketNumber));
}

async function findTicketConflict(
  transaction: Transaction,
  guestId: string,
  ticketNumber: string,
) {
  const normalizedTicketNumber = normalizeTicketNumber(ticketNumber);
  const reservationReference = ticketReservationReference(
    normalizedTicketNumber,
  );
  const reservation = await transaction.get(reservationReference);
  const reservationData = reservation.data();

  // Every ticket write owns this unique reservation in the same transaction.
  // Avoid collection queries here: they add locks across unrelated arrivals.
  if (reservation.exists && reservationData?.guestId !== guestId) {
    return null;
  }

  return {
    normalizedTicketNumber,
    reservationReference,
    reservationAlreadyOwned: reservationData?.guestId === guestId,
  };
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
  if (!isAllowedRequestOrigin(request)) {
    return Response.json({ error: "Origen no permitido." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Solicitud no válida." }, { status: 400 });
  }

  const result = extraDoctorSchema.safeParse(body);
  if (!result.success) {
    return Response.json(
      { error: "Revisa el nombre del médico." },
      { status: 400 },
    );
  }

  try {
    const { requestId, ...guestData } = result.data;
    // A retry after a lost response must resolve to the same extra doctor.
    const reference = requestId
      ? guestsCollection().doc(`extra-${requestId.toLowerCase()}`)
      : guestsCollection().doc();
    const outcome = await adminDb.runTransaction(async (transaction) => {
      if (requestId) {
        const existing = await transaction.get(reference);
        if (existing.exists) {
          const data = existing.data();
          if (
            data?.isExtra !== true ||
            data.doctorName !== guestData.doctorName
          )
            return {
              status: 409,
              error:
                "La solicitud ya se utilizó con otros datos. Revisa el nombre del médico.",
            };
          return { status: 200, id: reference.id };
        }
      }
      transaction.create(reference, {
        ...guestData,
        isExtra: true,
        hasTicket: false,
        ticketNumber: null,
        ticketNumberNormalized: null,
        checkedInAt: FieldValue.serverTimestamp(),
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      return { status: 201, id: reference.id };
    });
    const { status, ...body } = outcome;
    return Response.json(body, { status });
  } catch (error) {
    console.error("Unable to add medical event guest", error);
    return Response.json(
      { error: "No fue posible agregar al invitado." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  if (!isAllowedRequestOrigin(request)) {
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
    const ticketError = result.error.issues.find(
      (issue) => issue.path[0] === "ticketNumber",
    );
    if (ticketError) {
      return Response.json({ error: ticketError.message }, { status: 400 });
    }
    return Response.json({ error: "Registro no válido." }, { status: 400 });
  }

  try {
    const reference = guestsCollection().doc(result.data.id);
    const action = result.data;
    const outcome = await adminDb.runTransaction(async (transaction) => {
      const document = await transaction.get(reference);
      if (!document.exists)
        return { status: 404, error: "Invitado no encontrado." };
      const guest = document.data();
      if (
        action.action === "check-in" ||
        action.action === "check-in-no-ticket"
      ) {
        // Concurrent attempts retry against the latest document and preserve the first ticket.
        if (guest?.checkedInAt)
          return { status: 200, registered: true, alreadyRegistered: true };
        const skippingTicket = action.action === "check-in-no-ticket";
        if (skippingTicket && guest?.hasTicket !== true) {
          return {
            status: 400,
            error: "Este médico no requiere validar un boleto.",
          };
        }
        const ticketNumber =
          guest?.hasTicket === true && action.action === "check-in"
            ? action.ticketNumber?.trim()
            : null;
        if (guest?.hasTicket === true && !skippingTicket && !ticketNumber) {
          return {
            status: 400,
            error: "Ingresa el número de boleto para registrar la asistencia.",
          };
        }

        const reservation =
          guest?.hasTicket === true && ticketNumber
            ? await findTicketConflict(transaction, reference.id, ticketNumber)
            : null;
        if (guest?.hasTicket === true && !skippingTicket && !reservation) {
          return {
            status: 409,
            error: "Ese número de boleto ya está asignado a otro médico.",
          };
        }

        const previousTicketNumber =
          typeof guest?.ticketNumber === "string" ? guest.ticketNumber : null;
        const previousNormalizedTicketNumber =
          typeof guest?.ticketNumberNormalized === "string"
            ? guest.ticketNumberNormalized
            : previousTicketNumber
              ? normalizeTicketNumber(previousTicketNumber)
              : null;
        const previousReservationReference =
          previousNormalizedTicketNumber &&
          previousNormalizedTicketNumber !== reservation?.normalizedTicketNumber
            ? ticketReservationReference(previousNormalizedTicketNumber)
            : null;
        const previousReservation = previousReservationReference
          ? await transaction.get(previousReservationReference)
          : null;

        if (reservation && !reservation.reservationAlreadyOwned) {
          transaction.create(reservation.reservationReference, {
            guestId: reference.id,
            normalizedTicketNumber: reservation.normalizedTicketNumber,
            createdAt: FieldValue.serverTimestamp(),
          });
        }
        if (
          previousReservationReference &&
          previousReservation?.data()?.guestId === reference.id
        ) {
          transaction.delete(previousReservationReference);
        }
        transaction.update(reference, {
          checkedInAt: FieldValue.serverTimestamp(),
          ...(guest?.hasTicket === true
            ? {
                ticketNumber: ticketNumber ?? null,
                ticketNumberNormalized:
                  reservation?.normalizedTicketNumber ?? null,
              }
            : {}),
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
