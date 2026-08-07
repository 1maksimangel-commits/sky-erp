"""Pinned monthly status message builder and updater."""

from __future__ import annotations

import logging
from typing import Optional
from uuid import UUID

from aiogram import Bot
from aiogram.exceptions import TelegramBadRequest

from app.calculations import month_label_ru
from app.database import Database
from app.models import CalculationStatus, MeterKind, PaymentStatus

logger = logging.getLogger(__name__)


def _dot_for_reading(present: bool) -> str:
    return "🟢" if present else "🔴"


def _dot_for_payment(status: Optional[str]) -> str:
    if status == PaymentStatus.PAID.value:
        return "🟢"
    if status == PaymentStatus.PARTIALLY_PAID.value:
        return "🟡"
    if status == PaymentStatus.UNPAID.value:
        return "🔴"
    return "⚪"


def build_status_text(
    *,
    year: int,
    month: int,
    reading_flags: dict[str, bool],
    calculation_status: str,
    payment_statuses: dict[int, Optional[str]],
) -> str:
    calc_line = {
        CalculationStatus.COMPLETED.value: "✅ Выполнен",
        CalculationStatus.REQUIRES_REVIEW.value: "⚠️ Требует проверки",
        CalculationStatus.PENDING.value: "⏳ Ожидание показаний",
    }.get(calculation_status, "⏳ Ожидание показаний")

    lines = [
        f"📊 Кузнецова — {month_label_ru(year, month)}",
        "",
        "Показания",
        "",
        f"{_dot_for_reading(reading_flags.get('floor_1', False))} 1 этаж",
        f"{_dot_for_reading(reading_flags.get('floor_2', False))} 2 этаж",
        f"{_dot_for_reading(reading_flags.get('floor_3', False))} 3 этаж",
        f"{_dot_for_reading(reading_flags.get('main', False))} Главный счётчик",
        f"{_dot_for_reading(reading_flags.get('water', False))} Водомер",
        "",
        "Расчёт",
        calc_line,
        "",
        "Оплата",
        "",
        f"{_dot_for_payment(payment_statuses.get(1))} 1 этаж",
        f"{_dot_for_payment(payment_statuses.get(2))} 2 этаж",
        f"{_dot_for_payment(payment_statuses.get(3))} 3 этаж",
    ]
    return "\n".join(lines)


