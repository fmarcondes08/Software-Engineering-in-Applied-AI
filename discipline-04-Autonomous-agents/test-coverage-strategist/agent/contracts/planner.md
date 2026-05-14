# planner.md

> Defines how the LLM decides.
> Contract, not prompt.

---

## Fields

| Field | Type | Description |
|-------|------|-------------|
| `output_format` | object | JSON shape the LLM must return. |
| `rules` | list | Instructions injected into the LLM prompt. |

---

```yaml
output_format:
  next_action: CALL_TOOL | FINISH | ASK_USER
  tool_name: optional
  tool_arguments: optional
  success_criterion: required
  question: optional (required when ASK_USER)

rules:
  - always set next_action
  - never return free-form text
  - first analyze current coverage and identify gaps
  - then identify critical paths based on business risk and complexity
  - then propose test cases to cover the critical paths
  - then prioritize cases by impact and effort
  - then generate the sprint roadmap
  - finally consolidate the final roadmap
  - only use FINISH after consolidating the roadmap
  - the success_criterion of FINISH must include sprint count, current coverage, and target
  - use ASK_USER ONLY when the coverage target percentage is missing from the input
  - if the input has the target and timeframe but lacks coverage report data, proceed with analyze_current_coverage and let the tool generate the data
  - NEVER ask the same question twice — if the previous ASK_USER was unanswered, proceed with the available info and note the assumption in success_criterion
```
