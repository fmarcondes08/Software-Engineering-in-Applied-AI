# MCP Growth Intelligence Copilot

Full-stack capstone for the MCP practice module.

This project is an internal growth dashboard where a user can import customers, ask an AI copilot for campaign recommendations, and expose the same CRM capabilities as MCP tools for agent clients.

It combines:

- Fastify REST API with JWT authentication
- Service tokens for MCP/server-to-server access
- RBAC with `admin` and `member` roles
- Rate limiting
- MongoDB-ready repository with an in-memory demo/test fallback
- Growth CRM MCP server with tools, resources, and prompts
- LangGraph workflow for campaign recommendations
- CSV-to-JSON customer import
- Markdown campaign report persistence
- React + Vite dashboard
- Node.js test runner coverage for API, agent, MCP client, and frontend utilities

Node.js `>=22.19.0` is supported. Node.js 24+ is still the recommended course runtime.

## Project Structure

```txt
mcp-growth-intelligence-copilot/
  examples/      Example CSV files for dashboard import
  src/backend/   Fastify API, auth, repositories, services, LangGraph agent
  src/mcp/       Growth MCP server and HTTP client wrapper
  src/frontend/  React + Vite dashboard
  test/          Node.js test runner tests
  reports/       Generated Markdown campaign reports
```

## Prerequisites

- Node.js `>=22.19.0`
- npm
- Docker, only if you want MongoDB persistence or private Verdaccio publishing

The app can run without Docker by using the in-memory repository.

## Install

From this project folder:

```bash
cd mcp-growth-intelligence-copilot
npm install
cp .env.example .env
```

For the simplest local demo, edit `.env` and either remove `MONGODB_URI` or add:

```env
USE_IN_MEMORY_DB=true
```

This keeps the demo self-contained and avoids requiring MongoDB.

## Run The App

Start the API:

```bash
npm run api:start
```

Start the frontend in another terminal:

```bash
npm run dev
```

Open:

