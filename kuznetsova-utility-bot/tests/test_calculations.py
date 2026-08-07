"""Unit tests for electricity calculations and payments."""

from __future__ import annotations

from decimal import Decimal

import pytest

from app.calculations import (
    calculate_common_kwh,
    calculate_electricity_month,
    consumption_difference,
    distribute_common_kwh,
    should_warn_anomaly,
    should_warn_common_share,
)
from app.models import PaymentStatus
from app.payments import apply_payment, carry_forward_debt


def test_electricity_consumption_difference() -> None:
    assert consumption_difference(Decimal("100.5"), Decimal("90.0")) == Decimal("10.500")
    with pytest.raises(ValueError):
        consumption_difference(Decimal("80"), Decimal("90"))


def test_common_electricity_calculation() -> None:
    common = calculate_common_kwh(
        Decimal("1000"),
        {1: Decimal("300"), 2: Decimal("250"), 3: Decimal("200")},
    )
    assert common == Decimal("250.000")


def test_distribution_shares() -> None:
    allocated = distribute_common_kwh(Decimal("1000"))
    assert allocated[1] == Decimal("375.000")
    assert allocated[2] == Decimal("343.750")
    assert allocated[3] == Decimal("281.250")
    assert sum(allocated.values(), start=Decimal("0")) == Decimal("1000.000")


def test_negative_common_balance_error() -> None:
    result = calculate_electricity_month(
        billing_year=2026,
        billing_month=8,
        main_consumption=Decimal("100"),
        floor_consumptions={
            1: Decimal("50"),
            2: Decimal("40"),
            3: Decimal("30"),
        },
        tenant_names={1: "Константин", 2: "Данил", 3: "Наталья"},
        tariff=Decimal("5.00"),
    )
    assert result.requires_review is True
    assert result.error is not None
    assert "превышает" in result.error
    assert result.floors == []


def test_common_25_percent_warning() -> None:
    # common = 300 / main 1000 = 30% > 25
    assert should_warn_common_share(Decimal("300"), Decimal("1000"), 25) is True
    assert should_warn_common_share(Decimal("200"), Decimal("1000"), 25) is False

    result = calculate_electricity_month(
        billing_year=2026,
        billing_month=8,
        main_consumption=Decimal("1000"),
        floor_consumptions={
            1: Decimal("300"),
            2: Decimal("250"),
            3: Decimal("150"),
        },
        tenant_names={1: "Константин", 2: "Данил", 3: "Наталья"},
        tariff=Decimal("5.00"),
        common_warning_percent=25,
    )
    assert result.requires_review is False
    assert result.common_kwh == Decimal("300.000")
    assert any("общего пользования" in w for w in result.warnings)


def test_anomaly_30_percent_warning() -> None:
    assert should_warn_anomaly(Decimal("130"), Decimal("100"), 30) is False
    assert should_warn_anomaly(Decimal("140"), Decimal("100"), 30) is True

    result = calculate_electricity_month(
        billing_year=2026,
        billing_month=8,
        main_consumption=Decimal("1000"),
        floor_consumptions={
            1: Decimal("400"),
            2: Decimal("300"),
            3: Decimal("200"),
        },
        tenant_names={1: "Константин", 2: "Данил", 3: "Наталья"},
        tariff=Decimal("5.00"),
        previous_floor_consumptions={1: Decimal("200"), 2: Decimal("300"), 3: Decimal("200")},
        consumption_warning_percent=30,
        common_warning_percent=100,  # silence common warning for this case
    )
    assert any("1 этаж" in w for w in result.warnings)


def test_partial_payment() -> None:
    result = apply_payment(
        total_due=Decimal("1000.00"),
        already_paid=Decimal("0"),
        payment_amount=Decimal("400.00"),
    )
    assert result.status == PaymentStatus.PARTIALLY_PAID
    assert result.paid == Decimal("400.00")
    assert result.remaining == Decimal("600.00")
    assert "Частичная оплата" in result.message


def test_full_payment() -> None:
    result = apply_payment(
        total_due=Decimal("1000.00"),
        already_paid=Decimal("400.00"),
        payment_amount=Decimal("600.00"),
    )
    assert result.status == PaymentStatus.PAID
    assert result.remaining == Decimal("0.00")
    assert "Оплата подтверждена" in result.message


def test_debt_carry_forward() -> None:
    debt = carry_forward_debt(Decimal("14040.50"), Decimal("10000.00"))
    assert debt == Decimal("4040.50")
    assert carry_forward_debt(Decimal("1000"), Decimal("1000")) == Decimal("0.00")
