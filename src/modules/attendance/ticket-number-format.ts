export const TICKET_NUMBER_FORMAT = /^(?!000)[0-9]{3}$/;

export const TICKET_NUMBER_FORMAT_MESSAGE =
  "El número de boleto debe tener 3 dígitos, del 001 al 999.";

export function isValidTicketNumber(ticketNumber: string) {
  return TICKET_NUMBER_FORMAT.test(ticketNumber);
}
