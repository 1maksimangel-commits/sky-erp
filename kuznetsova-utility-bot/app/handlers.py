"""Telegram message handlers for the common utility group."""

from __future__ import annotations

import logging
from datetime import date, datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID
from zoneinfo import ZoneInfo

from aiogram import Bot, F, Router
from aiogram.enums import ChatType
from aiogram.types import Message

from app.calculations import (
    calculate_electricity_month,
    consumption_difference,
    format_calculation_message,
    format_kwh_ru,
    kwh,
)
from app.config import Settings
from app.database import Database
from app.models import (
    CalculationStatus,
    MeterKind,
    PaymentStatus,
    UtilityType,
    WaterDistributionMode,
)
from app.payments import apply_payment, format_payment_confirmation
from app.status_message import StatusMessageService
from app.storage import Storage
from app.vision import VisionService

logger = logging.getLogger(__name__)

router = Router(name="utility")

LOW_CONFIDENCE_REPLY = (
    "❌ Не удалось надёжно определить показание.\n"
    "Пожалуйста, отправьте фотографию счётчика повторно крупным планом."
)


def billing_period(tz_name: str) -> tuple[int, int]:
    now = datetime.now(ZoneInfo(tz_name))
    return now.year, now.month


def _mention(tenant) -> str:
    if tenant.telegram_user_id:
        return f'<a href="tg://user?id={tenant.telegram_user_id}">{tenant.responsible_name}</a>'
    return tenant.responsible_name


class AppContext:
    def __init__(
        self,
        settings: Settings,
        db: Database,
        storage: Storage,
        vision: VisionService,
        status: StatusMessageService,
    ) -> None:
        self.settings = settings
        self.db = db
        self.storage = storage
        self.vision = vision
        self.status = status


def register_handlers(dp_router: Router, ctx: AppContext) -> None:
    group_id = ctx.settings.telegram_group_id

    @dp_router.message(F.chat.id != group_id)
    async def ignore_other_chats(message: Message) -> None:
        if message.chat.type in {ChatType.GROUP, ChatType.SUPERGROUP}:
            logger.warning(
                "unexpected_chat_id chat_id=%s type=%s",
                message.chat.id,
                message.chat.type,
            )
        # Ignore DMs / other groups for utility workflow.
        return

    @dp_router.message(F.chat.id == group_id, F.photo)
    async def on_photo(message: Message, bot: Bot) -> None:
        logger.info(
            "telegram_photo chat_id=%s from=%s",
            message.chat.id,
            message.from_user.id if message.from_user else None,
        )
        photo = message.photo[-1]
        file = await bot.get_file(photo.file_id)
        buffer = await bot.download_file(file.file_path)
        image_bytes = buffer.read() if hasattr(buffer, "read") else bytes(buffer)

        year, month = billing_period(ctx.settings.timezone)
        caption = (message.caption or "").lower()

        # Payment documents: caption hints or after calculation exists.
        calc = ctx.db.get_monthly_calculation(year, month)
        looks_like_payment = any(
            word in caption
            for word in ("оплат", "платеж", "квитан", "payment", "чек")
        )
        if looks_like_payment or (
            calc and calc.get("status") == CalculationStatus.COMPLETED.value
            and "счётчик" not in caption
            and "показан" not in caption
        ):
            # Try payment first when calculation is done; fall back to meter if not a payment doc.
            payment_data = await ctx.vision.recognize_payment(image_bytes)
            if payment_data.get("is_payment_document") and payment_data.get("amount"):
                await _handle_payment(ctx, message, image_bytes, "payment.jpg", "image/jpeg", payment_data, year, month)
                return

        await _handle_meter_photo(ctx, message, image_bytes, year, month)

    @dp_router.message(F.chat.id == group_id, F.document)
    async def on_document(message: Message, bot: Bot) -> None:
        doc = message.document
        if not doc:
            return
        mime = doc.mime_type or ""
        allowed = mime.startswith("image/") or mime == "application/pdf"
        if not allowed:
            return
        logger.info(
            "telegram_document chat_id=%s mime=%s from=%s",
            message.chat.id,
            mime,
            message.from_user.id if message.from_user else None,
        )
        file = await bot.get_file(doc.file_id)
        buffer = await bot.download_file(file.file_path)
        data = buffer.read() if hasattr(buffer, "read") else bytes(buffer)
        year, month = billing_period(ctx.settings.timezone)

        if mime == "application/pdf":
            # PDF: store and attempt best-effort payment extraction via filename/caption only.
            # Vision models may not accept raw PDF bytes; keep amount from caption if present.
            await _handle_pdf_payment(ctx, message, data, doc.file_name or "payment.pdf", year, month)
            return

        payment_data = await ctx.vision.recognize_payment(data, mime=mime)
        if payment_data.get("is_payment_document") and payment_data.get("amount"):
            await _handle_payment(
                ctx, message, data, doc.file_name or "payment.jpg", mime, payment_data, year, month
            )
            return
        await _handle_meter_photo(ctx, message, data, year, month, mime=mime)


