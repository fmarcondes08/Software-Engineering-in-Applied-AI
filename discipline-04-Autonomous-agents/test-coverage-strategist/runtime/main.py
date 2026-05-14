"""
Runtime CLI — entry point to run any agent.

Usage:
  python main.py run      --agent ../agent --input "alert text"
  python main.py run      --agent ../agent --input "alert" --mode interactive
  python main.py run      --agent ../agent --input "deploy failed" --mode autonomous --event deploy_failed
  python main.py analyze  --agent ../trace-analyzer
  python main.py validate --agent ../agent
  python main.py trace
  python main.py replay   --agent ../agent
"""

import argparse
import io
import sys
import json
from pathlib import Path

# Ensure UTF-8 on stdout/stderr on every OS (handles cp1252 on Windows)
if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

from cycle import run, replay, display_trace
from validator import validate


def _summarize_trace(data: dict) -> str:
    """Extracts a compact trace summary used as input for the analyzer."""
    lines = []
    lines.append(f"TRACE_ID: {data.get('trace_id', '?')}")
    lines.append(f"AGENT: {data.get('agent', '?')}")
    lines.append(f"TYPE: {data.get('agent_type', '?')}")
    lines.append(f"TOTAL_TIME: {data.get('total_time_seconds', 0)}s")
    lines.append(f"TOKENS: {json.dumps(data.get('tokens_consumed', {}))}")

    # per-step summary
    for step in data.get("steps", []):
        num = step.get("step", "?")
        plan = step.get("plan", {})
        action = plan.get("next_action", "?")
        tool = plan.get("tool_name", "-")
        result = step.get("action_result")
        success = result.get("success", False) if result else None
        evaluation = step.get("evaluation", {})
        quality = evaluation.get("quality", "")
        goal = evaluation.get("goal_reached", False)
        reason = evaluation.get("reason", "")
        issues = evaluation.get("output_issues", [])
        lines.append(
            f"STEP {num}: action={action} tool={tool} success={success} "
            f"quality={quality} goal={goal} reason={reason}"
            + (f" issues={issues}" if issues else "")
        )

    # health metrics
    hm = data.get("health_metrics", {})
    if hm:
        lines.append(
            f"HEALTH: success_rate={hm.get('tool_success_rate', 0)}% "
            f"circuit_breaker={hm.get('circuit_breaker_triggers', 0)} "
            f"payload_failures={hm.get('payload_validation_failures', 0)} "
            f"llm_calls={hm.get('llm_calls', 0)}"
        )

    # performance
    perf = data.get("performance_data", {})
    if perf:
        lines.append(f"PERF_TOKENS: {json.dumps(perf.get('tokens', {}))}")
        lines.append(f"PERF_TOTAL_TIME_MS: {perf.get('total_time_ms', 0)}")
        for phase, d in perf.get("phases", {}).items():
            lines.append(
                f"PERF_PHASE {phase}: avg={d['avg_ms']}ms max={d['max_ms']}ms "
                f"total={d['total_ms']}ms count={d['count']}"
            )

    # summary
    if data.get("summary"):
        lines.append(f"SUMMARY: {data['summary']}")

    return "\n".join(lines)


