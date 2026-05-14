"""
Agent Cycle and Trace.

Orchestrates the main loop: perceive -> plan -> act -> evaluate.
Saves and prints the execution trace.
Supports 4 modes: task_based, interactive, goal_oriented, autonomous.

Implements:
- Circuit breaker between planning and execution
- Tool payload validation
- Token consumption control
- Structured telemetry with trace IDs and per-phase timing
"""

import json
import time
from pathlib import Path

from contracts import load_contracts, create_state
from executor import evaluate, execute, execute_hook, validate_payload
from tools import build_tools_from_contracts, build_mock_arguments
from planner import call_llm, perceive
from telemetry import Telemetry


def display_kpis(state: dict, tel, start: float, contracts: dict):
    """Prints a compact KPI panel at the end of each loop step."""
    max_steps = state["max_steps"]
    max_calls = state["max_tool_calls"]
    max_tokens = state.get("max_tokens", 50000)
    time_limit = state.get("time_limit_seconds", 120)

    step = state["step"]
    calls = state["tool_calls"]
    tokens_total = state["tokens_consumed"]["total"]
    elapsed = round(time.time() - start, 1)

    # tokens visual bar
    pct_tokens = tokens_total / max_tokens if max_tokens > 0 else 0
    filled_blocks = int(pct_tokens * 10)
    bar = "▓" * filled_blocks + "░" * (10 - filled_blocks)
    pct_str = f"{pct_tokens * 100:.1f}%"

    # tools: called vs pending
    skills = contracts.get("skills", {}).get("skills", [])
    required = set(contracts.get("rules", {}).get("required_tools", []))
    tool_names = [s["name"] for s in skills]
    tool_parts = []
    for name in tool_names:
        if name in state["calls_per_tool"]:
            tool_parts.append(f"✓{name}")
        elif name in required:
            tool_parts.append(f"!{name}")
        else:
            tool_parts.append(f"○{name}")
    tools_text = " ".join(tool_parts)

    # quality: count by type in history
    ok = partial = failure = 0
    for h in state["history"]:
        q = h.get("evaluation", {}).get("quality", "")
        if q == "complete":
            ok += 1
        elif q == "partial":
            partial += 1
        elif q == "failure":
            failure += 1

    # alerts
    cb = tel.circuit_breaker_triggers
    pv = tel.payload_validation_failures

    # latency of current step
    lat = tel.step_kpis(step)
    lat_parts = [f"{phase}={int(ms)}ms" for phase, ms in lat.items()]
    lat_text = "  ".join(lat_parts) if lat_parts else "-"

    # panel
    width = 58
    print(f"\n  ┌─ KPIs {'_' * (width - 8)}┐")
    print(f"  │ Progress:  {step}/{max_steps} steps    {calls}/{max_calls} calls    {elapsed}s/{time_limit}s")
    print(f"  │ Tokens:    {tokens_total}/{max_tokens} ({pct_str})  {bar}")
    print(f"  │ Tools:     {tools_text}")
    print(f"  │ Quality:   {ok}/{ok + partial + failure} ok   {partial} partial   {failure} failure")
    print(f"  │ Alerts:    {cb} circuit_breaker   {pv} invalid_payload")
    print(f"  │ Latency:   {lat_text}")
    print(f"  └{'_' * width}┘")


def check_no_progress(state: dict, tool_name: str) -> bool:
    """Detects stagnation: same tool called N times in a row."""
    if tool_name == state.get("last_tool"):
        state["steps_without_progress"] += 1
    else:
        state["steps_without_progress"] = 0
    state["last_tool"] = tool_name

    limit = state.get("no_progress", 3)
    return state["steps_without_progress"] >= limit


def check_time(state: dict, start: float) -> bool:
    """Checks whether the time limit was exceeded."""
    limit = state.get("time_limit_seconds", 120)
    return (time.time() - start) >= limit