async def _handle_meter_photo(
    ctx: AppContext,
    message: Message,
    image_bytes: bytes,
    year: int,
    month: int,
    mime: str = "image/jpeg",
) -> None:
    settings = ctx.db.get_bot_settings()
    threshold = float(settings.vision_confidence_threshold)

    path = ctx.storage.upload_meter_photo(
        image_bytes,
        filename="meter.jpg",
        content_type=mime,
        year=year,
        month=month,
    )

    vision = await ctx.vision.recognize_meter(image_bytes, mime=mime)
    if (
        not vision.is_meter
        or vision.meter_number is None
        or vision.reading is None
        or vision.confidence < threshold
    ):
        await message.reply(LOW_CONFIDENCE_REPLY)
        return

    meter = ctx.db.get_meter_by_number(vision.meter_number)
    if not meter:
        await message.reply(
            "❌ Счётчик с номером "
            f"<code>{vision.meter_number}</code> не найден в базе.\n"
            "Проверьте фотографию и отправьте снова."
        )
        return

    # Validate responsible floor via meter identity (primary), not sender trust alone.
    # Still check sender floor mapping when telegram_user_id is configured.
    sender_id = message.from_user.id if message.from_user else None
    responsible_floor: Optional[int] = None
    for tenant in ctx.db.list_tenants():
        if tenant.telegram_user_id and sender_id and tenant.telegram_user_id == sender_id:
            responsible_floor = tenant.floor_number
            break

    if responsible_floor is not None:
        if not ctx.db.is_meter_allowed_for_floor(meter, responsible_floor):
            await message.reply(
                "❌ Этот счётчик не относится к вашей зоне ответственности."
            )
            return
    else:
        # If telegram IDs are not configured, accept by meter number only
        # (public group accountability) but log it.
        logger.info(
            "meter_accepted_without_telegram_mapping meter=%s sender=%s",
            meter.meter_number,
            sender_id,
        )

    previous = ctx.db.get_previous_reading_value(meter.id)
    if previous is None and meter.meter_kind in {
        MeterKind.MAIN_ELECTRICITY,
        MeterKind.COMMON_WATER,
    }:
        # First real reading becomes baseline-equivalent; consumption starts next month.
        previous = vision.reading
        consumption = Decimal("0")
    elif previous is None:
        await message.reply(
            "❌ Нет базового показания для этого счётчика.\n"
            "Обратитесь к ответственному за настройку базы."
        )
        return
    else:
        try:
            consumption = consumption_difference(vision.reading, previous)
        except ValueError:
            await message.reply(
                "❌ Показание меньше предыдущего.\n"
                f"Было: {format_kwh_ru(previous)}\n"
                f"Распознано: {format_kwh_ru(vision.reading)}\n"
                "Отправьте фото повторно."
            )
            return

    unit = "кВт·ч" if meter.meter_kind != MeterKind.COMMON_WATER else "м³"
    ctx.db.save_approved_reading(
        meter_id=meter.id,
        year=year,
        month=month,
        reading_value=kwh(vision.reading),
        previous_reading=previous,
        consumption=consumption,
        photo_path=path,
        confidence=Decimal(str(vision.confidence)),
        submitted_by_telegram_id=sender_id,
        recognized_meter_number=vision.meter_number,
    )

    meter_label = {
        MeterKind.FLOOR_ELECTRICITY: "Электросчётчик этажа",
        MeterKind.MAIN_ELECTRICITY: "Главный счётчик здания",
        MeterKind.COMMON_WATER: "Общий водомер",
    }.get(meter.meter_kind, meter.model_name)

    await message.reply(
        "✅ Показание принято\n\n"
        f"Счётчик: {meter_label}\n"
        f"Номер: {meter.meter_number}\n"
        f"Показание: {format_kwh_ru(vision.reading)} {unit}"
    )

    if meter.meter_kind == MeterKind.COMMON_WATER:
        settings = ctx.db.get_bot_settings()
        if settings.water_distribution_mode == WaterDistributionMode.UNCONFIGURED:
            await message.reply(
                "ℹ️ Показание водомера сохранено.\n"
                "Правило распределения воды ещё не настроено — "
                "начисление за воду не финализируется."
            )

    await ctx.status.refresh(year, month)
    await maybe_run_electricity_calculation(ctx, message, year, month)


