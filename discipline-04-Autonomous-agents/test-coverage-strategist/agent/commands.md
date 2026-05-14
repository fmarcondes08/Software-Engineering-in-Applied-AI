# commands.md

> Execution shortcuts for the agent.
> Paths are relative to `runtime/` — run them from inside `runtime/`.

---

```bash
# 0) enter the runtime
cd modulo04-agentes-autonomos/test-coverage-strategist/runtime

# 1) install dependencies (once)
pip install -r requirements.txt

# 2) (optional) configure OpenAI to use a real LLM
echo "OPENAI_API_KEY=sk-..." > .env

# 3) validate the 9 contracts
python main.py validate --agent ../agent

# 4) run with a coverage objective
python main.py run --agent ../agent \
  --input "raise the payment service coverage from 42% to 80% in 3 sprints"

# 5) interactive mode (asks for the target if missing)
python main.py run --agent ../agent \
  --input "improve coverage of the auth module" \
  --mode interactive

# 6) inspect the trace of the last run
python main.py trace

# 7) diagnose with the trace-analyzer (produces analysis-agent.md)
python main.py analyze --agent ../trace-analyzer
```
