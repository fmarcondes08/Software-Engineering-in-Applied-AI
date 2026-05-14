# toolbox.md

> Defines what the agent is allowed to do.
> If it's not here, the agent cannot run it.

---

## Fields

| Field | Type | Description |
|-------|------|-------------|
| `tools` | list | Available tools. |
| `tools[].name` | string | Tool identifier. |
| `tools[].input` | object | Accepted parameters. |

---

```yaml
tools:
  - name: analyze_health
    input:
      health_metrics: object
      steps: list

  - name: analyze_performance
    input:
      performance_data: object
      total_time_seconds: float
      tokens_consumed: object

  - name: analyze_conformance
    input:
      steps: list
      health_metrics: object
      expected_tools: list

  - name: detect_anomalies
    input:
      steps: list
      performance_data: object
      agent_type: string

  - name: generate_verdict
    input:
      health: object
      performance: object
      conformance: object
      anomalies: list
```