async def maybe_run_electricity_calculation(
    ctx: AppContext, message: Message, year: int, month: int
) -> None:
    readings = ctx.db.list_approved_readings_for_month(year, month)

    by_kind: dict[str, list] = {
        MeterKind.MAIN_ELECTRICITY.value: [],
        MeterKind.FLOOR_ELECTRICITY.value: [],
        MeterKind.COMMON_WATER.value: [],
    }
    floor_consumption: dict[int, Decimal] = {}
    main_consumption: Optional[Decimal] = None

    tenants_by_id = {t.id: t for t in ctx.db.list_tenants()}

    for row in readings:
        meter_row = row.get("meters") or {}
        kind = meter_row.get("meter_kind")
        by_kind.get(kind, []).append(row)
        if kind == MeterKind.MAIN_ELECTRICITY.value:
            main_consumption = Decimal(str(row["consumption"] or 0))
        elif kind == MeterKind.FLOOR_ELECTRICITY.value:
            tenant_id = meter_row.get("tenant_id")
            if not tenant_id:
                continue
            tenant = tenants_by_id.get(UUID(tenant_id))
            if tenant:
                floor_consumption[tenant.floor_number] = Decimal(
                    str(row["consumption"] or 0)
                )

    if main_consumption is None or set(floor_consumption) != {1, 2, 3}:
        return

    existing = ctx.db.get_monthly_calculation(year, month)
    if existing and existing.get("status") == CalculationStatus.COMPLETED.value:
        return

    on_date = date(year, month, 1)
    tariff = ctx.db.get_active_tariff(UtilityType.ELECTRICITY, on_date)
    if tariff is None:
        await message.answer(
            "⚠️ Все электропоказания получены, но тариф электроэнергии "
            "не задан в таблице tariffs. Расчёт отложен."
        )
        return

    settings = ctx.db.get_bot_settings()
    tenant_names = {t.floor_number: t.responsible_name for t in ctx.db.list_tenants()}
    shares = {
        t.floor_number: t.common_electricity_share for t in ctx.db.list_tenants()
    }
    previous_debts = {}
    previous_consumptions = {}
    for t in ctx.db.list_tenants():
        previous_debts[t.floor_number] = ctx.db.get_previous_debt(t.id, year, month)
        prev_c = ctx.db.get_previous_floor_consumption(t.floor_number, year, month)
        if prev_c is not None:
            previous_consumptions[t.floor_number] = prev_c

    # Water amounts only when distribution configured (otherwise 0 / not finalized).
    water_amounts = {1: Decimal("0"), 2: Decimal("0"), 3: Decimal("0")}
    if settings.water_distribution_mode != WaterDistributionMode.UNCONFIGURED:
        # Configurable hook: equal split of water charge if water tariff + consumption exist.
        water_tariff = ctx.db.get_active_tariff(UtilityType.WATER, on_date)
        water_rows = by_kind.get(MeterKind.COMMON_WATER.value) or []
        if water_tariff is not None and water_rows:
            water_consumption = Decimal(str(water_rows[0].get("consumption") or 0))
            total_water = (water_consumption * water_tariff).quantize(Decimal("0.01"))
            if settings.water_distribution_mode == WaterDistributionMode.EQUAL:
                share = (total_water / Decimal("3")).quantize(Decimal("0.01"))
                water_amounts = {1: share, 2: share, 3: total_water - share * 2}
            elif settings.water_distribution_mode == WaterDistributionMode.PERCENTAGES:
                cfg = settings.water_distribution_config or {}
                for floor in (1, 2, 3):
                    pct = Decimal(str(cfg.get(str(floor), cfg.get(floor, 0))))
                    water_amounts[floor] = (total_water * pct / Decimal("100")).quantize(
                        Decimal("0.01")
                    )
            elif settings.water_distribution_mode == WaterDistributionMode.MANUAL:
                cfg = settings.water_distribution_config or {}
                for floor in (1, 2, 3):
                    water_amounts[floor] = Decimal(
                        str(cfg.get(str(floor), cfg.get(floor, 0)))
                    )

    result = calculate_electricity_month(
        billing_year=year,
        billing_month=month,
        main_consumption=main_consumption,
        floor_consumptions=floor_consumption,
        tenant_names=tenant_names,
        tariff=tariff,
        previous_floor_consumptions=previous_consumptions,
        previous_debts=previous_debts,
        water_amounts=water_amounts,
        common_shares=shares,
        common_warning_percent=settings.common_warning_percent,
        consumption_warning_percent=settings.consumption_warning_percent,
    )

    if result.requires_review:
        error = result.error or "requires_review"
        ctx.db.mark_calculation_requires_review(year, month, error)
        await message.answer(error)
        await ctx.status.refresh(year, month)
        logger.warning("calculation_requires_review year=%s month=%s", year, month)
        return

    calc_row = ctx.db.upsert_monthly_calculation(
        {
            "billing_year": year,
            "billing_month": month,
            "main_consumption": str(result.main_consumption),
            "common_kwh": str(result.common_kwh),
            "common_percentage": str(result.common_percentage),
            "electricity_tariff": str(result.tariff),
            "status": CalculationStatus.COMPLETED.value,
            "warnings": result.warnings,
            "details": result.model_dump(mode="json"),
        }
    )

    for floor in result.floors:
        tenant = ctx.db.get_tenant_by_floor(floor.floor_number)
        if not tenant:
            continue
        ctx.db.upsert_charge(
            {
                "calculation_id": calc_row["id"],
                "tenant_id": str(tenant.id),
                "billing_year": year,
                "billing_month": month,
                "personal_kwh": str(floor.personal_kwh),
                "allocated_common_kwh": str(floor.allocated_common_kwh),
                "personal_electricity_amount": str(floor.personal_amount),
                "common_electricity_amount": str(floor.common_amount),
                "electricity_total": str(floor.electricity_total),
                "water_amount": str(floor.water_amount),
                "previous_debt": str(floor.previous_debt),
                "adjustments": str(floor.adjustments),
                "total_due": str(floor.total_due),
                "confirmed_payments": "0",
                "debt": str(floor.total_due),
                "payment_status": PaymentStatus.UNPAID.value,
            }
        )

    text = format_calculation_message(result)
    await message.answer(text)
    await ctx.status.refresh(year, month)
    logger.info("calculation_completed year=%s month=%s", year, month)


