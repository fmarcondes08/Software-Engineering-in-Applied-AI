"""
Contract Loader and State Builder.

Reads agent contracts (.md with YAML) and creates the initial agent state.
"""

import re
from pathlib import Path

import yaml


def load_yaml_from_md(file_path: Path) -> dict:
    """Extracts the first YAML block from a .md file."""
    if not file_path.exists():
        return {}
    text = file_path.read_text(encoding="utf-8")
    match = re.search(r"```yaml\n(.*?)```", text, re.DOTALL)
    if not match:
        return {}
    return yaml.safe_load(match.group(1)) or {}


def load_contracts(agent_path: Path) -> dict:
    """Loads every contract file for a given agent."""
    contracts_folder = agent_path / "contracts"

    return {
        "agent": load_yaml_from_md(agent_path / "agent.md"),
        "cycle": load_yaml_from_md(contracts_folder / "loop.md"),
        "planner": load_yaml_from_md(contracts_folder / "planner.md"),
        "toolbox": load_yaml_from_md(contracts_folder / "toolbox.md"),
        "executor": load_yaml_from_md(contracts_folder / "executor.md"),
        "rules": load_yaml_from_md(agent_path / "rules.md"),
        "hooks": load_yaml_from_md(agent_path / "hooks.md"),
        "skills": load_yaml_from_md(agent_path / "skills.md"),
        "memory": load_yaml_from_md(agent_path / "memory.md"),
    }


def create_state(contracts: dict, input_text: str, mode: str = None, event: str = None) -> dict:
    """Creates the initial agent state from the loaded contracts."""
    rules = contracts.get("rules", {})
    cycle = contracts.get("cycle", {})
    agent = contracts.get("agent", {})
    calls_config = rules.get("limits", {}).get("tool_calls", {})

    if isinstance(calls_config, dict):
        max_tool_calls = calls_config.get("total", 10)
        per_tool_limits = {
            tool_name: limit
            for tool_name, limit in calls_config.items()
            if tool_name != "total"
        }
    else:
        max_tool_calls = calls_config
        per_tool_limits = {}

    # agent type: CLI flag overrides the contract value
    agent_type = mode or agent.get("type", "task_based")

    return {
        "objective": cycle.get("objective", "unknown"),
        "input": input_text,
        "agent_type": agent_type,
        "event": event,
        "step": 0,
        "tool_calls": 0,
        "calls_per_tool": {},
        "max_steps": rules.get("limits", {}).get("max_steps", 10),
        "max_tool_calls": max_tool_calls,
        "per_tool_limits": per_tool_limits,
        "no_progress": rules.get("limits", {}).get("no_progress", 3),
        "time_limit_seconds": rules.get("limits", {}).get("time_limit_seconds", 120),
        "max_tokens": rules.get("limits", {}).get("max_tokens", 50000),
        "tokens_consumed": {"prompt": 0, "completion": 0, "total": 0},
        "sensitive_actions": rules.get("sensitive_actions", []),
        "history": [],
        "done": False,
        "result": "",
        "steps_without_progress": 0,
        "last_tool": None,
    }