def _generate_md_report(trace_data: dict, analysis_data: dict) -> str:
    """Produces a human-readable Markdown report from the trace and the analysis."""
    agent = trace_data.get("agent", "unknown")
    trace_id = trace_data.get("trace_id", "?")
    agent_type = trace_data.get("agent_type", "?")
    total_time = trace_data.get("total_time_seconds", 0)
    tokens = trace_data.get("tokens_consumed", {})
    hm = trace_data.get("health_metrics", {})
    perf = trace_data.get("performance_data", {})

    # extract tool results from the analyzer run
    results = {}
    for step in analysis_data.get("steps", []):
        plan = step.get("plan", {})
        name = plan.get("tool_name")
        result = step.get("action_result")
        if name and result and result.get("success"):
            results[name] = result.get("data", {})

    health = results.get("analyze_health", {})
    performance = results.get("analyze_performance", {})
    conformance = results.get("analyze_conformance", {})
    anomalies_data = results.get("detect_anomalies", {})
    verdict_data = results.get("generate_verdict", {})

    md = []
    md.append(f"# Execution Analysis: {agent}")
    md.append("")
    md.append(f"- **Trace ID:** {trace_id}")
    md.append(f"- **Type:** {agent_type}")
    md.append(f"- **Total time:** {total_time}s")
    md.append(f"- **Tokens:** {tokens.get('total', 0)} (prompt={tokens.get('prompt', 0)}, completion={tokens.get('completion', 0)})")
    md.append("")

    # steps from the original agent
    trace_steps = trace_data.get("steps", [])
    md.append("## Executed Pipeline")
    md.append("")
    md.append("| Step | Action | Tool | Success | Quality |")
    md.append("|------|--------|------|---------|---------|")
    for st in trace_steps:
        num = st.get("step", "?")
        plan = st.get("plan", {})
        action = plan.get("next_action", "-")
        tool = plan.get("tool_name", "-") or "-"
        res = st.get("action_result")
        succ = res.get("success", "-") if res else "-"
        qual = st.get("evaluation", {}).get("quality", "-") or "-"
        md.append(f"| {num} | {action} | {tool} | {succ} | {qual} |")
    md.append("")

    # health
    md.append("## Health")
    md.append("")
    md.append(f"- **Success rate:** {health.get('success_rate', hm.get('tool_success_rate', '?'))}%")
    md.append(f"- **Circuit breaker:** {health.get('circuit_breaker_triggers', hm.get('circuit_breaker_triggers', 0))} triggers")
    md.append(f"- **Invalid payload:** {health.get('invalid_payload', hm.get('payload_validation_failures', 0))} failures")
    quality_summary = health.get("quality_summary", "")
    if quality_summary:
        md.append(f"- **Quality:** {quality_summary}")
    health_issues = health.get("issues", [])
    if health_issues:
        md.append(f"- **Issues:** {', '.join(str(p) for p in health_issues)}")
    md.append("")

    # performance
    md.append("## Performance")
    md.append("")
    time_pct = performance.get("time_used_pct", "?")
    tokens_pct = performance.get("tokens_used_pct", "?")
    md.append(f"- **Time used:** {time_pct}% of the limit")
    md.append(f"- **Tokens used:** {tokens_pct}% of the limit")
    trend = performance.get("plan_latency_trend", "?")
    md.append(f"- **Plan latency:** trend {trend}")
    act_avg = performance.get("act_latency_avg_ms", "?")
    md.append(f"- **Act latency:** average {act_avg}ms")
    bottlenecks = performance.get("bottlenecks", [])
    if bottlenecks:
        md.append("- **Bottlenecks:**")
        for b in bottlenecks:
            md.append(f"  - {b if isinstance(b, str) else json.dumps(b, ensure_ascii=False)}")
    md.append("")

    # per-phase performance
    phases = perf.get("phases", {})
    if phases:
        md.append("### Per-Phase Breakdown")
        md.append("")
        md.append("| Phase | Avg | Max | Total | Calls |")
        md.append("|-------|-----|-----|-------|-------|")
        for phase, d in phases.items():
            md.append(f"| {phase} | {d['avg_ms']}ms | {d['max_ms']}ms | {d['total_ms']}ms | {d['count']}x |")
        md.append("")

    # conformance
    md.append("## Conformance")
    md.append("")
    required_called = conformance.get("required_tools_called", "?")
    pipeline_complete = conformance.get("pipeline_complete", "?")
    guardrails = conformance.get("guardrails_triggered", 0)
    md.append(f"- **Required tools called:** {required_called}")
    md.append(f"- **Pipeline complete:** {pipeline_complete}")
    md.append(f"- **Guardrails triggered:** {guardrails}")
    violations = conformance.get("violations", [])
    if violations:
        md.append("- **Violations:**")
        for v in violations:
            md.append(f"  - {v if isinstance(v, str) else json.dumps(v, ensure_ascii=False)}")
    md.append("")

    # anomalies
    md.append("## Anomalies")
    md.append("")
    anomalies_list = anomalies_data.get("anomalies", [])
    severity = anomalies_data.get("severity", "?")
    if anomalies_list:
        md.append(f"**Overall severity:** {severity}")
        md.append("")
        for a in anomalies_list:
            if isinstance(a, str):
                md.append(f"- {a}")
            elif isinstance(a, dict):
                desc = a.get("description", json.dumps(a, ensure_ascii=False))
                md.append(f"- {desc}")
            else:
                md.append(f"- {a}")
    else:
        md.append("No anomalies detected.")
    md.append("")

    # verdict
    md.append("## Verdict")
    md.append("")
    verdict_text = verdict_data.get("verdict", "")
    if verdict_text:
        md.append(f"> {verdict_text}")
    else:
        md.append("> Verdict not available.")
    md.append("")

    recommendations = verdict_data.get("recommendations", [])
    if recommendations:
        md.append("### Recommendations")
        md.append("")
        for r in recommendations:
            if isinstance(r, str):
                md.append(f"- {r}")
            elif isinstance(r, dict):
                desc = r.get("description", r.get("recommendation", json.dumps(r, ensure_ascii=False)))
                md.append(f"- {desc}")
            else:
                md.append(f"- {r}")
        md.append("")

    return "\n".join(md)


