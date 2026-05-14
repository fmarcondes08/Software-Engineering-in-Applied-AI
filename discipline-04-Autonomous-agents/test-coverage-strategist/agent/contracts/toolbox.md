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
  - name: analyze_current_coverage
    input:
      project: string
      coverage_report: object
      target_pct: float

  - name: identify_critical_paths
    input:
      uncovered_modules: list
      partial_modules: list
      risk_signals: object

  - name: propose_test_cases
    input:
      critical_paths: list
      allowed_kinds: list

  - name: prioritize_by_risk
    input:
      test_cases: list
      risk_ranking: list
      constraints: object

  - name: generate_roadmap
    input:
      prioritization: list
      sprint_capacity: int
      sprints_count: int
      dependencies: list

  - name: consolidate_strategy
    input:
      coverage_diagnostic: object
      critical_paths: list
      proposed_test_cases: list
      prioritization: list
      sprint_roadmap: list
```
