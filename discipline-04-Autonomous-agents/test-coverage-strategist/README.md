# Project: Test Coverage Strategist

Self-contained module 4 project. Contains a `goal_oriented` agent that decomposes a test coverage target into a risk-prioritized roadmap, plus the runtime and trace-analyzer needed to run and audit execution.

Fully English: prose, YAML keys, CLI commands, Python modules, and identifiers.

## Structure

```
test-coverage-strategist/
├── README.md
├── runtime/                       ← generic engine in English
│   ├── main.py        (CLI: run / validate / trace / analyze / replay)
│   ├── cycle.py       (orchestrates perceive → plan → act → evaluate)
│   ├── contracts.py   (loads the 9 .md files and builds the initial state)
│   ├── planner.py     (perception and LLM call)
│   ├── tools.py       (builds tool functions from skills)
│   ├── executor.py    (executes, validates payload, fires hooks, evaluates)
│   ├── telemetry.py   (events, timings, tokens)
│   └── validator.py   (cross-contract consistency check)
├── trace-analyzer/                ← agent that analyzes any agent's trace
└── agent/                         ← the 9 contracts of test-coverage-strategist
    ├── agent.md       (name: test-coverage-strategist, type: goal_oriented)
    ├── rules.md
    ├── skills.md
    ├── hooks.md
    ├── memory.md
    ├── commands.md
    └── contracts/
        ├── loop.md
        ├── planner.md
        ├── executor.md
        └── toolbox.md
```

The outer folder (`test-coverage-strategist/`) is the project. The inner folder (`agent/`) is the agent itself. The real agent name comes from the YAML in `agent/agent.md` — the runtime uses that name, not the path.

## How to run

```bash
cd runtime
pip install -r requirements.txt

# (optional) use a real LLM
echo "OPENAI_API_KEY=sk-..." > .env

# validate contracts
python main.py validate --agent ../agent

# run
python main.py run --agent ../agent \
  --input "raise the payment service coverage from 42% to 80% in 3 sprints"

# inspect the trace
python main.py trace

# diagnose the run with another agent
python main.py analyze --agent ../trace-analyzer
```

Without `OPENAI_API_KEY` the runtime falls back to the built-in mock planner and runs the whole pipeline for free.

## Agent pipeline

6 skills chained together (order enforced by the rules in `planner.md`):

```
analyze_current_coverage
   → identify_critical_paths
       → propose_test_cases
           → prioritize_by_risk
               → generate_roadmap
                   → consolidate_strategy   (required before FINISH)
```

Expected output: a JSON object containing `coverage_diagnostic`, `critical_paths`, `proposed_test_cases`, `prioritization`, and `sprint_roadmap`.

## CLI commands

| Command | What it does |
|---------|--------------|
| `run --agent <path> --input "<text>" [--mode <mode>] [--event <name>]` | Runs the agent. `mode` ∈ {`task_based`, `interactive`, `goal_oriented`, `autonomous`}. |
| `validate --agent <path>` | Checks cross-contract consistency before running. |
| `trace` | Prints the trace of the last run. |
| `analyze --agent <trace-analyzer>` | Runs the trace-analyzer on the last trace and writes `analysis-agent.md`. |
| `replay --agent <path>` | Reruns with the same input as the last run. |

## Key vocabulary

| YAML key | Meaning |
|----------|---------|
| `name`, `description`, `type`, `objective` | Agent identity (in `agent.md`) |
| `output_contract` | Required fields of the final artifact |
| `skills` | List of tool interfaces (name, description, input, output) |
| `tools` (toolbox) | Subset of skills exposed to the agent |
| `rules.required_tools` | Tools that must run before FINISH |
| `rules.policies` | Free-text rules injected into the LLM prompt |
| `limits.{max_steps,no_progress,time_limit_seconds,tool_calls}` | Safety bounds |
| `sensitive_actions` | Tools that require human confirmation |
| `hooks` | `before_step` / `after_step` / `before_action` / `after_action` / `on_error` |
| `short_memory.{keep,discard,max_records}` | What the agent remembers between steps |
| `cycle.{max_steps,stop_conditions}` | Loop control |
| `planner.{output_format,rules}` | How the LLM must respond |
| `executor.{execution,post_execution}` | Validation, retry, evaluation flags |

## Action vocabulary (planner output)

- `CALL_TOOL` — execute one tool
- `FINISH` — end the cycle
- `ASK_USER` — request information from the user
