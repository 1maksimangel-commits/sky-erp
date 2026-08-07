"""Payment matching and debt helpers (pure logic)."""

from __future__ import annotations

from decimal import Decimal

from app.calculations import debt_amount, money
from app.models import PaymentMatchResult, PaymentStatus


def apply_payment(
    total_due: Decimal,
    already_paid: Decimal,
    payment_amount: Decimal,
) -> PaymentMatchResult:
    """Apply a new payment toward a charge and return status + message parts."""
    charged = money(total_due)
    paid_before = money(already_paid)
    incoming = money(payment_amount)
    if incoming <= 0:
        raise ValueError("Payment amount must be positive")

    paid = money(paid_before + incoming)
    remaining = debt_amount(charged, paid)

    if remaining == 0:
        status = PaymentStatus.PAID
        message = (
            "✅ Оплата подтверждена\n"
            f"Начислено: {charged} ₽\n"
            f"Оплачено: {paid} ₽\n"
            "Задолженность отсутствует."
        )
    elif paid > 0 and paid < charged:
        status = PaymentStatus.PARTIALLY_PAID
        message = (
            "🟡 Частичная оплата\n"
            f"Начислено: {charged} ₽\n"
            f"Оплачено: {paid} ₽\n"
            f"Остаток: {remaining} ₽"
        )
    else:
        status = PaymentStatus.UNPAID
        message = (
            "🔴 Оплата не покрыла начисление\n"
            f"Начислено: {charged} ₽\n"
            f"Оплачено: {paid} ₽\n"
            f"Остаток: {remaining} ₽"
        )

    return PaymentMatchResult(
        status=status,
        charged=charged,
        paid=paid,
        remaining=remaining,
        message=message,
    )


def format_payment_confirmation(
    tenant_name: str,
    result: PaymentMatchResult,
) -> str:
    header = result.message.split("\n", 1)[0]
    body = "\n".join(result.message.split("\n")[1:])
    return f"{header}\n{tenant_name}\n{body}"


def carry_forward_debt(total_due: Decimal, confirmed_payments: Decimal) -> Decimal:
    """Unpaid balance carried to next month as previous_debt."""
    return debt_amount(total_due, confirmed_payments)
