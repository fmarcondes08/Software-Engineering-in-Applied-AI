import { createServer } from './server.ts';
import { config } from './config.ts';

const app = createServer();

try {
  await app.listen({ port: config.port, host: '0.0.0.0' });
  console.log(`\n🏥 HealthMind AI Backend running on http://localhost:${config.port}`);
  console.log(`   POST /chat      — Chat with SSE streaming`);
  console.log(`   GET  /health    — Health check`);
  console.log(`   GET  /history/:userId — Patient document history\n`);
} catch (err) {
  console.error('Failed to start server:', err);
  process.exit(1);
}