async def _handle_payment(
    ctx: AppContext,
    message: Message,
    data: bytes,
    filename: str,
    mime: str,
    payment_data: dict,
    year: int,
    month: int,
) -> None:
    amount = payment_data.get("amount")
    if amount is None:
        await message.reply("❌ Не удалось определить сумму оплаты.")
        return

    path = ctx.storage.upload_payment_document(
        data, filename=filename, content_type=mime, year=year, month=month
    )

    tenant = _resolve_payer_tenant(ctx, message, payment_data.get("payer"))
    if tenant is None:
        await message.reply(
            "❌ Не удалось сопоставить оплату с этажом.\n"
            "Укажите в подписи: 1 этаж / 2 этаж / 3 этаж "
            "или имя ответственного."
        )
        return

    charge = ctx.db.get_charge_for_tenant(tenant.id, year, month)
    if not charge:
        await message.reply(
            "❌ Нет начисления за текущий месяц для этого этажа.\n"
            "Сначала должны быть приняты показания и выполнен расчёт."
        )
        return

    already = Decimal(str(charge.get("confirmed_payments") or 0))
    due = Decimal(str(charge.get("total_due") or 0))
    result = apply_payment(due, already, Decimal(str(amount)))

    ctx.db.insert_payment(
        {
            "charge_id": charge["id"],
            "tenant_id": str(tenant.id),
            "amount": str(result.paid - already),
            "payment_date": payment_data.get("payment_date"),
            "document_number": payment_data.get("document_number"),
            "payer_name": payment_data.get("payer") or tenant.responsible_name,
            "document_path": path,
            "source": "telegram",
            "confidence": str(payment_data.get("confidence") or 0),
        }
    )
    ctx.db.update_charge_payment(
        UUID(charge["id"]),
        confirmed_payments=result.paid,
        debt=result.remaining,
        payment_status=result.status,
    )

    await message.reply(format_payment_confirmation(tenant.responsible_name, result))
    await ctx.status.refresh(year, month)
    logger.info(
        "payment_recorded tenant=%s status=%s paid=%s",
        tenant.responsible_name,
        result.status.value,
        result.paid,
    )


