import { createHash } from "node:crypto";

export function normalizeTicketNumber(ticketNumber: string) {
  return ticketNumber.trim().normalize("NFKC").toUpperCase();
}

export function ticketReservationId(normalizedTicketNumber: string) {
  return createHash("sha256").update(normalizedTicketNumber).digest("hex");
}
