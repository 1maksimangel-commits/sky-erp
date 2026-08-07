"""OpenAI Vision recognition for meter photos and payment documents."""

from __future__ import annotations

import base64
import json
import logging
import re
from decimal import Decimal, InvalidOperation
from typing import Any, Optional

from openai import AsyncOpenAI

from app.models import VisionResult

logger = logging.getLogger(__name__)

METER_SYSTEM_PROMPT = """You are a meter-reading extractor for utility meters in Russia.
Analyze the image and return ONLY valid JSON with this schema:
{
  "is_meter": true/false,
  "meter_number": "string or null",
  "reading": number or null,
  "meter_type": "electricity|water|unknown|null",
  "confidence": 0.0-1.0
}
Rules:
- meter_number is the serial / factory number printed on the meter body or faceplate.
- reading is the current consumption register value (kWh for electricity, m3 for water).
- Do not invent values. If unclear, lower confidence and use nulls.
- Ignore unrelated text in the background.
"""

PAYMENT_SYSTEM_PROMPT = """You extract payment receipt / payment order data.
Return ONLY valid JSON:
{
  "is_payment_document": true/false,
  "payer": "string or null",
  "amount": number or null,
  "payment_date": "YYYY-MM-DD or null",
  "document_number": "string or null",
  "confidence": 0.0-1.0
}
Do not invent banking secrets. Amount must be numeric.
"""


def _extract_json(text: str) -> dict[str, Any]:
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
    return json.loads(text)


class VisionService:
    def __init__(self, api_key: str, model: str = "gpt-4o") -> None:
        self.client = AsyncOpenAI(api_key=api_key)
        self.model = model

    async def _analyze_image(
        self, image_bytes: bytes, system_prompt: str, mime: str = "image/jpeg"
    ) -> dict[str, Any]:
        b64 = base64.b64encode(image_bytes).decode("ascii")
        data_url = f"data:{mime};base64,{b64}"
        logger.info("openai_vision_request model=%s bytes=%s", self.model, len(image_bytes))
        response = await self.client.chat.completions.create(
            model=self.model,
            temperature=0,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": system_prompt},
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": "Extract structured data from this image.",
                        },
                        {"type": "image_url", "image_url": {"url": data_url}},
                    ],
                },
            ],
        )
        content = response.choices[0].message.content or "{}"
        logger.info("openai_vision_response_chars=%s", len(content))
        return _extract_json(content)

    async def recognize_meter(
        self, image_bytes: bytes, mime: str = "image/jpeg"
    ) -> VisionResult:
        try:
            data = await self._analyze_image(image_bytes, METER_SYSTEM_PROMPT, mime)
        except Exception:
            logger.exception("openai_meter_recognition_failed")
            return VisionResult(is_meter=False, confidence=0.0)

        reading: Optional[Decimal] = None
        raw_reading = data.get("reading")
        if raw_reading is not None and raw_reading != "":
            try:
                reading = Decimal(str(raw_reading))
            except (InvalidOperation, ValueError):
                reading = None

        meter_number = data.get("meter_number")
        if meter_number is not None:
            meter_number = str(meter_number).strip().replace(" ", "")

        confidence = float(data.get("confidence") or 0.0)
        result = VisionResult(
            is_meter=bool(data.get("is_meter")),
            meter_number=meter_number or None,
            reading=reading,
            meter_type=(str(data["meter_type"]) if data.get("meter_type") else None),
            confidence=max(0.0, min(1.0, confidence)),
        )
        logger.info(
            "meter_recognized is_meter=%s meter_number=%s confidence=%s",
            result.is_meter,
            result.meter_number,
            result.confidence,
        )
        return result

    async def recognize_payment(
        self, image_bytes: bytes, mime: str = "image/jpeg"
    ) -> dict[str, Any]:
        try:
            data = await self._analyze_image(image_bytes, PAYMENT_SYSTEM_PROMPT, mime)
        except Exception:
            logger.exception("openai_payment_recognition_failed")
            return {
                "is_payment_document": False,
                "payer": None,
                "amount": None,
                "payment_date": None,
                "document_number": None,
                "confidence": 0.0,
            }

        amount = data.get("amount")
        parsed_amount: Optional[Decimal] = None
        if amount is not None and amount != "":
            try:
                parsed_amount = Decimal(str(amount).replace(",", ".").replace(" ", ""))
            except (InvalidOperation, ValueError):
                parsed_amount = None

        return {
            "is_payment_document": bool(data.get("is_payment_document")),
            "payer": data.get("payer"),
            "amount": parsed_amount,
            "payment_date": data.get("payment_date"),
            "document_number": data.get("document_number"),
            "confidence": float(data.get("confidence") or 0.0),
        }
