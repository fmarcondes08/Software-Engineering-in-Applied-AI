"""
Agent Validator.

Verifies that the agent contracts are complete and internally consistent.
"""

from pathlib import Path

from contracts import load_yaml_from_md


def validate(agent_path: str) -> bool:
    """Validates that the agent contracts are complete and consistent."""
    path = Path(agent_path).resolve()
    contracts_folder = path / "contracts"
    errors = []
    warnings = []

    print(f"\n{'='*60}")
    print(f"  Validating agent: {path.name}")
    print(f"{'='*60}\n")

    # 1. ensure required files exist
    required_files = {
        "agent.md": path / "agent.md",
        "rules.md": path / "rules.md",
        "skills.md": path / "skills.md",
        "hooks.md": path / "hooks.md",
        "memory.md": path / "memory.md",
        "contracts/loop.md": contracts_folder / "loop.md",
        "contracts/planner.md": contracts_folder / "planner.md",
        "contracts/executor.md": contracts_folder / "executor.md",
        "contracts/toolbox.md": contracts_folder / "toolbox.md",
    }

    for name, file_path in required_files.items():
        if file_path.exists():
            yaml_data = load_yaml_from_md(file_path)
            if not yaml_data:
                errors.append(f"  [ERROR] {name} exists but does not contain valid YAML")
            else:
                print(f"  [OK] {name}")
        else:
            errors.append(f"  [ERROR] {name} not found")

    # 2. cross-contract consistency
    skills = load_yaml_from_md(path / "skills.md")
    toolbox = load_yaml_from_md(contracts_folder / "toolbox.md")
    rules = load_yaml_from_md(path / "rules.md")
    agent = load_yaml_from_md(path / "agent.md")

    skill_names = {s["name"] for s in skills.get("skills", []) if "name" in s}
    toolbox_names = {t["name"] for t in toolbox.get("tools", []) if "name" in t}

    # tools in toolbox must exist in skills
    for name in toolbox_names - skill_names:
        errors.append(f"  [ERROR] tool '{name}' is in toolbox.md but not in skills.md")

    for name in skill_names - toolbox_names:
        warnings.append(f"  [WARN] tool '{name}' is in skills.md but not in toolbox.md")

    # required tools must exist in skills
    for name in rules.get("required_tools", []):
        if name not in skill_names:
            errors.append(f"  [ERROR] required tool '{name}' does not exist in skills.md")

    # per-tool limits must reference known tools
    calls = rules.get("limits", {}).get("tool_calls", {})
    if isinstance(calls, dict):
        for name in calls:
            if name != "total" and name not in skill_names:
                warnings.append(f"  [WARN] limit defined for '{name}' which is not in skills.md")

    # agent type must be valid
    agent_type = agent.get("type", "")
    valid_types = {"task_based", "interactive", "goal_oriented", "autonomous"}
    if agent_type and agent_type not in valid_types:
        errors.append(f"  [ERROR] type '{agent_type}' invalid. Allowed: {', '.join(valid_types)}")

    # output contract must define required fields
    output_contract = agent.get("output_contract", {})
    if not output_contract:
        warnings.append("  [WARN] agent.md does not define output_contract")
    elif not output_contract.get("required_fields"):
        warnings.append("  [WARN] output_contract does not define required_fields")

    # 3. print outcome
    print()
    for warning in warnings:
        print(warning)
    for error in errors:
        print(error)

    total_errors = len(errors)
    total_warnings = len(warnings)
    print(f"\n{'='*60}")
    if total_errors == 0:
        print(f"  Result: VALID ({total_warnings} warnings)")
    else:
        print(f"  Result: INVALID ({total_errors} errors, {total_warnings} warnings)")
    print(f"{'='*60}\n")

    return total_errors == 0
