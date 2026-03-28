# 🍽️ Restaurant Booking — Voice & Text Reservation Chatbot

> **Postgraduate Challenge — Software Engineering with Applied AI**
> Module 02 — LLM API Integration
> Goal: build a conversational agent with a real LLM pipeline, structured outputs, and conditional routing via LangGraph.

---

## About

This project is a restaurant reservation chatbot that accepts both **text** and **voice** as input. Users can request to reserve or cancel a table in natural language — the system understands the intent, extracts relevant data, applies business rules, and responds with a friendly message.

It was developed as a hands-on variation of the module's base project (`03-medical-appointment-z`), applying the same architectural patterns in a different domain (restaurant instead of medical clinic) and adding a voice input layer via OpenAI Whisper.

---

## Features

- 💬 Reserve and cancel tables via **text chat** (`POST /chat`)
- 🎙️ Reserve and cancel via **voice** (`POST /chat/voice`) with automatic transcription
- 🌐 **Web UI** with real-time recording button (`GET /`)
- 🔍 Intent identification with **structured output** (Zod schema)
- 🧠 LangGraph pipeline with **conditional routing** between nodes
- ✅ Business validations: service hours, table capacity, same-day double booking
- 📊 Native observability with **LangSmith** (automatic tracing)
- 🧪 Directly testable in **LangGraph Studio**

---

## Architecture

### LangGraph Pipeline

```
START
  └→ identifyIntentNode        (LLM with Zod schema — extracts intent + data)
        ├→ [reserve]  → reservationNode   → messageGeneratorNode → END
        ├→ [cancel]   → cancellationNode  → messageGeneratorNode → END
        └→ [unknown]                      → messageGeneratorNode → END
```

### Folder Structure

```
src/
├── config.ts                        # OpenRouter + OpenAI configuration
├── index.ts                         # Entry point (Fastify server)
├── server.ts                        # HTTP routes: /chat, /chat/voice, static
├── graph/
│   ├── factory.ts                   # Wires dependencies and compiles the graph
│   ├── graph.ts                     # StateGraph with Zod schema and routing
│   └── nodes/
│       ├── identifyIntentNode.ts    # Classifies intent + extracts data via LLM
│       ├── reservationNode.ts       # Validates and creates reservation
│       ├── cancellationNode.ts      # Validates and cancels reservation
│       └── messageGeneratorNode.ts  # Generates friendly response via LLM
├── services/
│   ├── openRouterService.ts         # LangChain + OpenRouter wrapper (LLM)
│   ├── whisperService.ts            # OpenAI Whisper wrapper (voice transcription)
│   └── reservationService.ts        # In-memory store: tables, reservations, rules
└── prompts/v1/
    ├── identifyIntent.ts            # System/user prompts for classification
    └── messageGenerator.ts          # System/user prompts for final response
public/
└── index.html                       # Voice recording UI (vanilla JS)
tests/
└── router.e2e.test.ts               # E2E tests with Fastify inject
```

---

## Technical Decisions

### LangGraph as orchestrator
LangGraph was chosen (over simple function chaining) to provide **explicit conditional routing** between nodes, typed state management, and native compatibility with LangSmith Studio for visual graph inspection.

### Structured outputs with Zod
All LLM calls use `generateStructured()` with Zod schemas, eliminating the risk of malformed responses. LangChain calls the model with a structured `response_format` and automatically validates the output.

### Two LLMs, two distinct roles
- **`identifyIntentNode`** → uses the LLM as a *classifier and extractor*: understands intent and extracts structured fields (name, date, party size, seating preference)
- **`messageGeneratorNode`** → uses the LLM as a *language generator*: transforms the business result into a warm, hospitable message for the user

### OpenRouter as LLM gateway
Allows switching models (e.g. `arcee-ai/trinity-large-preview:free`) without changing code. The default model is free, enabling development and testing at no cost.

### Whisper for voice transcription
The `openai` package (already present as a transitive dependency of `@langchain/openai`) is used directly to call the Whisper transcription API. Audio recorded in the browser (`audio/webm` via MediaRecorder) is sent to the `/chat/voice` endpoint, transcribed, and injected into the same LangGraph pipeline as the text chat — with no logic duplication.

### In-memory store
Reservations are stored in an in-memory array for simplicity. State is lost on server restart. This is intentional for the scope of this challenge — see the future improvements section.

