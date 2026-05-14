"""
Structured Telemetry.

Collects events from the agent cycle and produces four observability streams:
- TELEMETRY_STREAM: cycle events in real time
- AUDIT_LOGS: decisions and actions for auditing
- HEALTH_METRICS: agent health (success rates, stagnation, breakers)
- PERFORMANCE_DATA: timings per phase and token consumption
"""

import time
import uuid
from datetime import datetime


class Telemetry:
    """Structured telemetry collector for a single agent execution."""

    def __init__(self, agent: str, agent_type: str):
        self.trace_id = uuid.uuid4().hex[:12]
        self.agent = agent
        self.agent_type = agent_type
        self.start = time.time()
        self.events = []
        self.phases = []
        self.tokens = {"prompt": 0, "completion": 0, "total": 0}
        self.llm_calls = 0
        self.tools_success = 0
        self.tools_failure = 0
        self.circuit_breaker_triggers = 0
        self.payload_validation_failures = 0

    # --- event recording ---

    def record(self, event_type: str, data: dict = None):
        """Records a generic event in telemetry."""
        self.events.append({
            "timestamp": datetime.now().isoformat(),
            "elapsed_ms": round((time.time() - self.start) * 1000),
            "trace_id": self.trace_id,
            "type": event_type,
            "data": data or {},
        })

    def start_phase(self, phase_name: str, step: int) -> dict:
        """Starts timing a phase. Returns the marker."""
        marker = {
            "phase": phase_name,
            "step": step,
            "start": time.time(),
            "end": None,
            "duration_ms": None,
        }
        return marker

    def end_phase(self, marker: dict):
        """Ends timing a phase and records it."""
        marker["end"] = time.time()
        marker["duration_ms"] = round((marker["end"] - marker["start"]) * 1000, 1)
        self.phases.append(marker)
        self.record("phase_completed", {
            "phase": marker["phase"],
            "step": marker["step"],
            "duration_ms": marker["duration_ms"],
        })

    def record_tokens(self, usage: dict):
        """Accumulates token consumption."""
        self.tokens["prompt"] += usage.get("prompt", 0)
        self.tokens["completion"] += usage.get("completion", 0)
        self.tokens["total"] += usage.get("total", 0)
        self.llm_calls += 1

    def record_tool_result(self, success: bool):
        """Accounts for tool success/failure."""
        if success:
            self.tools_success += 1
        else:
            self.tools_failure += 1

    def record_circuit_breaker(self, reason: str):
        """Records a circuit breaker trigger."""
        self.circuit_breaker_triggers += 1
        self.record("circuit_breaker", {"reason": reason})

    def record_payload_validation_failure(self, tool: str, errors: list):
        """Records a payload validation failure."""
        self.payload_validation_failures += 1
        self.record("payload_validation_failure", {"tool": tool, "errors": errors})

    # --- output streams ---

    def telemetry_stream(self) -> list:
        """Returns all events in timestamp order."""
        return self.events

    def audit_logs(self) -> list:
        """Returns only decision/action events for auditing."""
        audit_types = {
            "plan_generated", "tool_executed", "circuit_breaker",
            "payload_validation_failure", "human_confirmation", "finished",
        }
        return [e for e in self.events if e["type"] in audit_types]

    def health_metrics(self) -> dict:
        """Returns agent health metrics."""
        total_tools = self.tools_success + self.tools_failure
        success_rate = (
            round(self.tools_success / total_tools * 100, 1)
            if total_tools > 0 else 0.0
        )
        return {
            "trace_id": self.trace_id,
            "tool_success_rate": success_rate,
            "tools_success": self.tools_success,
            "tools_failure": self.tools_failure,
            "circuit_breaker_triggers": self.circuit_breaker_triggers,
            "payload_validation_failures": self.payload_validation_failures,
            "llm_calls": self.llm_calls,
        }

    def performance_data(self) -> dict:
        """Returns performance data: per-phase timings and tokens."""
        times_per_phase = {}
        for phase in self.phases:
            name = phase["phase"]
            if name not in times_per_phase:
                times_per_phase[name] = {"total_ms": 0, "count": 0, "max_ms": 0}
            times_per_phase[name]["total_ms"] += phase["duration_ms"]
            times_per_phase[name]["count"] += 1
            if phase["duration_ms"] > times_per_phase[name]["max_ms"]:
                times_per_phase[name]["max_ms"] = phase["duration_ms"]

        for name, data in times_per_phase.items():
            data["avg_ms"] = round(data["total_ms"] / data["count"], 1)

        return {
            "trace_id": self.trace_id,
            "total_time_ms": round((time.time() - self.start) * 1000),
            "tokens": self.tokens,
            "llm_calls": self.llm_calls,
            "phases": times_per_phase,
        }

    def step_kpis(self, step: int) -> dict:
        """Returns plan/act latencies for the given step."""
        latencies = {}
        for phase in self.phases:
            if phase["step"] == step and phase["phase"] in ("plan", "act"):
                latencies[phase["phase"]] = phase["duration_ms"]
        return latencies

    def full_summary(self) -> dict:
        """Returns every consolidated stream for trace.json."""
        return {
            "trace_id": self.trace_id,
            "agent": self.agent,
            "agent_type": self.agent_type,
            "telemetry_stream": self.telemetry_stream(),
            "audit_logs": self.audit_logs(),
            "health_metrics": self.health_metrics(),
            "performance_data": self.performance_data(),
        }
