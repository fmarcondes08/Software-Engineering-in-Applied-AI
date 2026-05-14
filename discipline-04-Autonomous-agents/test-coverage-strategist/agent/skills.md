# skills.md

> Defines the strategist's tools.
> Does not implement them. Defines the interface only.

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
  - name: analyze_current_coverage
    description: analyzes the project's current coverage report and identifies uncovered, partially covered, and untested modules
    input:
      project: string
      coverage_report: object
      target_pct: float
    output:
      current_coverage_pct: float
      uncovered_modules: list
      partial_modules: list
      gap_pct: float

  - name: identify_critical_paths
    description: cross-references uncovered modules with risk signals (churn, sensitive domain, dependencies, historical incidents) and returns the most critical paths
    input:
      uncovered_modules: list
      partial_modules: list
      risk_signals: object
    output:
      critical_paths: list
      risk_ranking: list
      justifications: list

  - name: propose_test_cases
    description: generates test cases (unit, integration, e2e) for each critical path with happy-path and edge scenarios
    input:
      critical_paths: list
      allowed_kinds: list
    output:
      test_cases: list
      scenarios_per_case: list
      estimated_coverage_pct: float

  - name: prioritize_by_risk
    description: orders test cases by impact vs. effort using simplified RICE or a 2x2 matrix
    input:
      test_cases: list
      risk_ranking: list
      constraints: object
    output:
      prioritization: list
      discarded_items: list
      applied_criterion: string

  - name: generate_roadmap
    description: distributes prioritized items across sprints respecting team capacity and dependencies
    input:
      prioritization: list
      sprint_capacity: int
      sprints_count: int
      dependencies: list
    output:
      sprint_roadmap: list
      estimated_gain_pct: float
      execution_risks: list

  - name: consolidate_strategy
    description: assembles the final consolidated artifact with diagnosis, critical paths, proposed cases, prioritization, and roadmap
    input:
      coverage_diagnostic: object
      critical_paths: list
      proposed_test_cases: list
      prioritization: list
      sprint_roadmap: list
    output:
      strategy: object
      summary: string
```
