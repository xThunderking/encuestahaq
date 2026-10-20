import { FieldValue, type Transaction } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import {
  normalizeTicketNumber,
  ticketReservationId,
} from "@/modules/attendance/ticket-number";
import {
  attendanceActionSchema,
  attendanceGuestSchema,
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
  const ticketQuery = guestsCollection();
  const normalizedMatches = await transaction.get(
    ticketQuery.where("ticketNumberNormalized", "==", normalizedTicketNumber),
  );
  const enteredNumberMatches = await transaction.get(
    ticketQuery.where("ticketNumber", "==", ticketNumber.trim()),
  );
  const normalizedLegacyMatches =
    normalizedTicketNumber === ticketNumber.trim()
      ? null
      : await transaction.get(
          ticketQuery.where("ticketNumber", "==", normalizedTicketNumber),
        );

  const hasOtherGuest = [
    ...normalizedMatches.docs,
    ...enteredNumberMatches.docs,
    ...(normalizedLegacyMatches?.docs ?? []),
  ].some((document) => document.id !== guestId);
  const reservationData = reservation.data();

  if (
    hasOtherGuest ||
    (reservation.exists && reservationData?.guestId !== guestId)
  ) {
    return null;
  }

  return {
    normalizedTicketNumber,
    reservationReference,
    reservationAlreadyOwned: reservationData?.guestId === guestId,
  };
}

function validateOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;

  try {
    const parsedOrigin = new URL(origin);
    if (
      !["http:", "https:"].includes(parsedOrigin.protocol) ||
      parsedOrigin.origin !== origin
    ) {
      return false;
    }

    // The browser knows the public origin even when hosting rewrites the URL.
    // Sec-* headers cannot be supplied by browser JavaScript.
    const fetchSite = request.headers.get("sec-fetch-site");
    if (fetchSite === "same-origin") return true;
    if (fetchSite === "cross-site" || fetchSite === "same-site") return false;

    const requestUrl = new URL(request.url);
    if (origin === requestUrl.origin) return true;

    // Support clients without Fetch Metadata using the reverse proxy's headers.
    const host =
      request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ||
      request.headers.get("host");
    const protocol =
      request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ||
      requestUrl.protocol.slice(0, -1);
    if (!host || !["http", "https"].includes(protocol)) return false;

    const publicUrl = new URL(`${protocol}://${host}`);
    return (
      publicUrl.origin === origin &&
      publicUrl.pathname === "/" &&
      !publicUrl.search &&
      !publicUrl.hash &&
      !publicUrl.username &&
      !publicUrl.password
    );
  } catch {
    return false;
  }
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
    const reference = guestsCollection().doc();
    const outcome = await adminDb.runTransaction(async (transaction) => {
      let reservation: Awaited<ReturnType<typeof findTicketConflict>> = null;
      if (result.data.ticketNumber) {
        reservation = await findTicketConflict(
          transaction,
          reference.id,
          result.data.ticketNumber,
        );
        if (!reservation) {
          return {
            status: 409,
            error: "Ese número de boleto ya está asignado a otro médico.",
          };
        }
      }

      if (reservation && !reservation.reservationAlreadyOwned) {
        transaction.create(reservation.reservationReference, {
          guestId: reference.id,
          normalizedTicketNumber: reservation.normalizedTicketNumber,
          createdAt: FieldValue.serverTimestamp(),
        });
      }
      transaction.create(reference, {
        ...result.data,
        checkedInAt: null,
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
    const reference = guestsCollection().doc(result.data.id);
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

        const reservation =
          guest?.hasTicket === true
            ? await findTicketConflict(transaction, reference.id, ticketNumber!)
            : null;
        if (guest?.hasTicket === true && !reservation) {
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
                ticketNumber,
                ticketNumberNormalized: reservation!.normalizedTicketNumber,
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