class StatusMessageService:
    def __init__(self, bot: Bot, db: Database, group_id: int) -> None:
        self.bot = bot
        self.db = db
        self.group_id = group_id

    def collect_reading_flags(self, year: int, month: int) -> dict[str, bool]:
        readings = self.db.list_approved_readings_for_month(year, month)
        flags = {
            "floor_1": False,
            "floor_2": False,
            "floor_3": False,
            "main": False,
            "water": False,
        }
        tenants = {t.id: t for t in self.db.list_tenants()}
        for row in readings:
            meter = row.get("meters") or {}
            kind = meter.get("meter_kind")
            if kind == MeterKind.MAIN_ELECTRICITY.value:
                flags["main"] = True
            elif kind == MeterKind.COMMON_WATER.value:
                flags["water"] = True
            elif kind == MeterKind.FLOOR_ELECTRICITY.value:
                tenant_id = meter.get("tenant_id")
                tenant = tenants.get(UUID(tenant_id)) if tenant_id else None
                if tenant:
                    flags[f"floor_{tenant.floor_number}"] = True
        return flags

    def collect_payment_statuses(
        self, year: int, month: int
    ) -> dict[int, Optional[str]]:
        statuses: dict[int, Optional[str]] = {1: None, 2: None, 3: None}
        for charge in self.db.list_charges(year, month):
            tenant = charge.get("tenants") or {}
            floor = tenant.get("floor_number")
            if floor in statuses:
                statuses[int(floor)] = charge.get("payment_status")
        return statuses

    def collect_calculation_status(self, year: int, month: int) -> str:
        calc = self.db.get_monthly_calculation(year, month)
        if not calc:
            return CalculationStatus.PENDING.value
        return calc.get("status") or CalculationStatus.PENDING.value

    async def refresh(self, year: int, month: int) -> str:
        reading_flags = self.collect_reading_flags(year, month)
        calc_status = self.collect_calculation_status(year, month)
        payment_statuses = self.collect_payment_statuses(year, month)
        text = build_status_text(
            year=year,
            month=month,
            reading_flags=reading_flags,
            calculation_status=calc_status,
            payment_statuses=payment_statuses,
        )

        existing = self.db.get_monthly_status(year, month)
        message_id = existing.get("telegram_message_id") if existing else None

        if message_id:
            try:
                await self.bot.edit_message_text(
                    chat_id=self.group_id,
                    message_id=int(message_id),
                    text=text,
                )
                self.db.upsert_monthly_status(
                    year,
                    month,
                    {
                        "reading_flags": reading_flags,
                        "calculation_status": calc_status,
                        "payment_statuses": payment_statuses,
                    },
                    telegram_message_id=int(message_id),
                )
                logger.info("status_message_edited message_id=%s", message_id)
                return text
            except TelegramBadRequest as exc:
                # Message not modified or missing — fall through to send new.
                logger.warning("status_edit_failed: %s", exc)

        sent = await self.bot.send_message(self.group_id, text)
        try:
            await self.bot.pin_chat_message(
                self.group_id, sent.message_id, disable_notification=True
            )
        except TelegramBadRequest:
            logger.warning("pin_status_failed message_id=%s", sent.message_id)

        self.db.upsert_monthly_status(
            year,
            month,
            {
                "reading_flags": reading_flags,
                "calculation_status": calc_status,
                "payment_statuses": payment_statuses,
            },
            telegram_message_id=sent.message_id,
        )
        logger.info("status_message_created message_id=%s", sent.message_id)
        return text

    def submission_status_lines(self, year: int, month: int) -> str:
        """Public who-submitted / who-did-not summary for day-24 reminder."""
        flags = self.collect_reading_flags(year, month)
        tenants = self.db.list_tenants()
        # Floor submission complete when that floor's required electricity meters are in.
        # Floor 1 also needs main + water for full responsibility, but day-24 example
        # shows per-person received/not for their primary obligation.
        lines = ["📋 Статус передачи показаний", ""]
        for tenant in tenants:
            floor = tenant.floor_number
            if floor == 1:
                ok = flags["floor_1"] and flags["main"] and flags["water"]
                missing_parts = []
                if not flags["floor_1"]:
                    missing_parts.append("счётчик 1 этажа")
                if not flags["main"]:
                    missing_parts.append("главный счётчик")
                if not flags["water"]:
                    missing_parts.append("водомер")
            elif floor == 2:
                ok = flags["floor_2"]
                missing_parts = [] if ok else ["счётчик не получен"]
            else:
                ok = flags["floor_3"]
                missing_parts = [] if ok else ["счётчик не получен"]

            if ok:
                lines.append(f"🟢 {tenant.responsible_name} — получено")
            else:
                detail = ", ".join(missing_parts) if missing_parts else "не получено"
                lines.append(f"🔴 {tenant.responsible_name} — {detail}")
        return "\n".join(lines)

    def missing_responsible_mentions(self, year: int, month: int) -> str:
        flags = self.collect_reading_flags(year, month)
        missing: list[str] = []
        for tenant in self.db.list_tenants():
            floor = tenant.floor_number
            if floor == 1:
                ok = flags["floor_1"] and flags["main"] and flags["water"]
            elif floor == 2:
                ok = flags["floor_2"]
            else:
                ok = flags["floor_3"]
            if ok:
                continue
            if tenant.telegram_user_id:
                missing.append(f'<a href="tg://user?id={tenant.telegram_user_id}">{tenant.responsible_name}</a>')
            else:
                missing.append(tenant.responsible_name)
        if not missing:
            return "✅ Все показания получены."
        return (
            "📢 Финальное напоминание: не хватает показаний.\n\n"
            "Ожидаем: " + ", ".join(missing)
        )
