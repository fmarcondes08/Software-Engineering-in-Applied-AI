"""
Planner — Perceive and Plan.

Builds the context (perception) and decides the next action via LLM or mock.
Supports modes: task_based, interactive, goal_oriented, autonomous.
Returns token usage alongside the plan so consumption can be tracked.
"""

import json
import os
from pathlib import Path

try:
    from dotenv import load_dotenv
except ImportError:
    def load_dotenv(*a, **kw): pass

from tools import extract_evidence_from_history, build_mock_arguments

load_dotenv(Path(__file__).parent / ".env")

_ZERO_TOKENS = {"prompt": 0, "completion": 0, "total": 0}


def perceive(state: dict) -> str:
    """Builds the current context for the planner."""
    parts = [f"Input: {state['input']}"]

    agent_type = state.get("agent_type", "task_based")
    parts.append(f"Mode: {agent_type}")

    if state.get("event"):
        parts.append(f"Trigger event: {state['event']}")

    for record in state["history"]:
        step = record["step"]
        plan = record.get("plan", {})
        tool_used = plan.get("tool_name", "none")
        if record.get("action_result"):
            parts.append(f"Step {step} [{tool_used}]: {json.dumps(record['action_result'], ensure_ascii=False)}")

    tools_used = list(state["calls_per_tool"].keys())
    if tools_used:
        parts.append(f"Tools already used: {', '.join(tools_used)}")

    parts.append(f"Steps taken: {state['step']}/{state['max_steps']}")
    parts.append(f"Tool calls: {state['tool_calls']}/{state['max_tool_calls']}")

    if state.get("steps_without_progress", 0) > 0:
        parts.append(f"WARNING: {state['steps_without_progress']} consecutive steps without progress")

    return "\n".join(parts)


def build_system_prompt(contracts: dict) -> str:
    """Builds the system prompt from the contracts — domain-agnostic."""
    agent = contracts.get("agent", {})
    agent_name = agent.get("name", "agent")
    agent_description = agent.get("description", "")
    agent_type = agent.get("type", "task_based")

    objective = contracts.get("cycle", {}).get("objective", "unknown")
    steps = contracts.get("cycle", {}).get("steps", [])

    # tool descriptions come from the agent's skills contract
    skills = contracts.get("skills", {}).get("skills", [])
    tools_block = ""
    for skill in skills:
        name = skill.get("name", "")
        description = skill.get("description", "")
        inputs = skill.get("input", {})
        outputs = skill.get("output", {})
        input_text = ", ".join(f"{n}: {t}" for n, t in inputs.items()) if inputs else "none"
        output_text = ", ".join(f"{n}: {t}" for n, t in outputs.items()) if outputs else "none"
        tools_block += f"- {name}: {description}\n  input: {{{input_text}}}\n  output: {{{output_text}}}\n"

    if not tools_block:
        tools_block = "- no tools available\n"

    # planner contract
    planner_contract = contracts.get("planner", {})
    planner_rules = planner_contract.get("rules", [])
    rules_text = "\n".join(f"- {rule}" for rule in planner_rules) if planner_rules else ""

    # agent policies
    policies = contracts.get("rules", {}).get("policies", [])
    policies_text = "\n".join(f"- {policy}" for policy in policies) if policies else ""

    # per-type instructions
    type_instructions = ""
    if agent_type == "interactive":
        type_instructions = """
INTERACTIVE MODE:
- Before acting, clear up ambiguities with the user via ASK_USER
- If critical information is missing, ask before calling any tool
- Always include the "question" field
"""
    elif agent_type == "goal_oriented":
        type_instructions = """
GOAL-ORIENTED MODE:
- Decompose the objective into executable sub-goals
- For each sub-goal, plan which tools to use
- Re-evaluate the plan after each step based on results
"""
    elif agent_type == "autonomous":
        type_instructions = """
AUTONOMOUS MODE:
- Respond to the trigger event provided in the perception
- Operate within the rigid limits defined
- NEVER execute destructive actions without human confirmation
- Prioritize safety over speed
"""

    return f"""You are the planner of an autonomous agent.

Agent: {agent_name} - {agent_description}
Type: {agent_type}
Objective: {objective}

Cycle phases: {' -> '.join(steps) if steps else 'perceive -> plan -> act -> evaluate'}

Available tools:
{tools_block}
Response format (ONLY valid JSON):
{{
  "next_action": "CALL_TOOL" or "FINISH" or "ASK_USER",
  "tool_name": "tool name (required when CALL_TOOL)",
  "tool_arguments": {{}},
  "success_criterion": "what defines success for this step",
  "question": "question for the user (required when ASK_USER)"
}}

CRITICAL: the "next_action" field MUST be EXACTLY one of these three values:
- "CALL_TOOL"   — execute a tool
- "FINISH"      — end the cycle
- "ASK_USER"    — ask the user for information
NEVER put the tool name into next_action. Use "CALL_TOOL" and place the name in "tool_name".

General rules:
- Use each tool at most once unless you need different parameters
- The keys of tool_arguments must match exactly the tool's input fields
- For object-typed fields, use real data collected in previous steps
{type_instructions}
IMPORTANT — Planner rules (you MUST follow ALL of them):
{rules_text}

IMPORTANT — Agent policies (you MUST follow ALL of them):
{policies_text}

ATTENTION: you may NOT use FINISH while any rule or policy above is not satisfied.
If a rule requires calling a tool before finishing, you MUST call it first.
"""


