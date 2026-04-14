import { z } from 'zod/v3';
import type { LLMService } from '../../services/llmService.ts';
import type { Neo4jService } from '../../services/neo4jService.ts';
import type { GraphState } from '../state.ts';

const CorrectedQuerySchema = z.object({
  query: z.string(),
  explanation: z.string(),
});

const getSystemPrompt = (schema: string) => `You are a Cypher query correction expert.
Fix the invalid Cypher query based on the error message and graph schema.

Graph schema:
${schema}

Return only the corrected query as JSON.`;

export function createCypherCorrectionNode(llm: LLMService, neo4j: Neo4jService) {
  return async (state: GraphState): Promise<Partial<GraphState>> => {
    console.log(`🔧 Correcting Cypher query (attempt ${(state.correctionAttempts ?? 0) + 1})...`);

    const schema = await neo4j.getSchema();
    const { data, error } = await llm.generateStructured(
      getSystemPrompt(schema),
      `Original query: ${state.cypherQuery}\nError: ${state.validationError}\nFix this query.`,
      CorrectedQuerySchema,
    );

    if (error || !data) {
      return { error: `Correction failed: ${error}` };
    }

    console.log(`✅ Corrected query: ${data.query}`);
    return {
      cypherQuery: data.query,
      correctionAttempts: (state.correctionAttempts ?? 0) + 1,
      needsCorrection: false,
      validationError: undefined,
    };
  };
}
