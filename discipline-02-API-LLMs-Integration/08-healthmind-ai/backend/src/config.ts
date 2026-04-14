export type UserRole = 'patient' | 'doctor' | 'admin';

export type User = {
  id: string;
  name: string;
  role: UserRole;
};

export const config = {
  apiKey: process.env.OPENROUTER_API_KEY!,
  httpReferer: '',
  xTitle: 'HealthMind AI',

  // Main model — used for reasoning, intent, symptom checking, responses
  models: [
    'google/gemini-2.0-flash-001',
    'meta-llama/llama-3.3-70b-instruct',
  ],

  // Fast/cheap model — used for simple tasks like appointment routing
  fastModels: [
    'meta-llama/llama-3.1-8b-instruct:free',
    'google/gemini-flash-1.5-8b',
  ],

  // Safeguard model — reuses the main model for injection detection
  guardrailsModel: 'google/gemini-2.0-flash-001',

  provider: {
    sort: {
      by: 'throughput',
      partition: 'none',
    },
  },

  temperature: 0.3,
  maxTokens: 2048,

  neo4j: {
    uri: process.env.NEO4J_URI ?? 'neo4j://localhost:7687',
    username: process.env.NEO4J_USER ?? 'neo4j',
    password: process.env.NEO4J_PASSWORD ?? 'password',
  },

  memory: {
    dbPath: process.env.SQLITE_PATH ?? './healthmind.db',
  },

  maxCorrectionAttempts: 1,
  port: Number(process.env.PORT ?? 3001),
};

export default config;
