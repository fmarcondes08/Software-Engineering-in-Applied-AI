import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import { HumanMessage } from '@langchain/core/messages';
import { buildHealthMindGraphInstance } from './graph/factory.ts';
import type { User, UserRole } from './config.ts';

/** Extract plain text from a PDF buffer.
 *
 *  Uses pdfjs-dist legacy build — the Node.js-compatible build that handles custom
 *  font encodings found in Brazilian lab reports and other non-ASCII PDFs.
 *  Falls back to pdf-parse if pdfjs-dist fails.
 */
async function extractPdfText(buffer: Buffer): Promise<string> {
  // --- Attempt 1: pdfjs-dist legacy (Node.js native, best encoding support) ---
  try {
    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs') as any;

    // Point to the bundled worker so pdfjs doesn't try to fetch one over HTTP
    const workerPath = new URL(
      '../../node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs',
      import.meta.url,
    ).href;
    pdfjsLib.GlobalWorkerOptions.workerSrc = workerPath;

    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(buffer),
      useWorkerFetch: false,
      isEvalSupported: false,
      useSystemFonts: true,
      disableFontFace: true,
    });

    const pdf = await loadingTask.promise;
    const pageTexts: string[] = [];

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent({ includeMarkedContent: false });
      const pageText = content.items
        .filter((item: any) => typeof item.str === 'string')
        .map((item: any) => item.str)
        .join(' ');
      pageTexts.push(pageText);
    }

    const text = pageTexts.join('\n').trim();
    if (text.length > 20) {
      console.log(`📄 pdfjs-dist extracted ${text.length} chars from ${pdf.numPages} page(s)`);
      return text;
    }
    console.log('⚠️  pdfjs-dist returned empty text, trying pdf-parse fallback...');
  } catch (err) {
    console.warn('⚠️  pdfjs-dist failed:', err instanceof Error ? err.message : err);
  }

  // --- Attempt 2: pdf-parse fallback ---
  try {
    const pdfParse = (await import('pdf-parse')).default;
    const result = await pdfParse(buffer);
    const text = result.text?.trim() ?? '';
    if (text.length > 20) {
      console.log(`📄 pdf-parse fallback extracted ${text.length} chars`);
      return text;
    }
  } catch (err) {
    console.warn('⚠️  pdf-parse also failed:', err instanceof Error ? err.message : err);
  }

  console.warn('⚠️  All text extractors returned empty — will try vision LLM fallback');
  return '';
}

