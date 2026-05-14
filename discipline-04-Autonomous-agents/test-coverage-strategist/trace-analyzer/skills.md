# skills.md

> Defines the analyzer's tools.
> Does not implement them — interface only.

---

## Fields

| Field | Type | Description |
|-------|------|-------------|
| `skills` | list | Tools the agent knows how to use. |
| `skills[].name` | string | Unique tool identifier. |
| `skills[].description` | string | When and why to use this tool. |
| `skills[].input` | object | Input parameters (key: type). |
| `skills[].output` | object | Returned fields (key: type). |

---

```yaml
skills:
  - name: analyze_health
    description: analyzes the trace health metrics — success rate, circuit breaker, invalid payload, evaluation quality
    input:
      health_metrics: object
      steps: list
    output:
      success_rate: float
      circuit_breaker_triggers: int
      invalid_payload: int
      quality_summary: string
      issues: list

  - name: analyze_performance
    description: analyzes temporal performance — total time vs limit, tokens vs limit, per-phase latency trend, bottlenecks
    input:
      performance_data: object
      total_time_seconds: float
      tokens_consumed: object
    output:
      time_used_pct: float
      tokens_used_pct: float
      plan_latency_trend: string
      act_latency_avg_ms: float
      bottlenecks: list

  - name: analyze_conformance
    description: verifies whether the agent followed its contracts — required tools, complete pipeline, limits respected, guardrails triggered
    input:
      steps: list
      health_metrics: object
      expected_tools: list
    output:
      required_tools_called: bool
      pipeline_complete: bool
      guardrails_triggered: int
      violations: list

  - name: detect_anomalies
    description: identifies anomalous patterns — growing latency, unproductive steps, unanswered questions in non-interactive mode, premature finish
    input:
      steps: list
      performance_data: object
      agent_type: string
    output:
      anomalies: list
      severity: string

  - name: generate_verdict
    description: consolidates all previous analyses and produces a final verdict with actionable recommendations
    input:
      health: object
      performance: object
      conformance: object
      anomalies: list
    output:
      verdict: string
      recommendations: list
```
