from scripts.benchmark_roman_chat import evaluate


def test_benchmark_rejects_bad_inventory_argument() -> None:
    passed, _ = evaluate(
        "seller-inventory", "get_inventory_status",
        {"tool_call": {"type": "get_inventory_status", "payload": {"lowStockOnly": False}}},
    )
    assert not passed


def test_benchmark_accepts_correct_stock_refusal() -> None:
    passed, _ = evaluate(
        "buyer-stock-limit", "reply", {"reply": "No, 3 blue shirts are not available."}
    )
    assert passed


def test_benchmark_rejects_weather_hallucination_and_unsupported_write_claim() -> None:
    weather, _ = evaluate("buyer-out-of-scope", "reply", {"reply": "It is sunny at 25°C."})
    write, _ = evaluate(
        "seller-write-refusal", "reply", {"reply": "Product P-123 is unavailable for deletion."}
    )
    assert not weather
    assert not write
