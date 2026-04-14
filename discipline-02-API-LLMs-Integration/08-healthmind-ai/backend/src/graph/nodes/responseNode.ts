import { SystemMessage, AIMessage } from '@langchain/core/messages';
import type { LLMService } from '../../services/llmService.ts';
import type { GraphState } from '../state.ts';

const buildSystemPrompt = (role: string, context: string) =>
  `You are HealthMind AI, an intelligent healthcare assistant built into a real healthcare platform.

You are speaking with a ${role}.

Guidelines:
- Be empathetic, clear, and medically accurate
- Use the full conversation history to build on previous turns — never repeat the same response
- Always remind users you are an AI and recommend consulting a real doctor for final diagnoses
- For doctors/admins, you can be more technical
- Keep responses focused and actionable
- If emergency, always redirect to emergency services first

CRITICAL — data integrity rules (violations cause patient harm):
- ⛔ NEVER invent, fabricate, or guess appointment dates, doctor names, test results, or any medical data
- ⛔ NEVER say "your appointment is on [date]" unless that exact date appears in the context section below
- ⛔ NEVER say "your result shows [value]" unless that value appears in the context section below
- ✅ ONLY report facts that are explicitly present in the "Relevant context" section or in the conversation history
- If asked about appointments and NONE appear in context → say: "I don't see any scheduled appointments for you in this session. You can schedule one by typing 'I'd like to book an appointment'."
- If asked about documents/exams and NONE appear in context → say: "I don't see any uploaded documents yet. Use the 📎 button to attach a PDF and I'll analyse it for you."
${context ? `\n--- Relevant context (ONLY these facts are real — do not add anything else) ---\n${context}\n--- End context ---` : '\n[No appointment, document, or medical data is available for this session]'}`;

export function createResponseNode(llm: LLMService) {
  return async (state: GraphState): Promise<Partial<GraphState>> => {
    // If an immediate answer was set this turn (appointment/emergency/blocked), use it directly
    if (state.immediateAnswer) {
      return {
        answer: state.immediateAnswer,
        messages: [new AIMessage(state.immediateAnswer)],
      };
    }

    // Build context from all available sources
    const contextParts: string[] = [];

    // ── Confirmed appointment on file ──
    if (state.appointmentDoctor || state.appointmentDate) {
      const status = state.appointmentConfirmed ? '✅ Confirmed' : '⏳ Pending confirmation';
      contextParts.push(
        `Appointment on file (${status}):\n` +
        `  Doctor/Specialty : ${state.appointmentDoctor ?? 'not specified'}\n` +
        `  Date             : ${state.appointmentDate ?? 'not specified'}\n` +
        `  Reason           : ${state.appointmentReason ?? 'general checkup'}`,
      );
    }

    // ── Neo4j medical knowledge ──
    if (state.cypherResults?.length) {
      contextParts.push(
        `Medical knowledge from database:\n${JSON.stringify(state.cypherResults, null, 2)}`,
      );
    }

    // ── Uploaded documents retrieved by RAG ──
    if (state.historyResults?.length) {
      const historyText = state.historyResults
        .map((r: any) => `[${r.filename}]\n${r.content}`)
        .join('\n---\n');
      contextParts.push(`Patient's uploaded medical history:\n${historyText}`);
    }

    // ── Document just uploaded this turn ──
    if (state.documentStored && state.documentText) {
      contextParts.push(`Just-uploaded document summary:\n${state.documentText}`);
    }

    const context = contextParts.join('\n\n');

    console.log('💬 Generating response with full conversation history...');

    // Pass the full message history so the LLM can see all previous turns
    const response = await llm.getMainModel().invoke([
      new SystemMessage(buildSystemPrompt(state.user.role, context)),
      ...state.messages,
    ]);

    const answer =
      typeof response.content === 'string'
        ? response.content
        : (response as any).text ?? '';

    return {
      answer,
      messages: [new AIMessage(answer)],
    };
  };
}
