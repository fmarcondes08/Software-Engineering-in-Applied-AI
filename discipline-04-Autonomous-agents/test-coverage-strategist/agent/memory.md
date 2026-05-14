# memory.md

> Defines the agent's short-term memory.
> What to keep. What to drop.

---

## Fields

| Field | Type | Description |
|-------|------|-------------|
| `short_memory` | object | Configuration of the agent's working memory. |
| `short_memory.keep` | list | Information types retained in history. |
| `short_memory.discard` | list | Information types that should be dropped. |
| `short_memory.max_records` | int | Maximum number of records kept. |
| `final_summary` | object | How the agent should summarize execution when done. |
| `final_summary.max_lines` | int | Maximum number of lines in the final summary. |
| `final_summary.fields` | list | Required fields in the summary. |

---

```yaml
short_memory:
  keep:
    - tool_result
    - planner_decision
    - critical_path_identified
    - test_case_proposed
    - error_encountered
  discard:
    - full_system_prompt
    - internal_mock_arguments
    - repeated_input_data
  max_records: 20

final_summary:
  max_lines: 5
  fields:
    - objective
    - current_coverage_vs_target
    - proposed_cases_count
    - planned_sprints
    - next_steps
```
