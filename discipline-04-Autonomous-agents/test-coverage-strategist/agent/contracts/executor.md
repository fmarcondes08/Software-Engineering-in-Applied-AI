# executor.md

> Defines how to execute.
> It's not just calling a tool.
> It's validating and interpreting the result.

---

## Fields

| Field | Type | Description |
|-------|------|-------------|
| `execution.validate_input` | bool | If `true`, the runtime checks that the tool exists before executing. |
| `execution.retry_on_failure` | bool | If `true`, the runtime retries the tool once if the first call raises an exception. |
| `post_execution.evaluate_result` | bool | If `true`, the tool result is passed through the evaluate function. |

---

```yaml
execution:
  validate_input: true
  retry_on_failure: true

post_execution:
  evaluate_result: true
```
