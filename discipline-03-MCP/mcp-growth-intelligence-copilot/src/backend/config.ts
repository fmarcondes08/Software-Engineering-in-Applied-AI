export const config = {
  port: Number(process.env.PORT ?? 9999),
  jwtSecret: process.env.JWT_SECRET ?? 'supersecret',
  adminSuperSecret: process.env.ADMIN_SUPER_SECRET ?? 'AM I THE BOSS?',
  requestsPerMinute: Number(process.env.REQUESTS_PER_MINUTE ?? 60),
  mongodbUri: process.env.MONGODB_URI,
  dbName: process.env.DB_NAME ?? 'growth_copilot',
  reportsDir: process.env.REPORTS_DIR ?? 'reports',
  openRouterApiKey: process.env.OPENROUTER_API_KEY,
  openRouterModel: process.env.OPENROUTER_MODEL ?? 'openai/gpt-4o-mini',
  serpApiKey: process.env.SERPAPI_API_KEY,
};

export const authUsers = [
  { username: 'admin', password: '123123', role: 'admin' as const },
  { username: 'johndoe', password: '1234', role: 'member' as const },
];