def ask_human_confirmation(tool_name: str) -> bool:
    """Asks the operator to confirm a sensitive action."""
    print(f"\n  [HUMAN CONFIRMATION] Tool '{tool_name}' requires authorization.")
    try:
        answer = input(f"  Authorize execution of '{tool_name}'? (y/n): ").strip().lower()
        return answer in ("y", "yes")
    except EOFError:
        print("  [HUMAN CONFIRMATION] no input available - denying for safety")
        return False


def accumulate_tokens(state: dict, token_usage: dict):
    """Accumulates token consumption into state."""
    for key in ("prompt", "completion", "total"):
        state["tokens_consumed"][key] += token_usage.get(key, 0)


def check_token_limit(state: dict) -> bool:
    """Checks whether the token limit was exceeded."""
    return state["tokens_consumed"]["total"] >= state.get("max_tokens", 50000)


# --- Gap 2: Circuit Breaker ---

_VALID_ACTIONS = {"CALL_TOOL", "FINISH", "ASK_USER"}


def validate_llm_response(plan: dict, available_tools: set) -> list:
    """Circuit breaker: validates the LLM response before handing it to the executor.

    Returns a list of issues. Empty list = valid response.
    """
    issues = []

    if not isinstance(plan, dict):
        return ["LLM response is not a valid dict"]

    next_action = plan.get("next_action")
    if not next_action:
        issues.append("'next_action' field missing in LLM response")
    elif next_action not in _VALID_ACTIONS:
        issues.append(f"next_action '{next_action}' is invalid (valid: {', '.join(_VALID_ACTIONS)})")

    if next_action == "CALL_TOOL":
        name = plan.get("tool_name")
        if not name:
            issues.append("CALL_TOOL without 'tool_name'")
        elif name not in available_tools:
            issues.append(f"tool '{name}' does not exist (available: {', '.join(available_tools)})")

        args = plan.get("tool_arguments")
        if args is not None and not isinstance(args, dict):
            issues.append(f"tool_arguments must be a dict, got {type(args).__name__}")

    if next_action == "ASK_USER":
        if not plan.get("question"):
            issues.append("ASK_USER without 'question' field")

    return issues


def generate_final_summary(state: dict, contracts: dict) -> str:
    """Generates the final execution summary as configured by memory.md."""
    memory_config = contracts.get("memory", {})
    summary_config = memory_config.get("final_summary", {})
    max_lines = summary_config.get("max_lines", 5)

    tools_called = list(state["calls_per_tool"].keys())
    lines = [
        f"Objective: {state['objective']}",
        f"Steps executed: {state['step']}",
        f"Tools called: {', '.join(tools_called) if tools_called else 'none'}",
        f"Result: {state['result'] or 'max_steps_exceeded'}",
        f"Type: {state.get('agent_type', 'task_based')}",
    ]
    return "\n".join(lines[:max_lines])


