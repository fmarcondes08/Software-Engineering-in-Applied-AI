import { createServer } from './server.ts';

const app = createServer();

await app.listen({ port: 3000, host: '0.0.0.0' });
console.log(`Server is running on http://0.0.0.0:3000`);

//  curl \
//  -X POST \
//  -H 'Content-type: application/json' \
//  --data '{"question": "Olá, quero reservar uma mesa para 2 pessoas amanhã às 20h, me chamo João"}' \
//  localhost:3000/chat
