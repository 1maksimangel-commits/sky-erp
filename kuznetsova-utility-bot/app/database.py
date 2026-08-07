"""Supabase database access for Kuznetsova Utility Bot."""

from __future__ import annotations

import logging
from datetime import date
from decimal import Decimal
from typing import Any, Optional
from uuid import UUID

from supabase import Client, create_client

from app.models import (
    BotSettings,
    CalculationStatus,
    Meter,
    MeterKind,
    PaymentStatus,
    ReadingStatus,
    Tenant,
    UtilityType,
    WaterDistributionMode,
)

logger = logging.getLogger(__name__)


def _dec(value: Any) -> Optional[Decimal]:
    if value is None:
        return None
    return Decimal(str(value))


def _tenant(row: dict[str, Any]) -> Tenant:
    return Tenant(
        id=UUID(row["id"]),
        floor_number=int(row["floor_number"]),
        responsible_name=row["responsible_name"],
        phone=row.get("phone"),
        work_hours_start=row["work_hours_start"],
        work_hours_end=row["work_hours_end"],
        work_hours_per_day=Decimal(str(row["work_hours_per_day"])),
        common_electricity_share=Decimal(str(row["common_electricity_share"])),
        telegram_user_id=row.get("telegram_user_id"),
        is_active=bool(row.get("is_active", True)),
    )


def _meter(row: dict[str, Any]) -> Meter:
    return Meter(
        id=UUID(row["id"]),
        meter_number=str(row["meter_number"]),
        model_name=row["model_name"],
        meter_kind=MeterKind(row["meter_kind"]),
        coefficient=Decimal(str(row.get("coefficient") or 1)),
        tenant_id=UUID(row["tenant_id"]) if row.get("tenant_id") else None,
        baseline_reading=_dec(row.get("baseline_reading")),
        is_active=bool(row.get("is_active", True)),
    )