[http://localhost:5173](http://localhost:5173)

The API runs at:

[http://localhost:9999/v1/health](http://localhost:9999/v1/health)

## Login Credentials

| Role | Username | Password | Permissions |
|---|---|---|---|
| admin | `admin` | `123123` | Read, import, create, update, delete |
| member | `johndoe` | `1234` | Read and use the copilot |

The login form starts empty. Enter one of the credentials above.

## Main Dashboard Flows

### 1. Import Customers

Sign in as `admin`, open the CSV Import panel, and select a `.csv` file.

You can use the included example file:

```txt
examples/customers.csv
```

The CSV must have this shape:

```csv
name,phone,email,segment,interests
Customer One,+1 555-0201,customer.one@example.com,Developer Tools,"testing; automation"
Customer Two,+1 555-0202,customer.two@example.com,AI Education,"software engineering; mcp"
```

Required fields:

- `name`
- `phone`

Optional fields:

- `email`
- `segment`
- `interests`, separated by `;` or `,`

Click **Import Customers** after the file is selected. Imported customers appear in the Customers panel.

### 2. Search And Inspect Customers

Use the top search box to search by:

- name
- phone
- email
- segment
- interests

Select a customer to see details and outreach history.

### 3. Ask The Copilot

Use the chat panel with a question such as:

```txt
Which customers should I contact this week for my campaign?
```

The backend calls the LangGraph workflow, creates trend signals, recommends customer actions, persists a campaign report, and writes a Markdown report in `reports/`.

### 4. Review Reports

Generated reports appear in the Reports panel. Selecting a report shows:

- summary
- recommended actions
- trend signals
- Markdown preview

## REST API

All routes except health and auth require `Authorization: Bearer <token>`.

### Auth

Login:

```bash
curl -X POST http://localhost:9999/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"123123"}'
```

In Postman, use:

- Method: `POST`
- URL: `http://localhost:9999/v1/auth/login`
- Body: `raw`
- Format: `JSON`
- Header: `Content-Type: application/json`

Body:

```json
{
  "username": "admin",
  "password": "123123"
}
```

The API also accepts credentials as query params, which matches Postman's Params tab:

```txt
POST http://localhost:9999/v1/auth/login?username=admin&password=123123
```

Create a service token for MCP usage:

```bash
curl -X POST http://localhost:9999/v1/auth/service-token \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"123123","adminSuperSecret":"AM I THE BOSS?"}'
```

### Customers

```bash
curl http://localhost:9999/v1/customers \
  -H "Authorization: Bearer <token>"
```

```bash
curl -X POST http://localhost:9999/v1/customers \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <admin-token>" \
  -d '{"name":"Ada Lovelace","phone":"+1 555-0101","segment":"AI Education","interests":["MCP","LangGraph"]}'
```

### CSV Import

The dashboard imports an actual `.csv` file. The REST endpoint receives the file content as `csvText`, which is useful for API clients and tests.

```bash
curl -X POST http://localhost:9999/v1/import/customers \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <admin-token>" \
  -d '{"csvText":"name,phone\nAda,+1 555-0101"}'
```

### Agent Chat

```bash
curl -X POST http://localhost:9999/v1/agent/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"message":"Which customers should I contact about my campaign?"}'
```

## MCP Server

The MCP server wraps the REST API, so the API must be running first.

1. Create a service token:

```bash
curl -X POST http://localhost:9999/v1/auth/service-token \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"123123","adminSuperSecret":"AM I THE BOSS?"}'
```

2. Add the returned token to `.env`:

```env
SERVICE_TOKEN=<token>
```

3. Start the MCP server:

```bash
npm run mcp:start
```

Or inspect it interactively:

```bash
npm run mcp:inspect
```

Available MCP tools:

- `list_customers`
- `find_customer`
- `create_customer`
- `update_customer`
- `record_outreach`
- `recommend_next_action`

Available MCP resources:

- `growth://api-info`
- `growth://playbook`

Available MCP prompts:

- `find_customer_prompt`
- `campaign_strategy_prompt`

## LangChain MCP Smoke Test

This project also includes a direct LangChain test for the MCP integration.

The script uses `@langchain/mcp-adapters` to start the local Growth MCP server through stdio, load its tools, and invoke `list_customers`.

1. Start the API:

```bash
npm run api:start
```

2. Create a service token:

```bash
curl -X POST "http://localhost:9999/v1/auth/service-token?username=admin&password=123123&adminSuperSecret=AM%20I%20THE%20BOSS%3F"
```

3. Add the returned token to `.env`:

```env
SERVICE_TOKEN=<token>
```

4. Run the LangChain smoke test:

```bash
npm run langchain:mcp:smoke
```

Expected output:

```txt
MCP server connected through LangChain: growth-mcp
Tools loaded by LangChain: list_customers, find_customer, create_customer, update_customer, record_outreach, recommend_next_action
list_customers result:
...
```

If that command lists the tools and prints customer data, LangChain is successfully consuming the MCP server.

## SerpAPI / Google Trends

The agent can use SerpAPI for real Google Trends signals.

Set your key in `.env`:

```env
SERPAPI_API_KEY=<your-serpapi-key>
```

Restart the API:

```bash
npm run api:start
```

Then call the agent:

```bash
curl -X POST http://localhost:9999/v1/agent/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"message":"Which customers should I contact about AI automation?"}'
```

Check `report.trendSignals[*].source` in the response:

- `serpapi-google-trends` means SerpAPI is working.
- `deterministic-local-signal` means the app is using the local fallback.

The fallback is used when `SERPAPI_API_KEY` is empty, SerpAPI fails, or Google Trends returns no usable data for the keywords.

## MongoDB Persistence

The default `.env.example` points to MongoDB:

```env
MONGODB_URI=mongodb://localhost:27017
DB_NAME=growth_copilot
```

Start MongoDB with Docker:

```bash
docker compose up -d mongodb
```

Then run:

```bash
npm run api:start
```

For in-memory mode, set:

```env
USE_IN_MEMORY_DB=true
```

In-memory mode is useful for demos, tests, and quick local runs. Data resets when the API process restarts.

## Private MCP Publishing

Start Verdaccio:

```bash
npm run registry:start
```

Login:

```bash
npm login --registry http://localhost:4873
```

Publish:

```bash
npm run release:private
```

Stop Verdaccio:

```bash
npm run registry:stop
```

## Test And Build

Run the test suite:

```bash
npm test
```

Build the frontend:

```bash
npm run build
```

Watch tests during development:

```bash
npm run test:watch
```

## Troubleshooting

### `node: .env: not found`

Create the `.env` file:

```bash
cp .env.example .env
```

### `npm run api:dev` fails with `EMFILE: too many open files, watch`

Use the non-watch API command:

```bash
npm run api:start
```

### `listen EPERM` or port already in use

Change the API port in `.env`:

```env
PORT=9998
```

If you change the API port, also update the Vite proxy in `vite.config.ts`.

### Login works in tests but not in the browser

Restart the API after changing `.env` or credentials. The dashboard stores the previous session in local storage, so sign out and sign in again.

### MCP server says `SERVICE_TOKEN env var is required`

Create a service token through `/v1/auth/service-token`, add it to `.env`, and restart `npm run mcp:start`.
