"""Pure electricity / charge calculation helpers (no I/O)."""

from __future__ import annotations

from decimal import Decimal, ROUND_HALF_UP
from typing import Mapping, Optional, Sequence

from app.models import (
    COMMON_SHARE_FLOOR_1,
    COMMON_SHARE_FLOOR_2,
    COMMON_SHARE_FLOOR_3,
    ElectricityCalculationResult,
    FloorConsumption,
    MONTH_NAMES_RU,
)

MONEY_QUANT = Decimal("0.01")
KWH_QUANT = Decimal("0.001")
PCT_QUANT = Decimal("0.01")

DEFAULT_COMMON_SHARES: dict[int, Decimal] = {
    1: COMMON_SHARE_FLOOR_1,
    2: COMMON_SHARE_FLOOR_2,
    3: COMMON_SHARE_FLOOR_3,
}


def money(value: Decimal | int | float | str) -> Decimal:
    return Decimal(str(value)).quantize(MONEY_QUANT, rounding=ROUND_HALF_UP)


def kwh(value: Decimal | int | float | str) -> Decimal:
    return Decimal(str(value)).quantize(KWH_QUANT, rounding=ROUND_HALF_UP)


def consumption_difference(current: Decimal, previous: Decimal) -> Decimal:
    """Return current - previous. Raises if current < previous."""
    current = kwh(current)
    previous = kwh(previous)
    if current < previous:
        raise ValueError(
            f"Reading {current} is lower than previous reading {previous}"
        )
    return kwh(current - previous)


def calculate_common_kwh(
    main_consumption: Decimal,
    floor_consumptions: Mapping[int, Decimal],
) -> Decimal:
    """common = main - sum(floors). May be negative (caller must handle)."""
    total_floors = sum(
        (kwh(v) for v in floor_consumptions.values()),
        start=Decimal("0"),
    )
    return kwh(kwh(main_consumption) - total_floors)


def distribute_common_kwh(
    common_kwh: Decimal,
    shares: Mapping[int, Decimal] | None = None,
) -> dict[int, Decimal]:
    """Allocate common electricity by fixed work-hour shares."""
    if common_kwh < 0:
        raise ValueError("Cannot distribute negative common_kwh")
    shares = dict(shares or DEFAULT_COMMON_SHARES)
    allocated = {
        floor: kwh(common_kwh * Decimal(str(share)))
        for floor, share in shares.items()
    }
    # Absorb rounding residue on floor 1 so sum matches common_kwh.
    residue = kwh(common_kwh) - sum(allocated.values(), start=Decimal("0"))
    if 1 in allocated:
        allocated[1] = kwh(allocated[1] + residue)
    return allocated


def common_percentage(common_kwh: Decimal, main_consumption: Decimal) -> Decimal:
    main = kwh(main_consumption)
    if main == 0:
        return Decimal("0")
    return (kwh(common_kwh) / main * Decimal("100")).quantize(
        PCT_QUANT, rounding=ROUND_HALF_UP
    )


def should_warn_common_share(
    common_kwh: Decimal,
    main_consumption: Decimal,
    threshold_percent: Decimal | float = 25,
) -> bool:
    return common_percentage(common_kwh, main_consumption) > Decimal(
        str(threshold_percent)
    )


def anomaly_percent(
    current_consumption: Decimal,
    previous_consumption: Decimal,
) -> Optional[Decimal]:
    prev = kwh(previous_consumption)
    if prev == 0:
        return None
    current = kwh(current_consumption)
    change = ((current - prev) / prev * Decimal("100")).quantize(
        PCT_QUANT, rounding=ROUND_HALF_UP
    )
    return change


def should_warn_anomaly(
    current_consumption: Decimal,
    previous_consumption: Decimal,
    threshold_percent: Decimal | float = 30,
) -> bool:
    change = anomaly_percent(current_consumption, previous_consumption)
    if change is None:
        return False
    return abs(change) > Decimal(str(threshold_percent))


def personal_electricity_amount(personal_kwh: Decimal, tariff: Decimal) -> Decimal:
    return money(kwh(personal_kwh) * Decimal(str(tariff)))


