# executor.md

> Defines how the agent executes actions.
> Validate before, execute, evaluate after.

---

## Fields

| Field | Type | Description |
|-------|------|-------------|
| `execution.validate_input` | bool | Check that the tool exists before executing. |
| `execution.retry_on_failure` | bool | Retry once if the first execution fails. |
| `execution.evaluate_result` | bool | Evaluate whether the step's goal was met. |

---

```yaml
execution:
  validate_input: true
  retry_on_failure: false
  evaluate_result: true
```
