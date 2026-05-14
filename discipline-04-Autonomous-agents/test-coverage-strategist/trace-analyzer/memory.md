# memory.md

> Defines what the agent remembers between steps.
> Short memory: only lives for one execution.

---

## Fields

| Field | Type | Description |
|-------|------|-------------|
| `short_memory.keep` | list | What to keep between steps. |
| `short_memory.discard` | list | What to drop between steps. |
| `final_summary` | object | Configuration of the wrap-up summary. |

---

```yaml
short_memory:
  keep:
    - result of each analysis (health, performance, conformance, anomalies)
    - trace data used as evidence
    - detected issues and anomalies
  discard:
    - internal LLM prompt
    - raw trace data already processed

final_summary:
  fields:
    - analyzed_agent
    - verdict
    - anomalies
    - recommendations
  max_lines: 8
```
