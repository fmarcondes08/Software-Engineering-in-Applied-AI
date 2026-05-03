import { MultiServerMCPClient } from '@langchain/mcp-adapters';

if (!process.env.SERVICE_TOKEN) {
  console.error('SERVICE_TOKEN is required. Generate one with /v1/auth/service-token and add it to .env.');
  process.exit(1);
}

const client = new MultiServerMCPClient({
  mcpServers: {
    'growth-mcp': {
      transport: 'stdio',
      command: 'node',
      args: ['src/mcp/index.ts'],
      env: {
        SERVICE_TOKEN: process.env.SERVICE_TOKEN,
        GROWTH_API_BASE_URL: process.env.GROWTH_API_BASE_URL ?? 'http://localhost:9999/v1',
      },
    },
  },
  onInitialized: (source) => {
    console.log(`MCP server connected through LangChain: ${source.server}`);
  },
  onConnectionError: (source, error) => {
    console.error(`MCP connection failed: ${source.serverName}`, error);
    process.exit(1);
  },
});

const tools = await client.getTools();
console.log('Tools loaded by LangChain:', tools.map((tool) => tool.name).join(', '));

const listCustomers = tools.find((tool) => tool.name === 'list_customers');
if (!listCustomers) {
  console.error('Tool list_customers was not loaded.');
  process.exit(1);
}

const result = await listCustomers.invoke({});
console.log('list_customers result:');
console.log(typeof result === 'string' ? result : JSON.stringify(result, null, 2));

await client.close();