def common_electricity_amount(allocated_common_kwh: Decimal, tariff: Decimal) -> Decimal:
    return money(kwh(allocated_common_kwh) * Decimal(str(tariff)))


def electricity_total(personal_amount: Decimal, common_amount: Decimal) -> Decimal:
    return money(money(personal_amount) + money(common_amount))


def total_due(
    electricity_total_amount: Decimal,
    water_amount: Decimal = Decimal("0"),
    previous_debt: Decimal = Decimal("0"),
    adjustments: Decimal = Decimal("0"),
) -> Decimal:
    return money(
        money(electricity_total_amount)
        + money(water_amount)
        + money(previous_debt)
        + money(adjustments)
    )


def debt_amount(due: Decimal, confirmed_payments: Decimal) -> Decimal:
    remaining = money(money(due) - money(confirmed_payments))
    return remaining if remaining > 0 else money(0)


def calculate_electricity_month(
    *,
    billing_year: int,
    billing_month: int,
    main_consumption: Decimal,
    floor_consumptions: Mapping[int, Decimal],
    tenant_names: Mapping[int, str],
    tariff: Decimal,
    previous_floor_consumptions: Mapping[int, Decimal] | None = None,
    previous_debts: Mapping[int, Decimal] | None = None,
    water_amounts: Mapping[int, Decimal] | None = None,
    adjustments: Mapping[int, Decimal] | None = None,
    common_shares: Mapping[int, Decimal] | None = None,
    common_warning_percent: Decimal | float = 25,
    consumption_warning_percent: Decimal | float = 30,
) -> ElectricityCalculationResult:
    """Full monthly electricity calculation with warnings / review flag."""
    warnings: list[str] = []
    previous_floor_consumptions = previous_floor_consumptions or {}
    previous_debts = previous_debts or {}
    water_amounts = water_amounts or {}
    adjustments = adjustments or {}

    required_floors = {1, 2, 3}
    if set(floor_consumptions.keys()) < required_floors:
        missing = sorted(required_floors - set(floor_consumptions.keys()))
        return ElectricityCalculationResult(
            billing_year=billing_year,
            billing_month=billing_month,
            main_consumption=kwh(main_consumption),
            floor_consumptions={k: kwh(v) for k, v in floor_consumptions.items()},
            common_kwh=Decimal("0"),
            common_percentage=Decimal("0"),
            tariff=Decimal(str(tariff)),
            floors=[],
            warnings=[],
            requires_review=True,
            error=f"Missing floor consumptions: {missing}",
        )

    floor_kwh = {f: kwh(floor_consumptions[f]) for f in (1, 2, 3)}
    main_kwh = kwh(main_consumption)
    common = calculate_common_kwh(main_kwh, floor_kwh)

    if common < 0:
        return ElectricityCalculationResult(
            billing_year=billing_year,
            billing_month=billing_month,
            main_consumption=main_kwh,
            floor_consumptions=floor_kwh,
            common_kwh=common,
            common_percentage=Decimal("0"),
            tariff=Decimal(str(tariff)),
            floors=[],
            warnings=[],
            requires_review=True,
            error=(
                "❌ Ошибка расчёта.\n"
                "Сумма потребления этажей превышает показания главного счётчика.\n"
                "Проверьте фотографии и показания."
            ),
        )

    pct = common_percentage(common, main_kwh)
    if should_warn_common_share(common, main_kwh, common_warning_percent):
        warnings.append(
            f"⚠️ Электроэнергия общего пользования составляет {pct}%\n"
            f"от общего потребления здания.\n\n"
            f"Рекомендуется проверить показания."
        )

    allocated = distribute_common_kwh(common, common_shares)
    floors: list[FloorConsumption] = []

    for floor in (1, 2, 3):
        personal = floor_kwh[floor]
        alloc = allocated[floor]
        personal_amt = personal_electricity_amount(personal, tariff)
        common_amt = common_electricity_amount(alloc, tariff)
        elec_total = electricity_total(personal_amt, common_amt)
        water = money(water_amounts.get(floor, Decimal("0")))
        prev_debt = money(previous_debts.get(floor, Decimal("0")))
        adj = money(adjustments.get(floor, Decimal("0")))
        due = total_due(elec_total, water, prev_debt, adj)

        anomaly: Optional[Decimal] = None
        if floor in previous_floor_consumptions:
            prev_c = previous_floor_consumptions[floor]
            if should_warn_anomaly(personal, prev_c, consumption_warning_percent):
                anomaly = anomaly_percent(personal, prev_c)
                assert anomaly is not None
                warnings.append(
                    f"⚠️ Потребление {floor} этаж изменилось на {anomaly}%\n"
                    f"по сравнению с прошлым месяцем."
                )

        floors.append(
            FloorConsumption(
                floor_number=floor,
                tenant_name=tenant_names.get(floor, f"Этаж {floor}"),
                personal_kwh=personal,
                allocated_common_kwh=alloc,
                personal_amount=personal_amt,
                common_amount=common_amt,
                electricity_total=elec_total,
                water_amount=water,
                previous_debt=prev_debt,
                adjustments=adj,
                total_due=due,
                anomaly_percent=anomaly,
            )
        )

    return ElectricityCalculationResult(
        billing_year=billing_year,
        billing_month=billing_month,
        main_consumption=main_kwh,
        floor_consumptions=floor_kwh,
        common_kwh=common,
        common_percentage=pct,
        tariff=Decimal(str(tariff)),
        floors=floors,
        warnings=warnings,
        requires_review=False,
        error=None,
    )


