#!/usr/bin/env node

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createGrowthMcpServer } from './server.ts';

if (!process.env.SERVICE_TOKEN) {
  console.error('[error]: SERVICE_TOKEN env var is required');
  process.exit(1);
}

const server = createGrowthMcpServer();
const transport = new StdioServerTransport();
await server.connect(transport);
console.error('Growth MCP server running on stdio');
