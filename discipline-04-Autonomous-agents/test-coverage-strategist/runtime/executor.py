"""
Executor — Execute, Evaluate, Validate Payload, and Fire Hooks.

Executes tools, validates payloads against schema, semantically evaluates
results, and dispatches cycle hooks.
"""

from datetime import datetime


def execute_hook(name: str, hooks_contract: dict, **kwargs):
    """Fires a hook declared in the contract."""
    hooks = hooks_contract.get("hooks", {})
    action = hooks.get(name)
    if not action:
        return

    timestamp = datetime.now().strftime("%H:%M:%S")
    detail = " ".join(f"{key}={value}" for key, value in kwargs.items())

    if action == "log":
        print(f"  [{timestamp}] hook:{name} {detail}")
    elif action == "alert":
        print(f"  [{timestamp}] [ALERT] hook:{name} {detail}")


# --- Gap 1: Payload Validation ---

_TYPE_MAP = {
    "string": str,
    "int": (int,),
    "float": (int, float),
    "bool": (bool,),
    "list": (list,),
    "object": (dict,),
}


def validate_payload(tool_name: str, arguments: dict, contracts: dict) -> list:
    """Validates arguments against the tool's input schema.

    Returns a list of errors. Empty list = valid payload.
    """
    errors = []
    skills = contracts.get("skills", {}).get("skills", [])
    skill = next((s for s in skills if s.get("name") == tool_name), None)

    if not skill:
        return [f"tool '{tool_name}' not found in skills schema"]

    input_schema = skill.get("input", {})
    arguments = arguments or {}

    # check required fields
    for field, expected_type in input_schema.items():
        if field not in arguments:
            errors.append(f"required field '{field}' is missing")
            continue

        value = arguments[field]
        normalized_type = expected_type.lower() if isinstance(expected_type, str) else "string"
        python_types = _TYPE_MAP.get(normalized_type)

        if python_types and value is not None:
            if isinstance(python_types, tuple):
                if not isinstance(value, python_types):
                    errors.append(f"field '{field}': expected {normalized_type}, got {type(value).__name__}")
            elif not isinstance(value, python_types):
                errors.append(f"field '{field}': expected {normalized_type}, got {type(value).__name__}")

    return errors


def validate_output(tool_name: str, result: dict, contracts: dict) -> list:
    """Validates output data against the tool schema.

    Returns a list of issues. Empty list = valid output.
    """
    issues = []
    if not result or not result.get("success"):
        return issues

    data = result.get("data", {})
    skills = contracts.get("skills", {}).get("skills", [])
    skill = next((s for s in skills if s.get("name") == tool_name), None)

    if not skill:
        return issues

    output_schema = skill.get("output", {})

    for field, expected_type in output_schema.items():
        if field not in data:
            issues.append(f"output field '{field}' is missing from the result")
            continue

        value = data[field]

        if value is None:
            issues.append(f"output field '{field}' returned None")
        elif isinstance(value, str) and not value.strip():
            issues.append(f"output field '{field}' returned an empty string")
        elif isinstance(value, list) and len(value) == 0:
            issues.append(f"output field '{field}' returned an empty list")

    return issues


# --- Execution ---

def execute(tool_name: str, arguments: dict, tools: dict, contracts: dict) -> dict:
    """Executes a tool with validation."""
    if tool_name not in tools:
        return {"success": False, "error": f"Tool '{tool_name}' not found in toolbox"}

    try:
        result = tools[tool_name](arguments or {})
    except Exception as err:
        executor_config = contracts.get("executor", {}).get("execution", {})
        if executor_config.get("retry_on_failure"):
            try:
                result = tools[tool_name](arguments or {})
            except Exception as retry_err:
                return {"success": False, "error": str(retry_err)}
        else:
            return {"success": False, "error": str(err)}

    return result


# --- Gap 4: Semantic Evaluation ---

def evaluate(plan: dict, action_result: dict, contracts: dict = None) -> dict:
    """Evaluates the action result with semantic checks."""
    if plan.get("next_action") == "FINISH":
        return {"goal_reached": True, "reason": plan.get("success_criterion", "")}

    if not action_result or not action_result.get("success"):
        reason = f"step failed - {action_result.get('error', 'no data') if action_result else 'no result'}"
        return {"goal_reached": False, "reason": reason, "quality": "failure"}

    # semantic evaluation: validate output against schema
    tool_name = plan.get("tool_name", "")
    output_issues = []
    if contracts:
        output_issues = validate_output(tool_name, action_result, contracts)

    criterion = plan.get("success_criterion", "")

    if output_issues:
        reason = f"step ok with caveats - {'; '.join(output_issues)}"
        quality = "partial"
    else:
        reason = f"step ok - criterion: {criterion}" if criterion else "step ok - continue"
        quality = "complete"

    return {
        "goal_reached": False,
        "reason": reason,
        "quality": quality,
        "output_issues": output_issues,
    }
