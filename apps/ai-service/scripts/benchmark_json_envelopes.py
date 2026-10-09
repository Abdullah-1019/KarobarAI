"""Run a live JSON-envelope reliability benchmark against the configured Ollama model."""

import json
import os
import urllib.request


MODEL = os.environ.get("OLLAMA_CHAT_MODEL", "qwen2.5vl:7b")
BASE = os.environ.get("OLLAMA_BASE_URL", "http://ollama:11434").rstrip("/")
CHAT_URL = f"{BASE}/v1/chat/completions"
RETRY_PROMPT = "Your last response wasn't valid JSON. Respond only with the required JSON envelope."
SYSTEM = (
    'You are a helpful marketplace assistant. Respond with exactly one JSON object, no markdown. '
    'Use {"reply":"..."} for ordinary conversation. When a marketplace action or lookup is '
    'needed, use {"tool_call":{"type":"...","payload":{...}}}. Allowed tool types: '
    'search_products with payload {"query":string}; get_product with {"product_id":string}; '
    'add_to_cart with {"product_id":string,"quantity":integer}; '
    'check_order with {"order_id":string}. Do not invent tools.'
)
CASES = [
    ("Hi! What can you help me with?", "reply", None),
    ("Explain briefly how I can choose a good cotton shirt.", "reply", None),
    ("Thanks, that's helpful.", "reply", None),
    ("What is 18 divided by 3?", "reply", None),
    ("Tell me a short joke about a camel.", "reply", None),
    ("Find blue cotton shirts under 3000 rupees.", "tool_call", "search_products"),
    ("Show me details for product P-17.", "tool_call", "get_product"),
    ("Add two units of product P-3 to my cart.", "tool_call", "add_to_cart"),
    ("Where is my order O-88?", "tool_call", "check_order"),
    ("Search the catalog for handmade leather wallets.", "tool_call", "search_products"),
]


def ask(messages):
    payload = {
        "model": MODEL,
        "messages": messages,
        "temperature": 0,
        "max_tokens": 180,
    }
    request = urllib.request.Request(
        CHAT_URL,
        data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(request, timeout=600) as response:
        body = json.loads(response.read())
    return body["choices"][0]["message"]["content"]


def parse_envelope(raw, expected_type):
    try:
        value = json.loads(raw)
    except (ValueError, TypeError) as error:
        return None, f"invalid JSON: {error}"
    if not isinstance(value, dict):
        return None, "top-level JSON value is not an object"
    if expected_type == "reply":
        if set(value) == {"reply"} and isinstance(value["reply"], str):
            return value, None
        return None, "expected exactly {reply: string}"
    call = value.get("tool_call")
    if (
        set(value) == {"tool_call"}
        and isinstance(call, dict)
        and set(call) == {"type", "payload"}
        and isinstance(call["type"], str)
        and isinstance(call["payload"], dict)
    ):
        return value, None
    return None, "expected exactly {tool_call: {type: string, payload: object}}"


def run_case(prompt, expected_type, expected_tool):
    messages = [
        {"role": "system", "content": SYSTEM},
        {"role": "user", "content": prompt},
    ]
    initial_pass = False
    parsed = None
    failure_reason = None
    retries = 0
    for attempt in range(3):
        raw = ask(messages)
        parsed, failure_reason = parse_envelope(raw, expected_type)
        if parsed is not None and (
            expected_tool is None or parsed["tool_call"]["type"] == expected_tool
        ):
            if attempt == 0:
                initial_pass = True
            return {
                "input": prompt,
                "expected_response_type": expected_type,
                "initial_attempt_passed": initial_pass,
                "retries": retries,
                "final_pass": True,
                "parsed_result": parsed,
                "failure_reason": None,
            }
        if parsed is not None:
            failure_reason = f"wrong tool type: expected {expected_tool}"
            parsed = None
        if attempt < 2:
            retries += 1
            messages.extend(
                [
                    {"role": "assistant", "content": raw},
                    {"role": "user", "content": RETRY_PROMPT},
                ]
            )
    # Fail closed: this benchmark only validates output and never executes tools.
    return {
        "input": prompt,
        "expected_response_type": expected_type,
        "initial_attempt_passed": initial_pass,
        "retries": retries,
        "final_pass": False,
        "parsed_result": None,
        "failure_reason": failure_reason,
        "tool_executed": False,
    }


def main():
    results = [run_case(*case) for case in CASES]
    for result in results:
        print(json.dumps(result, ensure_ascii=False))
    passed = sum(result["final_pass"] for result in results)
    print(f"MODEL={MODEL}")
    print(f"PASS_RATE={passed}/{len(results)} = {passed / len(results):.0%}")


if __name__ == "__main__":
    main()
