# HealthMind AI — Intelligent Healthcare Navigator

A capstone project integrating all patterns from Module 02.

## Patterns Used

| Pattern | Module Project | Where Used |
|---|---|---|
| Model routing gateway | Project 01 | `LLMService` — fast vs powerful model selection |
| LangGraph orchestration | Project 02 | Full multi-node graph with conditional edges |
| Intent classification | Project 03 | `intentNode` — routes to specialized handlers |
| Persistent memory | Project 04 | SQLite checkpointer per patient thread |
| Prompt injection defense | Project 05 | `safeguardNode` with dedicated guardrail model |
| RBAC | Project 05 | `user.role` gates tool access and response style |
| Neo4j knowledge graph | Project 06 | Medical ontology: Symptoms→Conditions→Treatments |
| Cypher self-correction | Project 06 | `cypherCorrectionNode` retries on validation errors |
| Document RAG | Project 07 | PDF upload → multimodal extraction → vector store |

## Architecture

```
Request
  │
  ▼
[Safeguard Node]        ← prompt injection check
  │
  ▼
[Intent Classifier]     ← schedule / cancel / symptom / upload / history / emergency
  │
  ├─► [Appointment Node]
  ├─► [Symptom Checker] → [Cypher Executor] → [Cypher Correction?] → [Response]
  ├─► [Document Ingest]
  ├─► [History RAG]
  └─► [Emergency Node]
  │
  ▼
[Response Node]         ← synthesizes final answer with all context
  │
  ▼
[SQLite Checkpointer]   ← persists per-patient conversation
```

## Project Structure

```
08-healthmind-ai/
├── backend/
│   ├── src/
│   │   ├── config.ts
│   │   ├── services/        # llm, neo4j, memory, documents
│   │   ├── graph/
│   │   │   ├── state.ts
│   │   │   ├── graph.ts
│   │   │   ├── factory.ts
│   │   │   └── nodes/       # one file per LangGraph node
│   │   ├── server.ts        # Fastify + SSE streaming
│   │   └── index.ts
│   ├── scripts/
│   │   └── seed-neo4j.ts    # Medical knowledge graph seeder
│   ├── docker-compose.yml   # Neo4j
│   └── .env.example
└── frontend/
    ├── src/
    │   ├── app/
    │   │   ├── page.tsx           # Login / role selection
    │   │   ├── chat/page.tsx      # Streaming chat interface
    │   │   └── dashboard/page.tsx # Patient health dashboard
    │   ├── components/
    │   │   ├── ChatWindow.tsx
    │   │   ├── MessageInput.tsx   # text input + PDF attach
    │   │   ├── DocumentUpload.tsx # drag-and-drop PDF
    │   │   ├── AppointmentCard.tsx
    │   │   └── RoleBadge.tsx
    │   └── lib/api.ts             # SSE streaming fetch client
    └── .env.example
```

## Getting Started

### 1. Start Neo4j

```bash
cd backend
docker compose up -d
```

### 2. Configure environment

```bash
cp backend/.env.example backend/.env
# Add your OPENROUTER_API_KEY
```

### 3. Install dependencies

```bash
cd backend && npm install
cd ../frontend && npm install
```

### 4. Seed the medical knowledge graph

```bash
cd backend && npm run seed
```

### 5. Start the backend

```bash
cd backend && npm run dev
# Runs on http://localhost:3001
```

### 6. Start the frontend

```bash
cd frontend && npm run dev
# Runs on http://localhost:3000
```

## Usage

1. Open `http://localhost:3000`
2. Enter your name and select a role:
   - **Patient** — book appointments, upload records, query symptoms
   - **Doctor** — same as patient with more clinical detail
   - **Admin** — all access + guardrails toggle to demo security
3. Chat with the AI — it routes your request through the appropriate nodes

### Demo scenarios

| Input | What happens |
|---|---|
| "I have a headache and fever" | Intent→symptom_query, Neo4j lookup, response with conditions/treatments |
| "Schedule an appointment with a cardiologist next Monday" | Intent→schedule_appointment, structured extraction, appointment card |
| Upload a PDF lab report | Intent→document_upload, multimodal extraction, stored in vector store |
| "What did my last blood test show?" | Intent→history_query, RAG search over uploaded docs |
| "I have severe chest pain and can't breathe" | Intent→emergency, immediate escalation response |
| (Admin) Turn off guardrails, try an injection prompt | Demonstrates the security layer difference |

## API

### POST /chat

Stream chat response via Server-Sent Events.

**JSON body:**
```json
{
  "message": "I have a headache",
  "userId": "patient-jane-123",
  "userName": "Jane",
  "role": "patient",
  "guardrailsEnabled": true,
  "threadId": "session-1"
}
```

**Multipart** (with PDF): same fields + `file` attachment.

**SSE events:**
- `event: token` — streaming token chunk
- `event: done` — final answer + metadata
- `event: error` — error message

### GET /history/:userId

Returns patient's stored document summaries.
