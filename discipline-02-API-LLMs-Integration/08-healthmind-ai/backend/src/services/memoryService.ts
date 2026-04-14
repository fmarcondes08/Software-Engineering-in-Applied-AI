import { SqliteSaver } from '@langchain/langgraph-checkpoint-sqlite';
import Database from 'better-sqlite3';
import { config } from '../config.ts';

export type MemoryService = {
  checkpointer: SqliteSaver;
};

export function createMemoryService(): MemoryService {
  const db = new Database(config.memory.dbPath);
  const checkpointer = new SqliteSaver(db);

  console.log(`✅ Memory configured: SQLite (${config.memory.dbPath})`);
  return { checkpointer };
}