def call_llm(perception: str, contracts: dict, history: list = None) -> tuple:
    """Calls the LLM to decide the next step.

    Returns (plan, token_usage) where token_usage = {prompt, completion, total}.
    """
    api_key = os.environ.get("OPENAI_API_KEY")

    if not api_key:
        return mock_planner(perception, contracts, history or []), _ZERO_TOKENS.copy()

    from openai import OpenAI
    client = OpenAI(api_key=api_key)
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": build_system_prompt(contracts)},
            {"role": "user", "content": perception},
        ],
    )

    token_usage = _ZERO_TOKENS.copy()
    if response.usage:
        token_usage = {
            "prompt": response.usage.prompt_tokens or 0,
            "completion": response.usage.completion_tokens or 0,
            "total": response.usage.total_tokens or 0,
        }

    try:
        plan = json.loads(response.choices[0].message.content)
        return plan, token_usage
    except (json.JSONDecodeError, IndexError):
        return {"next_action": "FINISH", "success_criterion": "LLM response could not be parsed"}, token_usage


def mock_planner(perception: str, contracts: dict, history: list = None) -> dict:
    """Generic mock planner — walks through tools in order."""
    skills = contracts.get("skills", {}).get("skills", [])
    tool_names = [skill["name"] for skill in skills if "name" in skill]
    history = history or []

    # detect agent type: first from perception (CLI), then from contract
    agent_type = "task_based"
    for line in perception.split("\n"):
        if line.startswith("Mode: "):
            agent_type = line.replace("Mode: ", "").strip()
            break
    if agent_type == "task_based":
        agent_type = contracts.get("agent", {}).get("type", "task_based")

    # interactive mode: simulate a question on the first step if no history
    if agent_type == "interactive" and not history:
        return {
            "next_action": "ASK_USER",
            "tool_name": None,
            "tool_arguments": None,
            "success_criterion": "gather initial info from the user",
            "question": "Which service is affected and since when have you observed the alert?",
        }

    # pick the next unused tool
    for name in tool_names:
        if name not in perception:
            skill = next((s for s in skills if s["name"] == name), {})
            arguments = build_mock_arguments(skill, history)
            return {
                "next_action": "CALL_TOOL",
                "tool_name": name,
                "tool_arguments": arguments,
                "success_criterion": f"{name} executed successfully",
            }

    # build a short summary of evidence collected so far
    evidence = extract_evidence_from_history(history)
    summary_parts = []
    for tool_name, data in evidence.items():
        fields = ", ".join(f"{k}={v}" for k, v in data.items() if not k.startswith("_"))
        summary_parts.append(f"[{tool_name}] {fields}")
    summary = " | ".join(summary_parts) if summary_parts else "no evidence"

    return {
        "next_action": "FINISH",
        "tool_name": None,
        "tool_arguments": None,
        "success_criterion": f"Diagnosis: {summary}",
    }
