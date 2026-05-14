# planner.md

> Defines how the agent decides the next step.
> Output is always structured JSON.

---

## Fields

| Field | Type | Description |
|-------|------|-------------|
| `output_format` | string | Format of the planner response. |
| `fields` | list | Required fields in the response. |
| `rules` | list | Planner constraints. |

---

```yaml
output_format: json

fields:
  - next_action
  - tool_name
  - tool_arguments
  - success_criterion

rules:
  - analyze trace data in this order: health, performance, conformance, anomalies, verdict
  - each tool must receive as input the trace data relevant to it
  - do not call generate_verdict before all 4 prior analyses are available
  - next_action must be exactly CALL_TOOL, FINISH, or ASK_USER
```
