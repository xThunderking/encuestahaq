import { z } from "zod";
import { normalizeTicketNumber } from "@/modules/attendance/ticket-number";
import {
  TICKET_NUMBER_FORMAT,
  TICKET_NUMBER_FORMAT_MESSAGE,
} from "@/modules/attendance/ticket-number-format";

export const attendanceGuestSchema = z
  .object({
    doctorName: z.string().trim().min(2).max(120),
    hasTicket: z.boolean(),
    ticketNumber: z.string().trim().max(40).optional(),
  })
  .transform((guest) => ({
    ...guest,
    ticketNumber: guest.hasTicket ? guest.ticketNumber?.trim() || null : null,
    ticketNumberNormalized:
      guest.hasTicket && guest.ticketNumber?.trim()
        ? normalizeTicketNumber(guest.ticketNumber)
        : null,
  }));

export const extraDoctorSchema = z.object({
  doctorName: z.string().trim().min(2).max(120),
  requestId: z.uuid().optional(),
});

const guestIdSchema = z
  .string()
  .min(1)
  .max(150)
  .regex(/^[^/\u0000-\u001f]+$/)
  .refine((id) => id !== "." && id !== "..");

export const attendanceActionSchema = z.discriminatedUnion("action", [
  z.object({
    id: guestIdSchema,
    action: z.literal("check-in"),
    ticketNumber: z
      .string()
      .regex(TICKET_NUMBER_FORMAT, { error: TICKET_NUMBER_FORMAT_MESSAGE })
      .optional(),
  }),
  z.object({
    id: guestIdSchema,
    action: z.literal("check-in-no-ticket"),
  }),
  z.object({
    id: guestIdSchema,
    action: z.literal("undo"),
    expectedCheckedInAt: z.iso.datetime(),
  }),
]);

export type AttendanceGuestInput = z.infer<typeof attendanceGuestSchema>;
