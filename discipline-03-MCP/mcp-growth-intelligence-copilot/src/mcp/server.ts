import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { GrowthHttpClient } from './growthHttpClient.ts';

function textResult(data: unknown) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
    structuredContent: data as Record<string, unknown>,
  };
}

export function createGrowthMcpServer(client = new GrowthHttpClient()) {
  const server = new McpServer({
    name: '@local/growth-mcp',
    version: '0.1.0',
  });

  server.registerTool(
    'list_customers',
    { description: 'List all customers in the Growth CRM', inputSchema: {} },
    async () => textResult({ customers: await client.listCustomers() }),
  );

  server.registerTool(
    'find_customer',
    {
      description: 'Find customers by name, phone, email, segment, or interest',
      inputSchema: { query: z.string().describe('Search text') },
    },
    async ({ query }) => textResult({ customers: await client.findCustomer(query) }),
  );

  server.registerTool(
    'create_customer',
    {
      description: 'Create a customer. Requires an admin service token.',
      inputSchema: {
        name: z.string(),
        phone: z.string(),
        email: z.string().optional(),
        segment: z.string().optional(),
        interests: z.array(z.string()).optional(),
      },
    },
    async (input) => textResult(await client.createCustomer(input)),
  );

  server.registerTool(
    'update_customer',
    {
      description: 'Update a customer by id. Requires an admin service token.',
      inputSchema: {
        id: z.string(),
        name: z.string().optional(),
        phone: z.string().optional(),
        email: z.string().optional(),
        segment: z.string().optional(),
        interests: z.array(z.string()).optional(),
      },
    },
    async ({ id, ...input }) => textResult(await client.updateCustomer(id, input)),
  );

  server.registerTool(
    'record_outreach',
    {
      description: 'Record an outreach touchpoint for a customer.',
      inputSchema: {
        customerId: z.string(),
        channel: z.enum(['email', 'phone', 'whatsapp', 'linkedin', 'other']),
        note: z.string(),
      },
    },
    async (input) => textResult(await client.recordOutreach(input)),
  );

  server.registerTool(
    'recommend_next_action',
    {
      description: 'Ask the Growth Copilot to recommend campaign next actions.',
      inputSchema: { message: z.string() },
    },
    async ({ message }) => textResult(await client.recommendNextAction(message)),
  );

  server.registerResource(
    'growth://api-info',
    'growth://api-info',
    { description: 'Describes the Growth CRM REST API wrapped by this MCP server.' },
    async () => ({
      contents: [{
        uri: 'growth://api-info',
        mimeType: 'text/plain',
        text: `
Growth CRM API
  GET    /v1/customers
  POST   /v1/customers
  PUT    /v1/customers/:id
  DELETE /v1/customers/:id
  POST   /v1/import/customers
  POST   /v1/agent/chat
  GET    /v1/reports
`.trim(),
      }],
    }),
  );

  server.registerResource(
    'growth://playbook',
    'growth://playbook',
    { description: 'Growth campaign operating playbook for agents.' },
    async () => ({
      contents: [{
        uri: 'growth://playbook',
        mimeType: 'text/markdown',
        text: [
          '# Growth Playbook',
          '',
          '- Prefer high-priority customers with matching interests and rising trend signals.',
          '- Record every outreach action before suggesting follow-up work.',
          '- Keep campaign recommendations specific, measurable, and tied to customer context.',
        ].join('\n'),
      }],
    }),
  );

  server.registerPrompt(
    'find_customer_prompt',
    {
      description: 'Prompt template for finding relevant customers',
      argsSchema: { query: z.string() },
    },
    ({ query }) => ({
      messages: [{
        role: 'user',
        content: { type: 'text', text: `Find customers related to: ${query}` },
      }],
    }),
  );

  server.registerPrompt(
    'campaign_strategy_prompt',
    {
      description: 'Prompt template for campaign recommendations',
      argsSchema: { goal: z.string() },
    },
    ({ goal }) => ({
      messages: [{
        role: 'user',
        content: { type: 'text', text: `Create a customer outreach campaign for this goal: ${goal}` },
      }],
    }),
  );

  return server;
}
