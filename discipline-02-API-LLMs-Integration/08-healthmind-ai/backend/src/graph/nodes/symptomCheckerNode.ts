import { z } from 'zod/v3';
import type { LLMService } from '../../services/llmService.ts';
import type { Neo4jService } from '../../services/neo4jService.ts';
import type { GraphState } from '../state.ts';

const CypherQuerySchema = z.object({
  query: z.string(),
  reasoning: z.string(),
});

const getSystemPrompt = (schema: string) => `You are a medical knowledge graph expert.
Generate a Cypher query to retrieve relevant medical information from Neo4j.

Graph schema:
${schema}

Key node types: Symptom, Condition, Treatment, Medication, Contraindication
Key relationships: (Symptom)-[:INDICATES]->(Condition), (Condition)-[:TREATED_BY]->(Treatment),
                   (Treatment)-[:USES]->(Medication), (Medication)-[:CONTRAINDICATED_WITH]->(Contraindication)

IMPORTANT RULES:
- Always use case-insensitive matching with toLower() when filtering by name.
  Example: MATCH (s:Symptom) WHERE toLower(s.name) CONTAINS toLower('headache')
- Never use exact equality on name properties (avoid WHERE s.name = 'headache').
- Always use LIMIT clauses (max 10). Return relevant properties.
- Prefer CONTAINS over = for partial symptom matching.
Respond with JSON only.`;

export function createSymptomCheckerNode(llm: LLMService, neo4j: Neo4jService) {
  return async (state: GraphState): Promise<Partial<GraphState>> => {
    const lastMessage = state.messages.at(-1);
    const userInput = lastMessage?.text ?? String((lastMessage as any)?.content ?? '');

    console.log('🔍 Generating symptom query for Neo4j...');

    const schema = await neo4j.getSchema();
    const { data, error } = await llm.generateStructured(
      getSystemPrompt(schema),
      `Patient describes: "${userInput}"`,
      CypherQuerySchema,
    );

    if (error || !data) {
      return {
        symptomQuery: userInput,
        error: `Failed to generate query: ${error}`,
      };
    }

    console.log(`✅ Generated Cypher: ${data.query}`);

    return {
      symptomQuery: userInput,
      cypherQuery: data.query,
    };
  };
}
