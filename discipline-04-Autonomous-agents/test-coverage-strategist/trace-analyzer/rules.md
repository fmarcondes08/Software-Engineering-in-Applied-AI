# rules.md

> Protects the system.
> Prevents infinite loops.
> Defines safe behavior.

---

## Fields

| Field | Type | Description |
|-------|------|-------------|
| `required_tools` | list | Tools that must be called before FINISH. |
| `limits.max_steps` | int | Maximum number of cycle iterations. |
| `limits.no_progress` | int | Consecutive no-progress steps before stopping. |
| `limits.time_limit_seconds` | int | Maximum execution time. |
| `limits.tool_calls` | object | Per-tool and total call limits. |
| `sensitive_actions` | list | Tools that require human confirmation. |
| `policies` | list | Rules injected into the LLM prompt. |

---

```yaml
required_tools:
  - analyze_health
  - analyze_performance
  - analyze_conformance
  - detect_anomalies
  - generate_verdict

limits:
  max_steps: 8
  no_progress: 3
  time_limit_seconds: 180
  max_tokens: 100000
  tool_calls:
    analyze_health: 1
    analyze_performance: 1
    analyze_conformance: 1
    detect_anomalies: 1
    generate_verdict: 1
    total: 5

sensitive_actions: []

policies:
  - always analyze health before performance
  - always analyze conformance before detecting anomalies
  - generate_verdict is mandatory and can only be called after the previous 4 analyses
  - anomalies must be specific and cite steps, values, and thresholds
  - the verdict must be objective and actionable, free of generic jargon
  - never invent data that is not in the trace
  - if the trace lacks data for an analysis, record it as "insufficient data" instead of inferring
  - recommendations must indicate whether the fix is in the runtime or in the agent contracts
```
