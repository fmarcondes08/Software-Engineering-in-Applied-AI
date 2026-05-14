# loop.md

> Defines how the agent runs in a cycle.
> Controls the entire loop.

---

## Fields

| Field | Type | Description |
|-------|------|-------------|
| `objective` | string | What the agent must achieve. |
| `cycle.max_steps` | int | Maximum number of iterations. |
| `stop_conditions` | list | Conditions that end the cycle. |

---

```yaml
objective: diagnose_execution

cycle:
  max_steps: 8

stop_conditions:
  - goal_reached
  - max_steps_exceeded
  - no_progress
  - time_limit_exceeded
```
