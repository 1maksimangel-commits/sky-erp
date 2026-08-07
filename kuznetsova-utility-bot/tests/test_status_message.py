"""Tests for monthly status message formatting."""

from __future__ import annotations

from app.models import CalculationStatus, PaymentStatus
from app.status_message import build_status_text


def test_status_message_pending() -> None:
    text = build_status_text(
        year=2026,
        month=8,
        reading_flags={
            "floor_1": True,
            "floor_2": True,
            "floor_3": False,
            "main": True,
            "water": True,
        },
        calculation_status=CalculationStatus.PENDING.value,
        payment_statuses={1: None, 2: None, 3: None},
    )
    assert "Кузнецова — Август 2026" in text
    assert "🟢 1 этаж" in text
    assert "🔴 3 этаж" in text
    assert "⏳ Ожидание показаний" in text
    assert "⚪ 1 этаж" in text


def test_status_message_after_payments() -> None:
    text = build_status_text(
        year=2026,
        month=8,
        reading_flags={
            "floor_1": True,
            "floor_2": True,
            "floor_3": True,
            "main": True,
            "water": True,
        },
        calculation_status=CalculationStatus.COMPLETED.value,
        payment_statuses={
            1: PaymentStatus.PAID.value,
            2: PaymentStatus.PARTIALLY_PAID.value,
            3: PaymentStatus.UNPAID.value,
        },
    )
    assert "✅ Выполнен" in text
    assert "🟢 1 этаж" in text
    assert "🟡 2 этаж" in text
    assert "🔴 3 этаж" in text