export const createServer = () => {
  const app = Fastify({ logger: false });

  app.register(cors, {
    origin: process.env.FRONTEND_URL ?? 'http://localhost:3000',
    methods: ['GET', 'POST', 'OPTIONS'],
  });

  app.register(multipart, {
    limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
  });

  const { graph, neo4j } = buildHealthMindGraphInstance();

  app.addHook('onClose', async () => {
    await neo4j.close();
  });

  // Health check
  app.get('/health', async () => ({ status: 'ok', service: 'HealthMind AI' }));

  /**
   * POST /chat
   * Accepts either JSON or multipart (for PDF uploads).
   * Streams response via Server-Sent Events.
   *
   * JSON body: { message, userId, userName, role, guardrailsEnabled?, threadId? }
   * Multipart: same fields + file attachment (PDF)
   */
  app.post('/chat', async (request, reply) => {
    let message = '';
    let userId = 'anonymous';
    let userName = 'Patient';
    let role: UserRole = 'patient';
    let guardrailsEnabled = true;
    let threadId = 'default';
    let documentBase64: string | undefined;
    let documentFilename: string | undefined;
    let documentRawText: string | undefined; // PDF text extracted server-side

    const contentType = request.headers['content-type'] ?? '';

    if (contentType.includes('multipart/form-data')) {
      const parts = request.parts();
      for await (const part of parts) {
        if (part.type === 'file') {
          const buffer = await part.toBuffer();
          documentBase64 = buffer.toString('base64');
          documentFilename = part.filename;
          // Extract text from PDF immediately so the graph has clean text to work with
          if (part.filename?.toLowerCase().endsWith('.pdf')) {
            console.log(`📄 Extracting text from PDF: ${part.filename}`);
            documentRawText = await extractPdfText(buffer);
            console.log(`✅ Extracted ${documentRawText.length} chars from PDF`);
          }
        } else {
          const value = (part as any).value as string;
          if (part.fieldname === 'message') message = value;
          if (part.fieldname === 'userId') userId = value;
          if (part.fieldname === 'userName') userName = value;
          if (part.fieldname === 'role') role = value as UserRole;
          if (part.fieldname === 'guardrailsEnabled') guardrailsEnabled = value !== 'false';
          if (part.fieldname === 'threadId') threadId = value;
        }
      }
    } else {
      const body = request.body as any;
      message = body?.message ?? '';
      userId = body?.userId ?? 'anonymous';
      userName = body?.userName ?? 'Patient';
      role = (body?.role as UserRole) ?? 'patient';
      guardrailsEnabled = body?.guardrailsEnabled !== false;
      threadId = body?.threadId ?? 'default';
    }

    if (!message && !documentBase64) {
      return reply.status(400).send({ error: 'message or file is required' });
    }

    const user: User = { id: userId, name: userName, role };
    const userMessage = message || (documentBase64 ? 'I am uploading a medical document for analysis.' : '');

    // Set up SSE headers — forward CORS headers already set by @fastify/cors
    // because reply.raw.writeHead bypasses Fastify's reply wrapper
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
      'Access-Control-Allow-Origin': reply.getHeader('access-control-allow-origin') as string ?? '*',
      'Access-Control-Allow-Methods': reply.getHeader('access-control-allow-methods') as string ?? 'GET, POST, OPTIONS',
      'Access-Control-Allow-Credentials': reply.getHeader('access-control-allow-credentials') as string ?? 'true',
    });

    const sendEvent = (event: string, data: unknown) => {
      reply.raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    try {
      const stream = await graph.streamEvents(
        {
          messages: [new HumanMessage(userMessage)],
          user,
          guardrailsEnabled,
          // Document upload fields — only set during an actual upload, cleared otherwise
          documentBase64: documentBase64 ?? undefined,
          documentFilename: documentFilename ?? undefined,
          // Pass pre-extracted PDF text so documentIngestNode can skip the broken multimodal call
          documentText: documentRawText ?? undefined,
          intent: documentBase64 ? 'document_upload' : undefined,
          // Reset ALL per-turn transient fields — they must never bleed from previous turns.
          // Appointment fields are re-accumulated by appointmentNode from conversation history,
          // so resetting them here is safe and prevents hallucinated values from persisting.
          answer: undefined,
          immediateAnswer: undefined,
          cypherResults: undefined,
          cypherQuery: undefined,
          needsCorrection: undefined,
          correctionAttempts: undefined,
          historyResults: undefined,
          isEmergency: undefined,
          documentStored: undefined,
          // Reset ALL appointment fields each turn — appointmentNode re-reads them from history
          appointmentConfirmed: undefined,
          appointmentAction: undefined,
          appointmentDoctor: undefined,
          appointmentDate: undefined,
          appointmentReason: undefined,
          guardrailCheck: null,
        },
        {
          version: 'v2',
          configurable: { thread_id: `${userId}-${threadId}` },
        },
      );

      // Accumulate state patches from every on_chain_end event so we always
      // have the latest values regardless of which node name LangGraph uses.
      const accumulated: Record<string, any> = {};

      for await (const event of stream) {
        // --- token streaming ---
        // Only forward tokens that originate from the 'response' node to avoid
        // leaking raw JSON from structured-output calls in intentNode / symptomCheckerNode.
        if (event.event === 'on_chat_model_stream' && event.metadata?.langgraph_node === 'response') {
          const chunk = event.data?.chunk;
          // content can be a string or an array of content blocks (OpenAI format)
          let token = '';
          if (typeof chunk?.content === 'string') {
            token = chunk.content;
          } else if (Array.isArray(chunk?.content)) {
            token = chunk.content.map((c: any) => c.text ?? c.content ?? '').join('');
          } else {
            token = chunk?.text ?? '';
          }
          if (token) sendEvent('token', { token });
        }

        // --- accumulate every node output into a single state snapshot ---
        if (event.event === 'on_chain_end' && event.data?.output) {
          Object.assign(accumulated, event.data.output);
        }
      }

      // Stream finished — send final done event from accumulated state
      const answer = accumulated.answer
        ?? accumulated.messages?.at(-1)?.content
        ?? accumulated.messages?.at(-1)?.text
        ?? '';

      sendEvent('done', {
        answer,
        intent: accumulated.intent,
        isEmergency: accumulated.isEmergency ?? false,
        // Use === false to avoid treating null/undefined guardrailCheck as blocked
        blocked: accumulated.guardrailCheck?.safe === false,
        appointmentConfirmed: accumulated.appointmentConfirmed,
        appointmentDoctor: accumulated.appointmentDoctor,
        appointmentDate: accumulated.appointmentDate,
        appointmentReason: accumulated.appointmentReason,
        documentStored: accumulated.documentStored ?? false,
      });
    } catch (error) {
      console.error('Stream error:', error);
      sendEvent('error', { message: error instanceof Error ? error.message : 'Unknown error' });
    } finally {
      reply.raw.end();
    }
  });

  /**
   * GET /history/:userId
   * Returns a summary of the patient's stored document history.
   */
  app.get('/history/:userId', async (request, reply) => {
    const { userId } = request.params as { userId: string };

    try {
      const { getAllDocuments } = await import('./services/documentService.ts');
      const results = await getAllDocuments(userId);
      return { userId, documents: results };
    } catch (error) {
      return reply.status(500).send({ error: 'Failed to retrieve history' });
    }
  });

  return app;
};
