import { Neo4jGraph } from '@langchain/community/graphs/neo4j_graph';
import { config } from '../config.ts';

export class Neo4jService {
  private graph: Neo4jGraph | null = null;
  private initializing: Promise<Neo4jGraph> | null = null;

  private async getGraph(): Promise<Neo4jGraph> {
    if (this.graph) return this.graph;

    if (this.initializing) return this.initializing;

    this.initializing = Neo4jGraph.initialize({
      url: config.neo4j.uri,
      username: config.neo4j.username,
      password: config.neo4j.password,
      enhancedSchema: false,
    });

    this.graph = await this.initializing;
    this.initializing = null;
    return this.graph;
  }

  async getSchema(): Promise<string> {
    try {
      const graph = await this.getGraph();
      return await graph.getSchema();
    } catch (error) {
      console.error('Error getting Neo4j schema:', error);
      return '';
    }
  }

  async query<T = any>(cypherQuery: string, parameters?: Record<string, any>): Promise<T[]> {
    const graph = await this.getGraph();
    const result = await graph.query(cypherQuery, parameters);
    return result as T[];
  }

  async validateQuery(query: string): Promise<{ valid: boolean; error?: string }> {
    try {
      const graph = await this.getGraph();
      await graph.query(`EXPLAIN ${query}`);
      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async close(): Promise<void> {
    if (this.initializing) await this.initializing;
    if (this.graph) {
      await this.graph.close();
      this.graph = null;
    }
  }
}
