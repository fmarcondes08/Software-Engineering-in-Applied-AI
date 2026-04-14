import { LLMService } from '../services/llmService.ts';
import { Neo4jService } from '../services/neo4jService.ts';
import { createMemoryService } from '../services/memoryService.ts';
import { buildHealthMindGraph } from './graph.ts';

export function buildHealthMindGraphInstance() {
  const llm = new LLMService();
  const neo4j = new Neo4jService();
  const { checkpointer } = createMemoryService();
  const graph = buildHealthMindGraph(llm, neo4j, checkpointer);

  return { graph, neo4j, llm };
}
