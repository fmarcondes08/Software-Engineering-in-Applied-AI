import { z } from 'zod/v3';
import { withLangGraph } from '@langchain/langgraph/zod';
import { MessagesZodMeta } from '@langchain/langgraph';
import type { BaseMessage } from '@langchain/core/messages';
import type { GuardrailResult } from '../services/llmService.ts';
import type { UserRole } from '../config.ts';

export const UserSchema = z.object({
  id: z.string(),
  name: z.string(),
  role: z.enum(['patient', 'doctor', 'admin'] as [UserRole, ...UserRole[]]),
});

export type Intent =
  | 'schedule_appointment'
  | 'cancel_appointment'
  | 'symptom_query'
  | 'document_upload'
  | 'history_query'
  | 'emergency'
  | 'general';

export const HealthMindStateAnnotation = z.object({
  // Core conversation
  messages: withLangGraph(z.custom<BaseMessage[]>(), MessagesZodMeta),

  // User context
  user: UserSchema,
  guardrailsEnabled: z.boolean().default(true),

  // Security layer
  guardrailCheck: z.custom<GuardrailResult | null>().nullable().default(null),

  // Intent classification
  intent: z.string().optional(), // Intent type

  // Appointment flow
  appointmentAction: z.enum(['schedule', 'cancel']).optional(),
  appointmentDoctor: z.string().optional(),
  appointmentDate: z.string().optional(),
  appointmentReason: z.string().optional(),
  appointmentConfirmed: z.boolean().optional(),

  // Document flow
  documentBase64: z.string().optional(),
  documentFilename: z.string().optional(),
  documentText: z.string().optional(), // extracted text for storage
  documentStored: z.boolean().optional(),

  // Symptom checker / Neo4j flow
  symptomQuery: z.string().optional(),
  cypherQuery: z.string().optional(),
  cypherResults: z.array(z.any()).optional(),
  correctionAttempts: z.number().optional(),
  needsCorrection: z.boolean().optional(),
  validationError: z.string().optional(),

  // History RAG flow
  historyResults: z.array(z.any()).optional(),

  // Emergency
  isEmergency: z.boolean().optional(),

  // immediateAnswer: set within the current turn by appointment/emergency/blocked nodes.
  // responseNode reads this instead of `answer` to avoid picking up persisted values from past turns.
  immediateAnswer: z.string().optional(),

  // Final response (persisted — used by SSE accumulator to send done event)
  answer: z.string().optional(),
  error: z.string().optional(),
});

export type GraphState = z.infer<typeof HealthMindStateAnnotation>;
