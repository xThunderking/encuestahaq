import { z } from "zod";
import { normalizeTicketNumber } from "@/modules/attendance/ticket-number";

export const attendanceGuestSchema = z
  .object({
    doctorName: z.string().trim().min(2).max(120),
    hospital: z.enum(["HAQ", "HACS"]),
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

export const attendanceActionSchema = z.discriminatedUnion("action", [
  z.object({
    id: z.string().min(1).max(150),
    action: z.literal("check-in"),
    ticketNumber: z.string().trim().min(1).max(40).optional(),
  }),
  z.object({
    id: z.string().min(1).max(150),
    action: z.literal("undo"),
    expectedCheckedInAt: z.iso.datetime(),
  }),
]);

export type AttendanceGuestInput = z.infer<typeof attendanceGuestSchema>;
