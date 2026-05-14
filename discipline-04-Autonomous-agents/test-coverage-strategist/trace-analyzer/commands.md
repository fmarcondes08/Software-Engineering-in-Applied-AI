# commands.md

> Commands available to the operator.

---

## Fields

| Field | Type | Description |
|-------|------|-------------|
| `commands` | list | Available operations. |

---

```yaml
commands:
  - name: run
    description: analyzes the latest trace produced by the runtime
    arguments:
      - name: --agent
        description: path to the trace-analyzer agent
        required: true
      - name: --input
        description: path or name of the trace to analyze (defaults to the last trace)
        required: true
    example: python main.py run --agent ../trace-analyzer --input "analyze last trace"

  - name: trace
    description: prints the analysis trace
    example: python main.py trace
```
