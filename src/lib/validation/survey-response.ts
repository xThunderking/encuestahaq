import { z } from "zod";

const answerValueSchema = z.union([
  z.string().max(5000),
  z.number().finite(),
  z.boolean(),
  z.null(),
]);
const contactConsentKey = "servicios_externos_diagnostico_pregunta_32";
const contactNameKey = "servicios_externos_diagnostico_pregunta_29";
const contactEmailKey = "servicios_externos_diagnostico_pregunta_30";
const contactPhoneKey = "servicios_externos_diagnostico_pregunta_31";
const namePattern =
  /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ'’.-]+(?:\s+[A-Za-zÁÉÍÓÚÜÑáéíóúüñ'’.-]+)*$/;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const surveyResponseSchema = z.object({
  submissionId: z.uuid(),
  surveyCode: z.literal("servicios_externos_diagnostico"),
  locale: z.enum(["es", "en"]),
  answers: z
    .record(z.string().min(1).max(150), answerValueSchema)
    .refine((answers) => Object.keys(answers).length <= 50)
    .superRefine((answers, context) => {
      if (String(answers[contactConsentKey]) !== "1") return;

      const name = answers[contactNameKey];
      const email = answers[contactEmailKey];
      const phone = answers[contactPhoneKey];
      if (typeof name !== "string" || !namePattern.test(name.trim())) {
        context.addIssue({ code: "custom", message: "Nombre no válido." });
      }
      if (typeof email !== "string" || !emailPattern.test(email.trim())) {
        context.addIssue({ code: "custom", message: "Correo no válido." });
      }
      if (typeof phone !== "string" || !/^\d{7,15}$/.test(phone)) {
        context.addIssue({ code: "custom", message: "Teléfono no válido." });
      }
    }),
});

export type SurveyResponseInput = z.infer<typeof surveyResponseSchema>;
