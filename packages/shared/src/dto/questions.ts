import { z } from 'zod';

export const questionSchema = z.object({
  id: z.string().uuid(),
  mapId: z.string().uuid(),
  title: z.string(),
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
});
export type Question = z.infer<typeof questionSchema>;

export const createQuestionRequestSchema = z.object({
  title: z.string().min(1).max(500),
});
export type CreateQuestionRequest = z.infer<typeof createQuestionRequestSchema>;

export const updateQuestionRequestSchema = z.object({
  title: z.string().min(1).max(500),
});
export type UpdateQuestionRequest = z.infer<typeof updateQuestionRequestSchema>;
