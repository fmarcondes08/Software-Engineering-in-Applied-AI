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
| `limits.time_limit_seconds` | int | Maximum execution time, in seconds. |
| `limits.tool_calls` | object | Per-tool and total call limits. |
| `sensitive_actions` | list | Tools that require human confirmation. |
| `policies` | list | Rules injected into the LLM prompt as plain text. |

---

```yaml
required_tools:
  - consolidate_strategy

limits:
  max_steps: 12
  no_progress: 3
  time_limit_seconds: 360
  tool_calls:
    analyze_current_coverage: 2
    identify_critical_paths: 2
    propose_test_cases: 2
    prioritize_by_risk: 2
    generate_roadmap: 2
    consolidate_strategy: 1
    total: 11

sensitive_actions: []

policies:
  - always analyze current coverage before identifying critical paths
  - critical paths must be justified by signals (churn, sensitive domain, incidents, external dependencies)
  - test cases must explicitly list happy-path AND edge-case scenarios
  - prioritization must use an explicit criterion (RICE, impact/effort matrix, or risk/effort) and record which one
  - every prioritized item must have a stable id so it can be referenced by the roadmap
  - the roadmap must respect sprint capacity and declared dependencies
  - consolidate_strategy is mandatory before finishing
  - consolidate_strategy can only be called after diagnosis, critical paths, cases, prioritization, and roadmap
  - never promise a specific coverage number without showing the estimated gain per sprint
  - if the coverage target is not reachable within the given number of sprints, record it as a limitation in the summary
  - never invent modules that did not appear in the coverage report
```
