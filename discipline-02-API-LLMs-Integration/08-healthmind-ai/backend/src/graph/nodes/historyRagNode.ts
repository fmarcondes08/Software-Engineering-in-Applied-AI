import { searchDocuments } from '../../services/documentService.ts';
import type { GraphState } from '../state.ts';

export function createHistoryRagNode() {
  return async (state: GraphState): Promise<Partial<GraphState>> => {
    const lastMessage = state.messages.at(-1);
    const query =
      (typeof (lastMessage as any)?.content === 'string'
        ? (lastMessage as any).content
        : lastMessage?.text) ?? '';

    console.log(`📚 Searching patient history for: "${query}"`);

    // Use a broad query too so we always surface recently uploaded docs
    const results = await searchDocuments(state.user.id, query || 'medical test results', 5);

    if (results.length > 0) {
      console.log(`✅ Found ${results.length} document(s): ${results.map((r) => r.filename).join(', ')}`);
    } else {
      console.log(`ℹ️  No documents on file for patient ${state.user.id}`);
    }

    return { historyResults: results };
  };
}
