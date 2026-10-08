"""Minimal live Urdu product-chat benchmark for the Feature 16 model decision.

This is a small qualitative smoke benchmark, not a statistically valid model comparison.
It runs only against the configured Ollama chat model and does not execute tools.
"""

import asyncio
import json

from app.services.slm_client import SLMClient

CASES = [
    ("کیا یہ نیلا کاٹن شرٹ دستیاب ہے؟", "Product: نیلی کاٹن شرٹ؛ stock: 12؛ price: PKR 1,800", "availability"),
    ("اس شرٹ کی قیمت کیا ہے؟", "Product: نیلی کاٹن شرٹ؛ price: PKR 1,800", "price"),
    ("مجھے دو عدد چاہئیں، کیا موجود ہیں؟", "Product: نیلی کاٹن شرٹ؛ stock: 1", "stock limit"),
    ("کیا یہ خالص کاٹن سے بنی ہے؟", "Product: نیلی شرٹ؛ material: cotton blend", "material grounding"),
    ("کیا آپ کے پاس سرخ رنگ بھی ہے؟", "Product: نیلی کاٹن شرٹ؛ available color: blue", "variant grounding"),
]


async def main() -> None:
    client = SLMClient()
    results = []
    for question, facts, criterion in CASES:
        response = await client.chat(
            [
                {
                    "role": "system",
                    "content": (
                        "آپ پاکستانی آن لائن دکان کے مددگار ہیں۔ صرف دی گئی معلومات کی بنیاد پر "
                        "اردو میں مختصر جواب دیں۔ قیمت، اسٹاک یا خصوصیت ایجاد نہ کریں۔"
                    ),
                },
                {"role": "user", "content": f"دستیاب پروڈکٹ معلومات: {facts}\nسوال: {question}"},
            ]
        )
        results.append({"question": question, "criterion": criterion, "reply": response["reply"]})
        print(json.dumps(results[-1], ensure_ascii=False))


if __name__ == "__main__":
    asyncio.run(main())
