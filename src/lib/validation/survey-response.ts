import { z } from "zod";

const answerValueSchema = z.union([
  z.string().max(5000),
  z.number().finite(),
  z.boolean(),
  z.null(),
]);

export const surveyResponseSchema = z.object({
  submissionId: z.uuid(),
  surveyCode: z.literal("servicios_externos_diagnostico"),
  locale: z.enum(["es", "en"]),
  answers: z
    .record(z.string().min(1).max(150), answerValueSchema)
    .refine((answers) => Object.keys(answers).length <= 50),
});

export type SurveyResponseInput = z.infer<typeof surveyResponseSchema>;
