import { HumanMessage } from 'langchain';
import { buildGraph } from './graph/factory.ts';
import { WhisperService } from './services/whisperService.ts';
import { config } from './config.ts';

import Fastify from 'fastify';
import multipart from '@fastify/multipart';
import staticPlugin from '@fastify/static';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const graph = buildGraph();

function extractAssistantMessage(messages: any[]): string {
    const lastAI = [...messages].reverse().find(
        (m: any) => m._getType?.() === 'ai' || m.type === 'ai'
    );
    return lastAI?.content ?? lastAI?.kwargs?.content ?? '';
}

export const createServer = () => {
    const app = Fastify();
    app.register(multipart);
    app.register(staticPlugin, {
        root: path.join(__dirname, '..', 'public'),
        prefix: '/',
    });

    app.post('/chat/voice', async function (request, reply) {
        try {
            const data = await request.file();
            if (!data) {
                return reply.status(400).send({ error: 'No audio file provided.' });
            }

            const buffer = await data.toBuffer();
            const whisper = new WhisperService(config.openAiApiKey);
            const mimeType = data.mimetype || 'audio/webm';
            const transcribedText = await whisper.transcribe(buffer, data.filename, mimeType);

            console.log(`🎙️  Transcribed: "${transcribedText}"`);

            const response = await graph.invoke({
                messages: [new HumanMessage(transcribedText)],
            });

            const assistantMessage = extractAssistantMessage(response.messages ?? []);
            return { ...response, transcribedText, assistantMessage };

        } catch (error) {
            console.error('❌ Error processing voice request:', error);
            return reply.status(500).send({
                error: 'An error occurred while processing your voice request.',
            });
        }
    });

    app.post('/chat', {
        schema: {
            body: {
                type: 'object',
                required: ['question'],
                properties: {
                    question: { type: 'string', minLength: 10 },
                },
            }
        }
    }, async function (request, reply) {
        try {
            const { question } = request.body as {
                question: string;
            };

            const response = await graph.invoke({
                messages: [new HumanMessage(question)],
            });

            const assistantMessage = extractAssistantMessage(response.messages ?? []);
            return { ...response, assistantMessage };

        } catch (error) {
            console.error('❌ Error processing request:', error);
            return reply.status(500).send({
                error: 'An error occurred while processing your request.',
            });
        }
    });

    return app;
};
