import { config } from './config.ts';
import { createApp } from './http/createApp.ts';
import { createRepository } from './repositories/createRepository.ts';

const repository = await createRepository();
const app = createApp(repository);

const address = await app.listen({ port: config.port, host: '::' });
console.log(`growth copilot api running at ${address}`);

export { app };