def main():
    parser = argparse.ArgumentParser(description="Agent Runtime")
    subparsers = parser.add_subparsers(dest="command")

    # run
    parser_run = subparsers.add_parser("run", help="Runs an agent")
    parser_run.add_argument("--agent", required=True, help="Path to the agent folder")
    parser_run.add_argument("--input", required=True, help="Input for the agent")
    parser_run.add_argument("--mode", required=False, help="Operating mode (task_based, interactive, goal_oriented, autonomous)")
    parser_run.add_argument("--event", required=False, help="Trigger event for autonomous mode")

    # validate
    parser_validate = subparsers.add_parser("validate", help="Validates the agent's contracts")
    parser_validate.add_argument("--agent", required=True, help="Path to the agent folder")

    # trace
    subparsers.add_parser("trace", help="Displays the trace of the last run")

    # analyze
    parser_analyze = subparsers.add_parser("analyze", help="Analyzes the last trace using an analyzer agent")
    parser_analyze.add_argument("--agent", required=True, help="Path to the trace-analyzer agent")
    parser_analyze.add_argument("--trace", required=False, help="Path to a trace.json (default: last trace)")

    # replay
    parser_replay = subparsers.add_parser("replay", help="Reruns with the same input as the last run")
    parser_replay.add_argument("--agent", required=True, help="Path to the agent folder")

    args = parser.parse_args()

    if args.command == "run":
        run(
            agent_path=args.agent,
            input_text=args.input,
            mode=args.mode,
            event=args.event,
        )
    elif args.command == "validate":
        validate(agent_path=args.agent)
    elif args.command == "trace":
        display_trace()
    elif args.command == "analyze":
        trace_path = args.trace or str(Path(__file__).parent / "trace.json")
        trace_path = Path(trace_path)
        if not trace_path.exists():
            print(f"Trace not found: {trace_path}")
            print("Run an agent first to generate the trace.")
            return
        trace_data = json.loads(trace_path.read_text(encoding="utf-8"))
        trace_input = _summarize_trace(trace_data)
        analysis_path = str(Path(__file__).parent / "analysis.json")
        run(
            agent_path=args.agent,
            input_text=trace_input,
            output=analysis_path,
        )
        # produce the readable markdown report
        analysis_path_obj = Path(analysis_path)
        if analysis_path_obj.exists():
            analysis_data = json.loads(analysis_path_obj.read_text(encoding="utf-8"))
            report = _generate_md_report(trace_data, analysis_data)
            md_path = Path(__file__).parent / "analysis-agent.md"
            md_path.write_text(report, encoding="utf-8")
            print(f"  Report saved to: {md_path}")
    elif args.command == "replay":
        replay(agent_path=args.agent)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
