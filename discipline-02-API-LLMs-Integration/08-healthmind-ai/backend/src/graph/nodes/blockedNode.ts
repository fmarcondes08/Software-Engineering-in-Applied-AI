import type { GraphState } from '../state.ts';
import { AIMessage } from '@langchain/core/messages';

export async function blockedNode(state: GraphState): Promise<Partial<GraphState>> {
  const reason = state.guardrailCheck?.reason ?? 'Security policy violation detected';
  const answer = `⚠️ Your request was blocked by our security system.\n\nReason: ${reason}\n\nIf you believe this is a mistake, please rephrase your question.`;

  return {
    immediateAnswer: answer,
    messages: [new AIMessage(answer)],
  };
}