async def _handle_pdf_payment(
    ctx: AppContext,
    message: Message,
    data: bytes,
    filename: str,
    year: int,
    month: int,
) -> None:
    # Store PDF; extract amount from caption if present (no invented OCR for PDF binary).
    caption = message.caption or ""
    amount = _parse_amount_from_text(caption)
    path = ctx.storage.upload_payment_document(
        data,
        filename=filename,
        content_type="application/pdf",
        year=year,
        month=month,
    )
    if amount is None:
        await message.reply(
            "📄 PDF сохранён.\n"
            "Укажите в подписи сумму и этаж, например: "
            "<code>2 этаж 15000</code>"
        )
        logger.info("pdf_stored_without_amount path=%s", path)
        return

    payment_data = {
        "is_payment_document": True,
        "payer": None,
        "amount": amount,
        "payment_date": None,
        "document_number": None,
        "confidence": 1.0,
    }
    await _handle_payment(
        ctx, message, data, filename, "application/pdf", payment_data, year, month
    )


def _parse_amount_from_text(text: str) -> Optional[Decimal]:
    import re

    match = re.search(r"(\d+(?:[.,]\d{1,2})?)", text.replace(" ", ""))
    if not match:
        return None
    try:
        return Decimal(match.group(1).replace(",", "."))
    except Exception:
        return None


def _resolve_payer_tenant(ctx: AppContext, message: Message, payer_name: Optional[str]):
    caption = (message.caption or "").lower()
    for tenant in ctx.db.list_tenants():
        if f"{tenant.floor_number} этаж" in caption or f"{tenant.floor_number}этаж" in caption:
            return tenant
        if tenant.responsible_name.lower() in caption:
            return tenant
        if payer_name and tenant.responsible_name.lower() in str(payer_name).lower():
            return tenant
        if (
            tenant.telegram_user_id
            and message.from_user
            and tenant.telegram_user_id == message.from_user.id
        ):
            return tenant
    return None
