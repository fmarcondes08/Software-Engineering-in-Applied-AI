# agent.md

> Agent identity.
> Analyzes execution traces of any agent and produces a structured diagnosis.

---

## Fields

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Unique agent identifier. |
| `description` | string | What the agent does, in one sentence. |
| `type` | string | Operating mode. |
| `objective` | string | What the agent must achieve. |
| `output_contract` | object | Structure of the final artifact. |

---

```yaml
name: trace-analyzer
description: analyzes the execution trace of any agent and produces a health, performance, and conformance diagnosis
type: task_based

objective: diagnose_execution

output_contract:
  format: json
  required_fields:
    - health
    - performance
    - conformance
    - anomalies
    - verdict
  example:
    health:
      success_rate: 100.0
      circuit_breaker: 0
      invalid_payload: 0
      quality: "6/6 ok, 0 partial, 0 failure"
    performance:
      time_used_pct: 69
      tokens_used_pct: 69
      plan_latency_trend: "growing"
      act_latency_avg_ms: 11412
    conformance:
      required_tools_called: true
      pipeline_complete: true
      guardrails_triggered: 1
    anomalies:
      - "plan latency grew 8x between step 1 and step 6"
    verdict: "healthy run - pipeline complete, zero alerts, tokens within limit"
```
