import { z } from "zod";

export const attendanceGuestSchema = z
  .object({
    doctorName: z.string().trim().min(2).max(120),
    hospital: z.string().trim().min(2).max(120),
    hasTicket: z.boolean(),
    ticketNumber: z.string().trim().max(40).optional(),
  })
  .superRefine((guest, context) => {
    if (guest.hasTicket && !guest.ticketNumber) {
      context.addIssue({
        code: "custom",
        path: ["ticketNumber"],
        message: "Captura el número de boleto.",
      });
    }
  })
  .transform((guest) => ({
    ...guest,
    ticketNumber: guest.hasTicket ? guest.ticketNumber?.trim() || null : null,
  }));

export const attendanceActionSchema = z.object({
  id: z.string().min(1).max(150),
  action: z.enum(["check-in", "undo"]),
});

export type AttendanceGuestInput = z.infer<typeof attendanceGuestSchema>;
