import { z } from 'zod';

// AI layer — extension C5 (ADR-012). Request schema for POST /api/v1/ask. The
// question is the only required field; it is trimmed and length-bounded so a single
// request can neither be empty nor balloon the prompt. `language` is an optional
// short hint forwarded to the chat service (which defaults to 'fr').

const MAX_QUESTION_LENGTH = 500;

export const askRequestSchema = z.object({
  question: z.string().trim().min(1, 'question must not be empty').max(MAX_QUESTION_LENGTH),
  language: z.string().trim().min(2).max(8).optional(),
});

export type AskRequest = z.infer<typeof askRequestSchema>;
