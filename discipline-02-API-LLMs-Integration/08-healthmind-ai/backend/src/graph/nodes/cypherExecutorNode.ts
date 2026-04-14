import type { Neo4jService } from '../../services/neo4jService.ts';
import type { GraphState } from '../state.ts';

export function createCypherExecutorNode(neo4j: Neo4jService) {
  return async (state: GraphState): Promise<Partial<GraphState>> => {
    if (!state.cypherQuery) {
      return { needsCorrection: false, cypherResults: [] };
    }

    console.log('⚙️  Executing Cypher query...');

    const { valid, error } = await neo4j.validateQuery(state.cypherQuery);

    if (!valid) {
      console.warn(`⚠️  Invalid query: ${error}`);
      return {
        needsCorrection: true,
        validationError: error,
        correctionAttempts: (state.correctionAttempts ?? 0),
      };
    }

    try {
      const results = await neo4j.query(state.cypherQuery);
      console.log(`✅ Query returned ${results.length} results`);
      return {
        cypherResults: results,
        needsCorrection: false,
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return {
        needsCorrection: true,
        validationError: errorMsg,
        correctionAttempts: (state.correctionAttempts ?? 0),
      };
    }
  };
}