def run(agent_path: str, input_text: str, mode: str = None, event: str = None, output: str = None) -> dict:
    """Runs the full agent cycle."""
    agent_path = Path(agent_path).resolve()
    contracts = load_contracts(agent_path)
    state = create_state(contracts, input_text, mode=mode, event=event)
    tools = build_tools_from_contracts(contracts)
    hooks_contract = contracts.get("hooks", {})
    start = time.time()

    agent_type = state.get("agent_type", "task_based")

    # initialize telemetry
    tel = Telemetry(agent=agent_path.name, agent_type=agent_type)
    tel.record("start", {
        "input": state["input"],
        "objective": state["objective"],
        "max_steps": state["max_steps"],
        "max_tokens": state.get("max_tokens", 50000),
    })

    print(f"\n{'='*60}")
    print(f"  Agent: {agent_path.name}")
    print(f"  Trace ID: {tel.trace_id}")
    print(f"  Type: {agent_type}")
    print(f"  Objective: {state['objective']}")
    print(f"  Input: {state['input']}")
    if state.get("event"):
        print(f"  Event: {state['event']}")
    print(f"  Max steps: {state['max_steps']}")
    print(f"  Time limit: {state['time_limit_seconds']}s")
    print(f"  Token limit: {state.get('max_tokens', 50000)}")
    print(f"  Tools: {', '.join(tools.keys())}")
    print(f"{'='*60}\n")

    available_tool_names = set(tools.keys())

    while not state["done"] and state["step"] < state["max_steps"]:
        state["step"] += 1

        # before step hook
        execute_hook("before_step", hooks_contract, step=state["step"])
        print(f"--- Step {state['step']} ---")

        # time limit check
        if check_time(state, start):
            print(f"  [rules] time limit exceeded ({state['time_limit_seconds']}s)")
            tel.record("time_limit_exceeded", {"seconds": state["time_limit_seconds"]})
            state["done"] = True
            state["result"] = "ended by time limit"
            break

        # token limit check
        if check_token_limit(state):
            print(f"  [rules] token limit exceeded ({state['tokens_consumed']['total']}/{state['max_tokens']})")
            tel.record("token_limit_exceeded", state["tokens_consumed"])
            state["done"] = True
            state["result"] = f"ended by token limit ({state['tokens_consumed']['total']})"
            break

        # --- PHASE: PERCEIVE ---
        perceive_marker = tel.start_phase("perceive", state["step"])
        perception = perceive(state)
        tel.end_phase(perceive_marker)
        print(f"  [perceive] context built ({perceive_marker['duration_ms']}ms)")

        # --- PHASE: PLAN ---
        plan_marker = tel.start_phase("plan", state["step"])
        plan, plan_tokens = call_llm(perception, contracts, state["history"])
        tel.end_phase(plan_marker)

        # accumulate planner tokens
        accumulate_tokens(state, plan_tokens)
        tel.record_tokens(plan_tokens)

        print(f"  [plan] next_action={plan.get('next_action')} tool={plan.get('tool_name')} ({plan_marker['duration_ms']}ms, tokens={plan_tokens['total']})")

        # --- CIRCUIT BREAKER: validate the LLM response before proceeding ---
        llm_issues = validate_llm_response(plan, available_tool_names)
        if llm_issues:
            tel.record_circuit_breaker("; ".join(llm_issues))
            print(f"  [circuit_breaker] LLM response rejected: {'; '.join(llm_issues)}")

            # auto-correction: invalid action but tool_name is valid
            plan_name = plan.get("tool_name") or plan.get("next_action")
            if (
                any("invalid" in i for i in llm_issues)
                and plan_name in available_tool_names
            ):
                plan["next_action"] = "CALL_TOOL"
                plan["tool_name"] = plan_name
                print(f"  [circuit_breaker] auto-correction: next_action -> CALL_TOOL, tool={plan_name}")

            # fallback: tool does not exist, redirect to next unused
            elif any("does not exist" in i for i in llm_issues):
                skills = contracts.get("skills", {}).get("skills", [])
                fallback_tool = next(
                    (s["name"] for s in skills
                     if s.get("name") in available_tool_names
                     and s["name"] not in state["calls_per_tool"]),
                    None,
                )
                if fallback_tool:
                    fallback_skill = next(s for s in skills if s["name"] == fallback_tool)
                    plan = {
                        "next_action": "CALL_TOOL",
                        "tool_name": fallback_tool,
                        "tool_arguments": build_mock_arguments(fallback_skill, state["history"]),
                        "success_criterion": f"fallback after circuit breaker: {fallback_tool}",
                    }
                    print(f"  [circuit_breaker] redirecting to fallback: {fallback_tool}")
                else:
                    state["done"] = True
                    state["result"] = f"ended by circuit breaker: {'; '.join(llm_issues)}"
                    break
            else:
                state["done"] = True
                state["result"] = f"ended by circuit breaker: {'; '.join(llm_issues)}"
                break

        tel.record("plan_generated", {
            "next_action": plan.get("next_action"),
            "tool_name": plan.get("tool_name"),
            "success_criterion": plan.get("success_criterion"),
        })

        # interactive mode: handle ASK_USER
        if plan.get("next_action") == "ASK_USER":
            question = plan.get("question", "I need more information.")
            print(f"\n  [interactive] {question}")

            if agent_type == "interactive":
                try:
                    user_answer = input("  > Your answer: ").strip()
                except EOFError:
                    user_answer = "(no input available)"
                    print(f"  [interactive] {user_answer}")
            else:
                user_answer = "(non-interactive mode: no user answer)"
                print(f"  [interactive] {user_answer}")

            state["history"].append({
                "step": state["step"],
                "perception": perception,
                "plan": plan,
                "action_result": {"success": True, "data": {"user_answer": user_answer}},
                "evaluation": {"goal_reached": False, "reason": "waiting for user response"},
            })

            execute_hook("after_step", hooks_contract, step=state["step"], action="user_question")
            continue

        # enforce required tools before allowing FINISH
        if plan.get("next_action") == "FINISH":
            required = contracts.get("rules", {}).get("required_tools", [])
            missing = [
                req_name for req_name in required
                if req_name not in state["calls_per_tool"]
            ]
            if missing:
                print(f"  [rules] required tools pending: {', '.join(missing)}")
                skills = contracts.get("skills", {}).get("skills", [])
                missing_skill = next(
                    (s for s in skills if s.get("name") == missing[0]),
                    {},
                )
                plan = {
                    "next_action": "CALL_TOOL",
                    "tool_name": missing[0],
                    "tool_arguments": build_mock_arguments(missing_skill, state["history"]),
                    "success_criterion": f"{missing[0]} required before finishing",
                }
                print(f"  [rules] redirecting to: {missing[0]}")

        # --- PHASE: ACT ---
        action_result = None
        if plan.get("next_action") == "CALL_TOOL" and plan.get("tool_name"):
            tool_name = plan["tool_name"]

            if state["tool_calls"] >= state["max_tool_calls"]:
                print(f"  [rules] total tool-call limit reached ({state['max_tool_calls']})")
                state["done"] = True
                state["result"] = "ended by total tool-call limit"
                break

            calls_for_this_tool = state["calls_per_tool"].get(tool_name, 0)
            limit_for_this_tool = state["per_tool_limits"].get(tool_name)
            if limit_for_this_tool and calls_for_this_tool >= limit_for_this_tool:
                print(f"  [rules] {tool_name} call limit reached ({limit_for_this_tool})")
                state["done"] = True
                state["result"] = f"ended by {tool_name} call limit"
                break

            # detect stagnation
            if check_no_progress(state, tool_name):
                print(f"  [rules] no progress detected - {state['no_progress']} consecutive calls to '{tool_name}'")
                state["done"] = True
                state["result"] = f"ended by stagnation (repeated tool: {tool_name})"
                break

            # sensitive-action check (human_required)
            if tool_name in state.get("sensitive_actions", []):
                tel.record("human_confirmation", {"tool": tool_name})
                if not ask_human_confirmation(tool_name):
                    print(f"  [rules] operator denied execution of '{tool_name}'")
                    state["done"] = True
                    state["result"] = f"ended by human denial ({tool_name})"
                    break

            # --- PAYLOAD VALIDATION (Gap 1) ---
            validate_marker = tel.start_phase("validate_payload", state["step"])
            payload_errors = validate_payload(tool_name, plan.get("tool_arguments"), contracts)
            tel.end_phase(validate_marker)

            if payload_errors:
                tel.record_payload_validation_failure(tool_name, payload_errors)
                print(f"  [payload_validation] {'; '.join(payload_errors)}")
                # do not block — record and proceed (graceful degradation)

            # --- EXECUTION ---
            act_marker = tel.start_phase("act", state["step"])
            execute_hook("before_action", hooks_contract, tool=tool_name)
            action_result = execute(tool_name, plan.get("tool_arguments"), tools, contracts)
            tel.end_phase(act_marker)

            state["tool_calls"] += 1
            state["calls_per_tool"][tool_name] = calls_for_this_tool + 1

            # accumulate tokens from the tool (if it used LLM)
            tool_tokens = action_result.pop("_tokens", {})
            if tool_tokens:
                accumulate_tokens(state, tool_tokens)
                tel.record_tokens(tool_tokens)

            success = action_result.get("success", False)
            tel.record_tool_result(success)
            tel.record("tool_executed", {
                "tool": tool_name,
                "success": success,
                "duration_ms": act_marker["duration_ms"],
                "tokens": tool_tokens.get("total", 0),
            })

            execute_hook("after_action", hooks_contract, success=success)

            if not success:
                execute_hook("on_error", hooks_contract, error=action_result.get("error", ""))

            print(f"  [act] result={json.dumps(action_result, ensure_ascii=False)[:100]} ({act_marker['duration_ms']}ms)")

        # --- PHASE: EVALUATE (Gap 4) ---
        evaluate_marker = tel.start_phase("evaluate", state["step"])
        evaluation = evaluate(plan, action_result, contracts)
        tel.end_phase(evaluate_marker)

        quality = evaluation.get("quality", "")
        output_issues = evaluation.get("output_issues", [])
        if output_issues:
            print(f"  [evaluate] quality={quality} issues={output_issues}")

        print(f"  [evaluate] goal_reached={evaluation['goal_reached']} - {evaluation['reason']} ({evaluate_marker['duration_ms']}ms)")

        # update history
        state["history"].append({
            "step": state["step"],
            "perception": perception,
            "plan": plan,
            "action_result": action_result,
            "evaluation": evaluation,
        })

        if evaluation["goal_reached"]:
            state["done"] = True
            state["result"] = evaluation["reason"]

        # after step hook
        execute_hook("after_step", hooks_contract, step=state["step"], done=state["done"])

        # real-time KPI panel
        display_kpis(state, tel, start, contracts)

    # record finalization
    tel.record("finished", {
        "steps": state["step"],
        "result": state["result"] or "max_steps_exceeded",
        "tokens_total": state["tokens_consumed"]["total"],
    })

    # final summary
    total_time = round(time.time() - start, 2)
    summary = generate_final_summary(state, contracts)

    print(f"\n{'='*60}")
    print(f"  Trace ID: {tel.trace_id}")
    print(f"  Finished in {state['step']} steps ({total_time}s)")
    print(f"  Tool calls: {state['tool_calls']}")
    print(f"  Tokens consumed: {state['tokens_consumed']['total']} (prompt={state['tokens_consumed']['prompt']}, completion={state['tokens_consumed']['completion']})")
    print(f"  Result: {state['result'] or 'max_steps_exceeded'}")

    metrics = tel.health_metrics()
    print(f"\n  --- Health Metrics ---")
    print(f"  Tool success rate: {metrics['tool_success_rate']}%")
    print(f"  Circuit breaker triggers: {metrics['circuit_breaker_triggers']}")
    print(f"  Payload validation failures: {metrics['payload_validation_failures']}")
    print(f"  LLM calls: {metrics['llm_calls']}")

    perf = tel.performance_data()
    print(f"\n  --- Performance per Phase ---")
    for phase_name, phase_data in perf["phases"].items():
        print(f"  {phase_name}: avg={phase_data['avg_ms']}ms max={phase_data['max_ms']}ms total={phase_data['total_ms']}ms ({phase_data['count']}x)")

    print(f"\n  --- Summary ---")
    for line in summary.split("\n"):
        print(f"  {line}")
    print(f"{'='*60}\n")

    # save trace with full telemetry
    trace_data = {
        "trace_id": tel.trace_id,
        "agent_type": state.get("agent_type", "task_based"),
        "input": state["input"],
        "event": state.get("event"),
        "total_time_seconds": total_time,
        "tokens_consumed": state["tokens_consumed"],
        "steps": state["history"],
        "summary": summary,
        **tel.full_summary(),
    }

    trace_path = Path(output) if output else Path(__file__).parent / "trace.json"
    trace_path.write_text(
        json.dumps(trace_data, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    print(f"  Trace saved to: {trace_path}")

    return state


def replay(agent_path: str) -> dict:
    """Replays the agent with the same input as the last run."""
    trace_path = Path(__file__).parent / "trace.json"

    if not trace_path.exists():
        print("No trace found. Run the agent first.")
        return {}

    data = json.loads(trace_path.read_text(encoding="utf-8"))

    input_text = data.get("input")
    agent_type = data.get("agent_type")
    event = data.get("event")

    if not input_text:
        print("Trace does not contain input. Cannot replay.")
        return {}

    print(f"  [replay] rerunning with input: {input_text}")
    if agent_type:
        print(f"  [replay] type: {agent_type}")
    if event:
        print(f"  [replay] event: {event}")

    return run(agent_path, input_text, mode=agent_type, event=event)


def display_trace():
    """Prints the trace of the last run."""
    trace_path = Path(__file__).parent / "trace.json"

    if not trace_path.exists():
        print("No trace found. Run the agent first.")
        return

    data = json.loads(trace_path.read_text(encoding="utf-8"))

    # supports legacy list format and the new dict-with-metadata format
    if isinstance(data, list):
        history = data
        metadata = {}
    else:
        history = data.get("steps", [])
        metadata = data

    print(f"\n{'='*60}")
    print("  TRACE — last run")
    if metadata.get("trace_id"):
        print(f"  Trace ID: {metadata['trace_id']}")
    if metadata.get("agent_type"):
        print(f"  Type: {metadata['agent_type']}")
    if metadata.get("input"):
        print(f"  Input: {metadata['input']}")
    if metadata.get("total_time_seconds"):
        print(f"  Time: {metadata['total_time_seconds']}s")
    if metadata.get("tokens_consumed"):
        tokens = metadata["tokens_consumed"]
        print(f"  Tokens: {tokens.get('total', 0)} (prompt={tokens.get('prompt', 0)}, completion={tokens.get('completion', 0)})")
    print(f"{'='*60}\n")

    for record in history:
        step = record["step"]
        plan = record.get("plan", {})
        result = record.get("action_result")
        evaluation = record.get("evaluation", {})

        print(f"Step {step}")
        print(f"  plan      : {plan.get('next_action')} -> {plan.get('tool_name', '-')}")
        print(f"  criterion : {plan.get('success_criterion', '-')}")
        if result:
            status = "ok" if result.get("success") else "failure"
            print(f"  action    : {status} - {json.dumps(result.get('data', result.get('error', '')), ensure_ascii=False)[:80]}")
        quality = evaluation.get("quality", "")
        print(f"  evaluation: goal_reached={evaluation.get('goal_reached')}{f' quality={quality}' if quality else ''}")
        print()

    if metadata.get("health_metrics"):
        metrics = metadata["health_metrics"]
        print("--- Health Metrics ---")
        print(f"  Success rate: {metrics.get('tool_success_rate', 0)}%")
        print(f"  Circuit breaker: {metrics.get('circuit_breaker_triggers', 0)}")
        print(f"  Payload failures: {metrics.get('payload_validation_failures', 0)}")
        print()

    if metadata.get("performance_data"):
        perf = metadata["performance_data"]
        print("--- Performance ---")
        print(f"  Tokens: {perf.get('tokens', {})}")
        print(f"  LLM calls: {perf.get('llm_calls', 0)}")
        for phase_name, phase_data in perf.get("phases", {}).items():
            print(f"  {phase_name}: avg={phase_data['avg_ms']}ms max={phase_data['max_ms']}ms")
        print()

    if metadata.get("summary"):
        print("--- Summary ---")
        print(metadata["summary"])
        print()
