import { z } from 'zod/v3';
import type { LLMService } from '../../services/llmService.ts';
import type { GraphState } from '../state.ts';

const AppointmentSchema = z.object({
  action: z.enum(['schedule', 'cancel']),
  doctor: z.string().optional(),
  date: z.string().optional(),
  reason: z.string().optional(),
  confirmed: z.boolean(),
  message: z.string(),
});

const SYSTEM_PROMPT = `You are a medical appointment assistant managing a MULTI-TURN scheduling conversation.

Your job is to ACCUMULATE appointment details across the full conversation history.
Look at EVERY message in the conversation — details may have been provided in earlier turns.

Rules:
- NEVER ask for a detail that was already mentioned in any prior message
- Collect: doctor name or specialty, preferred date/time, and reason for the visit
- Reason is OPTIONAL — default to "general checkup" if not mentioned
- Once you have BOTH a doctor (or specialty) AND a date → set confirmed=true
- If either doctor or date is still missing → set confirmed=false and ask ONLY for what is missing
- Be friendly and concise

⛔ CRITICAL ANTI-HALLUCINATION RULES (violating these causes serious harm):
- ONLY use doctor names, dates, and times that the USER explicitly mentioned in this conversation
- NEVER invent or assume ANY value — not "Dr. Smith", not "Wednesday", not any date or time
- If the user has NOT provided a doctor AND a date in this conversation, set confirmed=false
- If the user seems to be ASKING about an existing appointment rather than booking one, set confirmed=false
  and set message to: "I don't see a booking request here. To schedule an appointment, please tell me the
  doctor or specialty you need and your preferred date."

Respond with valid JSON only.`;

export function createAppointmentNode(llm: LLMService) {
  return async (state: GraphState): Promise<Partial<GraphState>> => {
    const action = state.intent === 'cancel_appointment' ? 'cancel' : 'schedule';

    // Build a full conversation transcript so the LLM can see everything said so far
    const historyText = state.messages
      .map((m: any) => {
        const type = m._getType?.() ?? (m.role === 'ai' ? 'ai' : 'human');
        const role = type === 'ai' ? 'Assistant' : 'Patient';
        const content = typeof m.content === 'string' ? m.content : (m.text ?? '');
        return `${role}: ${content}`;
      })
      .join('\n');

    // Also surface any fields already stored in state (from previous turns)
    const alreadyKnown: string[] = [];
    if (state.appointmentDoctor) alreadyKnown.push(`Doctor/Specialty already collected: "${state.appointmentDoctor}"`);
    if (state.appointmentDate)   alreadyKnown.push(`Date already collected: "${state.appointmentDate}"`);
    if (state.appointmentReason) alreadyKnown.push(`Reason already collected: "${state.appointmentReason}"`);

    const userPrompt =
      `Patient: ${state.user.name} (${state.user.role})
Action requested: ${action}
${alreadyKnown.length ? `\nPreviously collected fields:\n${alreadyKnown.join('\n')}\n` : ''}
Full conversation so far:
${historyText}

Using the entire conversation above, extract all appointment details and decide if you have enough to confirm.`;

    console.log(`📅 Processing ${action} appointment (${state.messages.length} turn(s) of context)...`);

    const { data, error } = await llm.generateStructured(
      SYSTEM_PROMPT,
      userPrompt,
      AppointmentSchema,
    );

    if (error || !data) {
      console.error('Appointment node error:', error);
      return {
        immediateAnswer: 'I had trouble processing your appointment request. Please try again.',
        error,
      };
    }

    console.log(`📅 Appointment result: confirmed=${data.confirmed}, doctor=${data.doctor}, date=${data.date}`);

    return {
      appointmentAction: data.action,
      // Only overwrite fields when the LLM actually extracted a value
      ...(data.doctor   && { appointmentDoctor: data.doctor }),
      ...(data.date     && { appointmentDate:   data.date }),
      ...(data.reason   && { appointmentReason: data.reason }),
      appointmentConfirmed: data.confirmed,
      immediateAnswer: data.message,
    };
  };
}