class Database:
    def __init__(self, client: Client) -> None:
        self.client = client

    @classmethod
    def from_settings(cls, url: str, service_role_key: str) -> "Database":
        client = create_client(url, service_role_key)
        return cls(client)

    # ------------------------------------------------------------------ tenants
    def list_tenants(self) -> list[Tenant]:
        resp = (
            self.client.table("tenants")
            .select("*")
            .eq("is_active", True)
            .order("floor_number")
            .execute()
        )
        return [_tenant(r) for r in (resp.data or [])]

    def get_tenant_by_floor(self, floor_number: int) -> Optional[Tenant]:
        resp = (
            self.client.table("tenants")
            .select("*")
            .eq("floor_number", floor_number)
            .limit(1)
            .execute()
        )
        rows = resp.data or []
        return _tenant(rows[0]) if rows else None

    def get_tenant(self, tenant_id: UUID) -> Optional[Tenant]:
        resp = (
            self.client.table("tenants")
            .select("*")
            .eq("id", str(tenant_id))
            .limit(1)
            .execute()
        )
        rows = resp.data or []
        return _tenant(rows[0]) if rows else None

    # ------------------------------------------------------------------- meters
    def list_meters(self) -> list[Meter]:
        resp = self.client.table("meters").select("*").eq("is_active", True).execute()
        return [_meter(r) for r in (resp.data or [])]

    def get_meter_by_number(self, meter_number: str) -> Optional[Meter]:
        # Normalize: strip spaces / leading zeros carefully — keep exact match first.
        cleaned = meter_number.strip().replace(" ", "")
        resp = (
            self.client.table("meters")
            .select("*")
            .eq("meter_number", cleaned)
            .limit(1)
            .execute()
        )
        rows = resp.data or []
        if rows:
            return _meter(rows[0])
        # Fallback: compare without leading zeros
        for meter in self.list_meters():
            if meter.meter_number.lstrip("0") == cleaned.lstrip("0"):
                return meter
        return None

    def meters_for_responsible_floor(self, floor_number: int) -> list[Meter]:
        """Meters that the given floor is responsible for submitting."""
        meters = self.list_meters()
        if floor_number == 1:
            allowed = {
                MeterKind.FLOOR_ELECTRICITY,
                MeterKind.MAIN_ELECTRICITY,
                MeterKind.COMMON_WATER,
            }
            result: list[Meter] = []
            for m in meters:
                if m.meter_kind == MeterKind.MAIN_ELECTRICITY:
                    result.append(m)
                elif m.meter_kind == MeterKind.COMMON_WATER:
                    result.append(m)
                elif m.meter_kind == MeterKind.FLOOR_ELECTRICITY:
                    tenant = self.get_tenant(m.tenant_id) if m.tenant_id else None
                    if tenant and tenant.floor_number == 1:
                        result.append(m)
            return result
        # Floors 2 and 3: only their own floor electricity meter
        result = []
        for m in meters:
            if m.meter_kind != MeterKind.FLOOR_ELECTRICITY or not m.tenant_id:
                continue
            tenant = self.get_tenant(m.tenant_id)
            if tenant and tenant.floor_number == floor_number:
                result.append(m)
        return result

    def is_meter_allowed_for_floor(self, meter: Meter, floor_number: int) -> bool:
        allowed = {m.meter_number for m in self.meters_for_responsible_floor(floor_number)}
        return meter.meter_number in allowed

    # ----------------------------------------------------------------- settings
    def get_bot_settings(self) -> BotSettings:
        resp = self.client.table("bot_settings").select("key,value").execute()
        raw: dict[str, Any] = {}
        for row in resp.data or []:
            raw[row["key"]] = row["value"]

        mode_raw = raw.get("water_distribution_mode", "unconfigured")
        if isinstance(mode_raw, str):
            mode = mode_raw.strip('"')
        else:
            mode = str(mode_raw)

        group_id = raw.get("telegram_group_id")
        if group_id == "null" or group_id is None:
            telegram_group_id = None
        else:
            telegram_group_id = int(group_id)

        return BotSettings(
            telegram_group_id=telegram_group_id,
            timezone=str(raw.get("timezone", "Asia/Vladivostok")).strip('"'),
            reminder_start_day=int(raw.get("reminder_start_day", 23)),
            reading_due_day=int(raw.get("reading_due_day", 25)),
            common_warning_percent=Decimal(
                str(raw.get("common_warning_percent", 25))
            ),
            consumption_warning_percent=Decimal(
                str(raw.get("consumption_warning_percent", 30))
            ),
            water_distribution_mode=WaterDistributionMode(mode),
            water_distribution_config=raw.get("water_distribution_config") or {},
            vision_confidence_threshold=Decimal(
                str(raw.get("vision_confidence_threshold", "0.70"))
            ),
        )

    def set_setting(self, key: str, value: Any) -> None:
        self.client.table("bot_settings").upsert(
            {"key": key, "value": value}
        ).execute()

    # ----------------------------------------------------------------- tariffs
    def get_active_tariff(
        self, utility_type: UtilityType, on_date: date
    ) -> Optional[Decimal]:
        resp = (
            self.client.table("tariffs")
            .select("*")
            .eq("utility_type", utility_type.value)
            .lte("valid_from", on_date.isoformat())
            .order("valid_from", desc=True)
            .execute()
        )
        for row in resp.data or []:
            valid_to = row.get("valid_to")
            if valid_to is None or valid_to >= on_date.isoformat():
                return Decimal(str(row["price"]))
        return None

    # ---------------------------------------------------------------- readings
    def get_previous_reading_value(self, meter_id: UUID) -> Optional[Decimal]:
        resp = (
            self.client.table("readings")
            .select("reading_value,billing_year,billing_month")
            .eq("meter_id", str(meter_id))
            .eq("status", ReadingStatus.APPROVED.value)
            .order("billing_year", desc=True)
            .order("billing_month", desc=True)
            .limit(1)
            .execute()
        )
        rows = resp.data or []
        if rows:
            return Decimal(str(rows[0]["reading_value"]))
        meter_resp = (
            self.client.table("meters")
            .select("baseline_reading")
            .eq("id", str(meter_id))
            .limit(1)
            .execute()
        )
        mrows = meter_resp.data or []
        if mrows and mrows[0].get("baseline_reading") is not None:
            return Decimal(str(mrows[0]["baseline_reading"]))
        return None

    def get_approved_reading(
        self, meter_id: UUID, year: int, month: int
    ) -> Optional[dict[str, Any]]:
        resp = (
            self.client.table("readings")
            .select("*")
            .eq("meter_id", str(meter_id))
            .eq("billing_year", year)
            .eq("billing_month", month)
            .eq("status", ReadingStatus.APPROVED.value)
            .limit(1)
            .execute()
        )
        rows = resp.data or []
        return rows[0] if rows else None

    def save_approved_reading(
        self,
        *,
        meter_id: UUID,
        year: int,
        month: int,
        reading_value: Decimal,
        previous_reading: Optional[Decimal],
        consumption: Optional[Decimal],
        photo_path: str,
        confidence: Decimal,
        submitted_by_telegram_id: Optional[int],
        recognized_meter_number: str,
    ) -> dict[str, Any]:
        payload = {
            "meter_id": str(meter_id),
            "billing_year": year,
            "billing_month": month,
            "reading_value": str(reading_value),
            "previous_reading": str(previous_reading) if previous_reading is not None else None,
            "consumption": str(consumption) if consumption is not None else None,
            "photo_path": photo_path,
            "confidence": str(confidence),
            "status": ReadingStatus.APPROVED.value,
            "submitted_by_telegram_id": submitted_by_telegram_id,
            "recognized_meter_number": recognized_meter_number,
        }
        existing = self.get_approved_reading(meter_id, year, month)
        if existing:
            resp = (
                self.client.table("readings")
                .update(payload)
                .eq("id", existing["id"])
                .execute()
            )
        else:
            resp = self.client.table("readings").insert(payload).execute()
        rows = resp.data or []
        if not rows:
            raise RuntimeError("Failed to save reading")
        logger.info(
            "reading_saved",
            extra={
                "meter_id": str(meter_id),
                "year": year,
                "month": month,
                "reading": str(reading_value),
            },
        )
        return rows[0]

    def list_approved_readings_for_month(
        self, year: int, month: int
    ) -> list[dict[str, Any]]:
        resp = (
            self.client.table("readings")
            .select("*, meters(*)")
            .eq("billing_year", year)
            .eq("billing_month", month)
            .eq("status", ReadingStatus.APPROVED.value)
            .execute()
        )
        return list(resp.data or [])

    # ----------------------------------------------------------- calculations
    def get_monthly_calculation(
        self, year: int, month: int
    ) -> Optional[dict[str, Any]]:
        resp = (
            self.client.table("monthly_calculations")
            .select("*")
            .eq("billing_year", year)
            .eq("billing_month", month)
            .limit(1)
            .execute()
        )
        rows = resp.data or []
        return rows[0] if rows else None

    def upsert_monthly_calculation(self, payload: dict[str, Any]) -> dict[str, Any]:
        resp = (
            self.client.table("monthly_calculations")
            .upsert(payload, on_conflict="billing_year,billing_month")
            .execute()
        )
        rows = resp.data or []
        if not rows:
            raise RuntimeError("Failed to upsert monthly_calculation")
        return rows[0]

    def mark_calculation_requires_review(
        self, year: int, month: int, error: str
    ) -> dict[str, Any]:
        return self.upsert_monthly_calculation(
            {
                "billing_year": year,
                "billing_month": month,
                "status": CalculationStatus.REQUIRES_REVIEW.value,
                "warnings": [error],
                "details": {"error": error},
            }
        )

    # ----------------------------------------------------------------- charges
    def upsert_charge(self, payload: dict[str, Any]) -> dict[str, Any]:
        resp = (
            self.client.table("charges")
            .upsert(payload, on_conflict="tenant_id,billing_year,billing_month")
            .execute()
        )
        rows = resp.data or []
        if not rows:
            raise RuntimeError("Failed to upsert charge")
        return rows[0]

    def list_charges(self, year: int, month: int) -> list[dict[str, Any]]:
        resp = (
            self.client.table("charges")
            .select("*, tenants(*)")
            .eq("billing_year", year)
            .eq("billing_month", month)
            .execute()
        )
        return list(resp.data or [])

    def get_charge_for_tenant(
        self, tenant_id: UUID, year: int, month: int
    ) -> Optional[dict[str, Any]]:
        resp = (
            self.client.table("charges")
            .select("*")
            .eq("tenant_id", str(tenant_id))
            .eq("billing_year", year)
            .eq("billing_month", month)
            .limit(1)
            .execute()
        )
        rows = resp.data or []
        return rows[0] if rows else None

    def get_previous_debt(self, tenant_id: UUID, year: int, month: int) -> Decimal:
        """Debt from the immediately previous billing month."""
        prev_year, prev_month = (year, month - 1) if month > 1 else (year - 1, 12)
        charge = self.get_charge_for_tenant(tenant_id, prev_year, prev_month)
        if not charge:
            return Decimal("0")
        return Decimal(str(charge.get("debt") or 0))

    def get_previous_floor_consumption(
        self, floor_number: int, year: int, month: int
    ) -> Optional[Decimal]:
        prev_year, prev_month = (year, month - 1) if month > 1 else (year - 1, 12)
        tenant = self.get_tenant_by_floor(floor_number)
        if not tenant:
            return None
        charge = self.get_charge_for_tenant(tenant.id, prev_year, prev_month)
        if not charge:
            return None
        return Decimal(str(charge.get("personal_kwh") or 0))

    def update_charge_payment(
        self,
        charge_id: UUID,
        *,
        confirmed_payments: Decimal,
        debt: Decimal,
        payment_status: PaymentStatus,
    ) -> dict[str, Any]:
        resp = (
            self.client.table("charges")
            .update(
                {
                    "confirmed_payments": str(confirmed_payments),
                    "debt": str(debt),
                    "payment_status": payment_status.value,
                }
            )
            .eq("id", str(charge_id))
            .execute()
        )
        rows = resp.data or []
        if not rows:
            raise RuntimeError("Failed to update charge payment")
        return rows[0]

    # ---------------------------------------------------------------- payments
    def insert_payment(self, payload: dict[str, Any]) -> dict[str, Any]:
        resp = self.client.table("payments").insert(payload).execute()
        rows = resp.data or []
        if not rows:
            raise RuntimeError("Failed to insert payment")
        return rows[0]

    # ----------------------------------------------------------- monthly status
    def get_monthly_status(
        self, year: int, month: int
    ) -> Optional[dict[str, Any]]:
        resp = (
            self.client.table("monthly_status")
            .select("*")
            .eq("billing_year", year)
            .eq("billing_month", month)
            .limit(1)
            .execute()
        )
        rows = resp.data or []
        return rows[0] if rows else None

    def upsert_monthly_status(
        self,
        year: int,
        month: int,
        payload: dict[str, Any],
        telegram_message_id: Optional[int] = None,
    ) -> dict[str, Any]:
        body: dict[str, Any] = {
            "billing_year": year,
            "billing_month": month,
            "status_payload": payload,
        }
        if telegram_message_id is not None:
            body["telegram_message_id"] = telegram_message_id
        resp = (
            self.client.table("monthly_status")
            .upsert(body, on_conflict="billing_year,billing_month")
            .execute()
        )
        rows = resp.data or []
        if not rows:
            raise RuntimeError("Failed to upsert monthly_status")
        return rows[0]

    # --------------------------------------------------------------- reminders
    def reminder_already_sent(
        self, year: int, month: int, day: int, kind: str
    ) -> bool:
        resp = (
            self.client.table("reminders")
            .select("id")
            .eq("billing_year", year)
            .eq("billing_month", month)
            .eq("reminder_day", day)
            .eq("reminder_kind", kind)
            .limit(1)
            .execute()
        )
        return bool(resp.data)

    def mark_reminder_sent(
        self, year: int, month: int, day: int, kind: str
    ) -> None:
        self.client.table("reminders").upsert(
            {
                "billing_year": year,
                "billing_month": month,
                "reminder_day": day,
                "reminder_kind": kind,
            },
            on_conflict="billing_year,billing_month,reminder_day,reminder_kind",
        ).execute()
