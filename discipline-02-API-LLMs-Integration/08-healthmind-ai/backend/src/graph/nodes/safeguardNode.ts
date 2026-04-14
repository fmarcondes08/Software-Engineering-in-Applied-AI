import type { LLMService } from '../../services/llmService.ts';
import type { GraphState } from '../state.ts';

export function createSafeguardNode(llm: LLMService) {
  return async (state: GraphState): Promise<Partial<GraphState>> => {
    const lastMessage = state.messages.at(-1);
    const userInput = lastMessage?.text ?? String((lastMessage as any)?.content ?? '');

    const result = await llm.checkGuardrails(userInput, state.guardrailsEnabled);

    console.log(`🛡️  Guardrail check: ${result.safe ? 'SAFE' : 'BLOCKED'} — ${result.reason}`);

    return { guardrailCheck: result };
  };
}
