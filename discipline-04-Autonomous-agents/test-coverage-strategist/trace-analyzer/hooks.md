# hooks.md

> Declares automatic actions at cycle moments.
> Does not implement logic — only declares it.

---

## Fields

| Field | Type | Description |
|-------|------|-------------|
| `hooks` | object | Mapping from cycle events to actions. |

---

```yaml
hooks:
  before_step: log
  after_step: log
  before_action: log
  after_action: log
  on_error: alert
```
