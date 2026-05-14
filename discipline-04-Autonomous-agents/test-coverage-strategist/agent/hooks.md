# hooks.md

> Enables observation and intervention.
> Before. After. On error.

---

## Fields

| Field | Type | Description |
|-------|------|-------------|
| `hooks` | object | Mapping from cycle events to actions. |
| `hooks.before_step` | string | Fires before each cycle step. |
| `hooks.after_step` | string | Fires after each cycle step. |
| `hooks.before_action` | string | Fires before executing a tool. |
| `hooks.after_action` | string | Fires after executing a tool. |
| `hooks.on_error` | string | Fires when a tool returns an error. |

---

```yaml
hooks:
  before_step: log
  after_step: log
  before_action: log
  after_action: log
  on_error: alert
```
