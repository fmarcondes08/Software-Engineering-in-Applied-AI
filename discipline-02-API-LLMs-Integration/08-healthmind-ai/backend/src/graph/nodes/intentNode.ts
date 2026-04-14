import { z } from 'zod/v3';
import type { LLMService } from '../../services/llmService.ts';
import type { GraphState, Intent } from '../state.ts';

const IntentSchema = z.object({
  intent: z.enum([
    'schedule_appointment',
    'cancel_appointment',
    'symptom_query',
    'document_upload',
    'history_query',
    'emergency',
    'general',
  ]),
  reasoning: z.string(),
});

const buildSystemPrompt = (hasHistory: boolean, appointmentInProgress: boolean) =>
  `You are a healthcare assistant intent classifier.
Classify the user's LATEST message into one of these intents:

- schedule_appointment: user explicitly wants to BOOK a NEW appointment (e.g. "I want to schedule", "book me
                        an appointment", "I need to see a doctor") OR is actively providing scheduling details
                        (date, doctor name, reason) in response to the assistant asking for them
- cancel_appointment: user explicitly wants to CANCEL an existing appointment
- symptom_query: user describes NEW symptoms or asks about a NEW medical condition for the first time
- document_upload: user is uploading or asking about a medical document/lab result/PDF file
- history_query: user is asking about previously uploaded documents, past test results, lab values,
                 prescriptions, or anything from their medical history on file.
                 This includes ANY request to read, explain, summarize, or analyze an uploaded file.
                 Examples: "what did my blood test show?", "show me my results", "what was in my report?",
                 "explain my exam", "explain my file", "what does my document say", "analyze my report",
                 "tell me about my exam", "what are my results", "summarize my file", "read my document".
- emergency: user describes a life-threatening emergency (chest pain, difficulty breathing, severe bleeding, etc.)
- general: greetings, short replies ("yes", "ok", "thanks"), ANY question that ASKS ABOUT an existing
           appointment ("when is my appointment?", "when will be my next appointment?", "do I have an
           appointment?", "what time is my consultation?") — these are LOOKUPS, not booking requests,
           or anything purely conversational

${hasHistory
  ? `IMPORTANT — ongoing conversation rules:
  ${appointmentInProgress
    ? `• An appointment scheduling is CURRENTLY IN PROGRESS (not yet confirmed).
       If the user is providing ANY scheduling detail — a date, a doctor's name, a specialty, a reason — classify as "schedule_appointment".
       Short answers like "April 20", "Dr. Carlos", "routine checkup" are providing scheduling details → "schedule_appointment".`
    : `• If the appointment was ALREADY CONFIRMED and the user is asking "when is my appointment?", "what did I schedule?" → use "general".`}
  • Only use "schedule_appointment" when the user is starting OR continuing appointment scheduling
  • Only use "cancel_appointment" when the user is explicitly asking to cancel
  • If the user asks about test results, lab values, uploaded files, or their medical history → always use "history_query"
  • Words like "exam", "file", "document", "report", "results" + verbs like "explain", "show", "tell me", "read", "analyze", "summarize" → always "history_query"
  • Only use "general" for pure conversational replies or questions about an already-confirmed appointment`
  : ''}

Always respond with a JSON object.`;

export function createIntentNode(llm: LLMService) {
  return async (state: GraphState): Promise<Partial<GraphState>> => {
    const lastMessage = state.messages.at(-1);
    const userInput = lastMessage?.text ?? String((lastMessage as any)?.content ?? '');

    // Count prior turns (human + AI messages before this one)
    const priorTurns = state.messages.length - 1;
    const hasHistory = priorTurns > 0;

    // Detect if appointment scheduling is currently in-progress:
    // The AI asked for details but the appointment is not confirmed yet.
    // We check if any appointment field was collected but no confirmed message in recent AI turns.
    const recentAiMessages = state.messages
      .slice(-6)
      .filter((m: any) => (m._getType?.() ?? m.role) === 'ai')
      .map((m: any) => (typeof m.content === 'string' ? m.content : m.text ?? '').toLowerCase());

    const appointmentInProgress =
      !!(state.appointmentDoctor || state.appointmentDate) === false
        ? recentAiMessages.some(
            (msg) =>
              (msg.includes('date') || msg.includes('doctor') || msg.includes('specialty') || msg.includes('reason')) &&
              (msg.includes('appointment') || msg.includes('schedule') || msg.includes('consultation')),
          )
        : false;

    // Simpler check: if the last AI message asked for appointment details
    const lastAiMsg = recentAiMessages.at(-1) ?? '';
    const isAskingForAppointmentDetails =
      (lastAiMsg.includes('date') || lastAiMsg.includes('doctor') || lastAiMsg.includes('specialty') || lastAiMsg.includes('time')) &&
      (lastAiMsg.includes('appointment') || lastAiMsg.includes('schedule') || lastAiMsg.includes('consultation'));

    // Build conversation snippet for context (last 6 messages before current)
    const recentHistory = state.messages
      .slice(-7, -1)
      .map((m: any) => {
        const role = (m._getType?.() ?? m.role) === 'ai' ? 'Assistant' : 'Patient';
        const content = typeof m.content === 'string' ? m.content : m.text ?? '';
        return `${role}: ${content}`;
      })
      .join('\n');

    console.log('🧠 Classifying intent...');

    const contextPrompt = hasHistory
      ? `Conversation so far:\n${recentHistory}\n\nLatest message: "${userInput}"`
      : `User message: "${userInput}"`;

    const { data, error } = await llm.generateStructured(
      buildSystemPrompt(hasHistory, isAskingForAppointmentDetails),
      contextPrompt,
      IntentSchema,
    );

    if (error || !data) {
      console.error('Intent classification failed:', error);
      // If last AI message was asking for appointment details, keep the flow going
      return { intent: isAskingForAppointmentDetails ? 'schedule_appointment' : 'general' };
    }

    console.log(`✅ Intent: ${data.intent} — ${data.reasoning}`);
    return { intent: data.intent as Intent };
  };
}