### Consistent UTC validation
The LLM generates dates in UTC ISO format (because it receives `current_date` as `new Date().toISOString()`). Service hour validation uses `getUTCHours()` to stay consistent with the LLM's timezone, avoiding false negatives on servers running in non-UTC local timezones.

---

## Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js ≥ 24.10 (TypeScript via strip-types) |
| HTTP Server | Fastify 5 |
| LLM Orchestration | LangGraph + LangChain |
| LLM Provider | OpenRouter (`arcee-ai/trinity-large-preview:free`) |
| Voice Transcription | OpenAI Whisper (`whisper-1`) |
| Schema Validation | Zod v3 |
| Observability | LangSmith |
| Testing | Node.js built-in test runner |
| Frontend | HTML + Vanilla JS (MediaRecorder API) |

---

## Getting Started

### Prerequisites

- Node.js ≥ 22
- [OpenRouter](https://openrouter.ai) account (free)
- [OpenAI](https://platform.openai.com) account (Whisper — pay-per-use, very cheap)
- [LangSmith](https://smith.langchain.com) account (free for development)

### Installation

```bash
git clone <repo>
cd 04-restaurant-booking-z
npm install
cp .env.example .env
```

Fill in the `.env` file:

```env
OPENROUTER_API_KEY=sk-or-...       # LLM via OpenRouter
OPENAI_API_KEY=sk-...              # Whisper (voice transcription)

LANGSMITH_API_KEY=lsv2_pt_...     # Tracing and LangGraph Studio
LANGCHAIN_TRACING_V2=true
LANGCHAIN_PROJECT=04-restaurant-booking
```

### Run the server

```bash
npm run dev
```

Open `http://localhost:3000` for the voice interface.

### Test via curl (text)

```bash
curl -X POST http://localhost:3000/chat \
  -H "Content-Type: application/json" \
  -d '{"question": "I want to reserve a table for 2 people tomorrow at 8pm, my name is John"}'
```

### Test via curl (voice)

```bash
# Generate test audio on macOS
say -o test.aiff "I want to reserve a table for 2 people tomorrow at 8pm"
afconvert test.aiff test.mp3 -d MP3

# Send to the endpoint
curl -X POST http://localhost:3000/chat/voice \
  -F "file=@test.mp3"
```

### Test via LangGraph Studio

```bash
npm run langgraph:serve
# Open: https://smith.langchain.com/studio/?baseUrl=http://127.0.0.1:2024
```

### Run e2e tests

```bash
npm test
```

---

## Business Rules

| Rule | Detail |
|---|---|
| Service hours | Lunch 12pm–3pm · Dinner 7pm–11pm (UTC) |
| Table capacity | 2, 4, or 8 seats |
| Available sections | indoor, outdoor, bar, private |
| Double booking | Same name cannot have 2 reservations on the same day |
| Availability | System finds the first available table with matching capacity and section |

---

## Future Improvements

- **Database persistence** — replace the in-memory store with SQLite or PostgreSQL (e.g. Drizzle ORM), eliminating state loss on restart
- **Authentication** — identify users by login or phone number instead of relying on the LLM-extracted name
- **Email or SMS confirmation** — integrate Resend or Twilio to send reservation confirmations
- **Conversation history** — maintain context across turns to allow follow-up questions ("what if I need it for 4 people instead?")
- **Streaming responses** — use LangGraph's `streamEvents` to display the assistant's response in real time on the UI
- **Text-to-speech (TTS)** — respond in audio using the OpenAI TTS API, completing the voice → voice cycle
- **Model fallback** — configure multiple models in OpenRouter with automatic fallback if a model is unavailable
- **Per-node unit tests** — test each graph node in isolation with mocked LLM and ReservationService
- **Containerization** — Dockerfile for easy deployment to production environments

---

## Challenge Context

This project is part of the **Postgraduate Program in Software Engineering with Applied AI**, Module 02 — *LLM API Integration*.

The module's goal is to demonstrate in practice:
- Building LLM agents with **conditional flow** (not just linear API calls)
- Using **structured outputs** to make the LLM reliable as a system component
- **Prompt chaining** with separated responsibilities (classify vs. generate)
- Integration with real observability tools (LangSmith) and deployment (LangGraph Cloud)
- Extending the pipeline with **multimodal inputs** (voice via Whisper)
