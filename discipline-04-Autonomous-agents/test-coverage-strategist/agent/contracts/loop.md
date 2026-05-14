# loop.md

> Defines how the agent runs in a cycle.

---

## Fields

| Field | Type | Description |
|-------|------|-------------|
| `objective` | string | What the agent must achieve. |
| `cycle.max_steps` | int | Maximum number of cycle iterations. |
| `stop_conditions` | list | Conditions that end the cycle. |

---

```yaml
objective: generate_test_roadmap

cycle:
  max_steps: 12

stop_conditions:
  - goal_reached
  - max_steps_exceeded
  - no_progress
  - time_limit_exceeded
  - human_confirmation_denied
```