def format_money_ru(value: Decimal) -> str:
    quantized = money(value)
    sign = "-" if quantized < 0 else ""
    abs_val = abs(quantized)
    whole, frac = f"{abs_val:.2f}".split(".")
    groups: list[str] = []
    while whole:
        groups.append(whole[-3:])
        whole = whole[:-3]
    grouped = " ".join(reversed(groups))
    return f"{sign}{grouped},{frac} ₽"


def format_kwh_ru(value: Decimal) -> str:
    quantized = kwh(value)
    text = f"{quantized:.3f}".rstrip("0").rstrip(".")
    if "." in text:
        whole, frac = text.split(".")
        text = f"{whole},{frac}"
    # thousands for whole part
    if "," in text:
        whole, frac = text.split(",", 1)
    else:
        whole, frac = text, None
    groups: list[str] = []
    while whole:
        groups.append(whole[-3:])
        whole = whole[:-3]
    grouped = " ".join(reversed(groups)) or "0"
    return f"{grouped},{frac}" if frac is not None else grouped


def format_calculation_message(result: ElectricityCalculationResult) -> str:
    month_name = MONTH_NAMES_RU.get(result.billing_month, str(result.billing_month))
    lines: list[str] = [
        f"📊 Коммунальные услуги — {month_name} {result.billing_year}",
        "",
    ]
    for floor in result.floors:
        lines.extend(
            [
                f"🏢 {floor.floor_number} этаж — {floor.tenant_name}",
                f"Личное потребление: {format_kwh_ru(floor.personal_kwh)} кВт·ч",
                f"Общий свет: {format_kwh_ru(floor.allocated_common_kwh)} кВт·ч",
                f"Электроэнергия: {format_money_ru(floor.electricity_total)}",
                f"Вода: {format_money_ru(floor.water_amount)}",
                f"Прошлый долг: {format_money_ru(floor.previous_debt)}",
                f"ИТОГО: {format_money_ru(floor.total_due)}",
                "",
            ]
        )

    lines.extend(
        [
            f"Главный расход здания: {format_kwh_ru(result.main_consumption)} кВт·ч",
            f"Общий свет: {format_kwh_ru(result.common_kwh)} кВт·ч",
            f"Доля общего света: {result.common_percentage}%",
            f"Тариф электроэнергии: {format_money_ru(result.tariff)} / кВт·ч",
        ]
    )
    if result.warnings:
        lines.append("")
        lines.extend(result.warnings)
    return "\n".join(lines).strip()


def month_label_ru(year: int, month: int) -> str:
    return f"{MONTH_NAMES_RU.get(month, str(month))} {year}"
