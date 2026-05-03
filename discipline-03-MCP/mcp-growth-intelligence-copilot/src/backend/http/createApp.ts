import fastifyJwt from '@fastify/jwt';
import fastifyRateLimit from '@fastify/rate-limit';
import Fastify from 'fastify';
import { z } from 'zod';
import { GrowthAgent } from '../agent/growthAgent.ts';
import { config } from '../config.ts';
import { importCustomersFromCsv } from '../services/csvImportService.ts';
import { createTrendsService } from '../services/trendsService.ts';
import type { GrowthRepository } from '../repositories/growthRepository.ts';
import { registerAuth, requireRole } from './auth.ts';

const customerSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(1),
  email: z.string().email().optional().or(z.literal('')),
  segment: z.string().optional(),
  interests: z.array(z.string()).optional(),
});

export function createApp(repository: GrowthRepository) {
  const app = Fastify({ logger: false, routerOptions: { ignoreTrailingSlash: true } });
  const agent = new GrowthAgent(repository, createTrendsService(config.serpApiKey));

  app.register(fastifyJwt, { secret: config.jwtSecret });
  app.register(fastifyRateLimit, {
    max: config.requestsPerMinute,
    timeWindow: '1 minute',
    keyGenerator: (request) => request.headers.authorization ?? request.ip,
  });
  void registerAuth(app);

  app.addHook('preHandler', (request, reply, done) => {
    reply.header('Access-Control-Allow-Origin', '*');
    reply.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    reply.header('Access-Control-Allow-Headers', '*');
    if (request.method === 'OPTIONS') return reply.send();
    done();
  });

  app.get('/v1/health', async () => ({ app: 'growth-copilot', version: 'v0.1.0' }));

  app.get('/v1/customers', async (request) => {
    const query = (request.query as { q?: string }).q;
    return query ? repository.findCustomers(query) : repository.listCustomers();
  });

  app.get('/v1/customers/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const customer = await repository.findCustomerById(id);
    if (!customer) return reply.code(404).send({ message: 'Customer not found', id });
    return customer;
  });

  app.post('/v1/customers', { preHandler: [requireRole('admin')] }, async (request, reply) => {
    const parsed = customerSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ message: 'Invalid customer payload', issues: parsed.error.issues });
    const customer = await repository.createCustomer({
      ...parsed.data,
      email: parsed.data.email || undefined,
    });
    return reply.code(201).send(customer);
  });

  app.put('/v1/customers/:id', { preHandler: [requireRole('admin')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = customerSchema.partial().safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ message: 'Invalid customer payload', issues: parsed.error.issues });
    const customer = await repository.updateCustomer(id, {
      ...parsed.data,
      email: parsed.data.email || undefined,
    });
    if (!customer) return reply.code(404).send({ message: 'Customer not found', id });
    return customer;
  });

  app.delete('/v1/customers/:id', { preHandler: [requireRole('admin')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const deleted = await repository.deleteCustomer(id);
    if (!deleted) return reply.code(404).send({ message: 'Customer not found', id });
    return { id, deleted: true };
  });

  app.get('/v1/outreach', async (request) => {
    const { customerId } = request.query as { customerId?: string };
    return repository.listOutreach(customerId);
  });

  app.post('/v1/outreach', async (request, reply) => {
    const parsed = z.object({
      customerId: z.string().min(1),
      channel: z.enum(['email', 'phone', 'whatsapp', 'linkedin', 'other']),
      note: z.string().min(1),
    }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ message: 'Invalid outreach payload', issues: parsed.error.issues });
    return repository.recordOutreach(parsed.data);
  });

  app.post('/v1/import/customers', { preHandler: [requireRole('admin')] }, async (request, reply) => {
    const body = request.body as { csvText?: string };
    if (!body.csvText) return reply.code(400).send({ message: 'csvText is required' });
    return importCustomersFromCsv(repository, body.csvText);
  });

  app.post('/v1/agent/chat', async (request, reply) => {
    const body = request.body as { message?: string };
    if (!body.message?.trim()) return reply.code(400).send({ message: 'message is required' });
    return agent.chat(body.message);
  });

  app.get('/v1/reports', async () => repository.listReports());

  app.addHook('onClose', async () => {
    const maybeClosable = repository as GrowthRepository & { close?: () => Promise<void> };
    await maybeClosable.close?.();
  });

  return app;
}
