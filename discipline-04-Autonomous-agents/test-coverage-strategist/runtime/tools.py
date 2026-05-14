"""
Tools and Evidence.

Each tool uses the LLM to generate real data based on context.
Without an API key, it falls back to a simple mock.
Token usage is returned alongside the result for accounting.
"""

import json
import os
import random
from pathlib import Path

try:
    from dotenv import load_dotenv
except ImportError:
    def load_dotenv(*a, **kw): pass

load_dotenv(Path(__file__).parent / ".env")

_ZERO_TOKENS = {"prompt": 0, "completion": 0, "total": 0}


def _call_llm_tool(system_prompt: str, user_prompt: str, output_fields: dict) -> tuple:
    """Calls the LLM to generate the output of a tool.

    Returns (data, token_usage). data=None when the call fails or there is no API key.
    """
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        return None, _ZERO_TOKENS.copy()

    from openai import OpenAI

    client = OpenAI(api_key=api_key)
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
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
        return json.loads(response.choices[0].message.content), token_usage
    except (json.JSONDecodeError, IndexError):
        return None, token_usage


def build_tool(skill: dict):
    """Creates a function that uses the LLM to generate real data."""
    name = skill.get("name", "")
    description = skill.get("description", "")
    output_fields = skill.get("output", {})
    input_fields = skill.get("input", {})

    output_text = "\n".join(f"  - {field}: {ftype}" for field, ftype in output_fields.items())

    system_prompt = f"""You are a tool called '{name}'.
Purpose: {description}

You MUST return ONLY valid JSON with exactly these fields:
{output_text}

Rules:
- Generate realistic data coherent with the arguments received
- For 'list' fields return a list of objects with concrete details
- For 'object' fields return a structured object with real data
- For 'string' fields return descriptive, specific text
- NEVER use placeholders such as 'mock', 'example', 'test' — produce real content
- Data across fields must be internally consistent and consistent with the context
- Respond in English"""

    def function(arguments):
        user_prompt = f"Arguments received:\n{json.dumps(arguments, indent=2, ensure_ascii=False)}"

        llm_data, token_usage = _call_llm_tool(system_prompt, user_prompt, output_fields)

        if llm_data:
            llm_data["_input"] = arguments
            return {"success": True, "data": llm_data, "_tokens": token_usage}

        # simple mock fallback
        data = {}
        for field_name, field_type in output_fields.items():
            data[field_name] = _generate_fallback_value(field_type, field_name)
        data["_input"] = arguments
        return {"success": True, "data": data, "_tokens": _ZERO_TOKENS.copy()}

    return function


def _generate_fallback_value(field_type: str, field_name: str):
    """Fallback when there is no API key — produces minimal values."""
    normalized_type = field_type.lower() if isinstance(field_type, str) else "string"
    if normalized_type == "float":
        return round(random.uniform(0.01, 100.0), 2)
    if normalized_type == "int":
        return random.randint(1, 500)
    if normalized_type == "bool":
        return random.choice([True, False])
    if normalized_type == "list":
        return [{"item": f"{field_name}_1"}, {"item": f"{field_name}_2"}]
    if normalized_type == "object":
        return {"field": field_name, "value": "no_api_key"}
    return f"{field_name}_no_api_key"


def build_tools_from_contracts(contracts: dict) -> dict:
    """Builds the tool registry from the skills contract."""
    skills = contracts.get("skills", {}).get("skills", [])
    tools = {}
    for skill in skills:
        name = skill.get("name")
        if name:
            tools[name] = build_tool(skill)
    return tools


def extract_evidence_from_history(history: list) -> dict:
    """Generically extracts the evidence collected so far from history."""
    evidence = {}
    for record in history:
        plan = record.get("plan", {})
        result = record.get("action_result")
        tool_name = plan.get("tool_name")
        if result and result.get("success") and tool_name:
            evidence[tool_name] = result.get("data", {})
    return evidence


def build_mock_arguments(skill: dict, history: list) -> dict:
    """Builds arguments for a tool using evidence from history."""
    arguments = {}
    evidence = extract_evidence_from_history(history)

    for field_name, field_type in skill.get("input", {}).items():
        normalized_type = field_type.lower() if isinstance(field_type, str) else "string"

        if normalized_type == "object" and evidence:
            arguments[field_name] = evidence
        else:
            arguments[field_name] = _generate_fallback_value(field_type, field_name)

    return arguments
