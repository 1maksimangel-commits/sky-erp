"""Domain models and enums for Kuznetsova Utility Bot."""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from enum import Enum
from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class PaymentStatus(str, Enum):
    UNPAID = "unpaid"
    PARTIALLY_PAID = "partially_paid"
    PAID = "paid"


class WaterDistributionMode(str, Enum):
    EQUAL = "equal"
    PERCENTAGES = "percentages"
    MANUAL = "manual"
    UNCONFIGURED = "unconfigured"


class MeterKind(str, Enum):
    FLOOR_ELECTRICITY = "floor_electricity"
    MAIN_ELECTRICITY = "main_electricity"
    COMMON_WATER = "common_water"


class ReadingStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    REQUIRES_REVIEW = "requires_review"


class CalculationStatus(str, Enum):
    PENDING = "pending"
    COMPLETED = "completed"
    REQUIRES_REVIEW = "requires_review"


class UtilityType(str, Enum):
    ELECTRICITY = "electricity"
    WATER = "water"


class Tenant(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    floor_number: int
    responsible_name: str
    phone: Optional[str] = None
    work_hours_start: str
    work_hours_end: str
    work_hours_per_day: Decimal
    common_electricity_share: Decimal
    telegram_user_id: Optional[int] = None
    is_active: bool = True


class Meter(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    meter_number: str
    model_name: str
    meter_kind: MeterKind
    coefficient: Decimal = Decimal("1")
    tenant_id: Optional[UUID] = None
    baseline_reading: Optional[Decimal] = None
    is_active: bool = True


class Tariff(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    utility_type: UtilityType
    price: Decimal
    valid_from: date
    valid_to: Optional[date] = None
    currency: str = "RUB"


class Reading(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    meter_id: UUID
    billing_year: int
    billing_month: int
    reading_value: Decimal
    previous_reading: Optional[Decimal] = None
    consumption: Optional[Decimal] = None
    photo_path: Optional[str] = None
    confidence: Optional[Decimal] = None
    status: ReadingStatus = ReadingStatus.APPROVED
    submitted_by_telegram_id: Optional[int] = None
    recognized_meter_number: Optional[str] = None
    created_at: Optional[datetime] = None


class VisionResult(BaseModel):
    is_meter: bool
    meter_number: Optional[str] = None
    reading: Optional[Decimal] = None
    meter_type: Optional[str] = None
    confidence: float = 0.0


class FloorConsumption(BaseModel):
    floor_number: int
    tenant_name: str
    personal_kwh: Decimal
    allocated_common_kwh: Decimal
    personal_amount: Decimal
    common_amount: Decimal
    electricity_total: Decimal
    water_amount: Decimal = Decimal("0")
    previous_debt: Decimal = Decimal("0")
    adjustments: Decimal = Decimal("0")
    total_due: Decimal
    anomaly_percent: Optional[Decimal] = None


class ElectricityCalculationResult(BaseModel):
    billing_year: int
    billing_month: int
    main_consumption: Decimal
    floor_consumptions: dict[int, Decimal]
    common_kwh: Decimal
    common_percentage: Decimal
    tariff: Decimal
    floors: list[FloorConsumption]
    warnings: list[str] = Field(default_factory=list)
    requires_review: bool = False
    error: Optional[str] = None


class PaymentMatchResult(BaseModel):
    status: PaymentStatus
    charged: Decimal
    paid: Decimal
    remaining: Decimal
    message: str


class BotSettings(BaseModel):
    telegram_group_id: Optional[int] = None
    timezone: str = "Asia/Vladivostok"
    reminder_start_day: int = 23
    reading_due_day: int = 25
    common_warning_percent: Decimal = Decimal("25")
    consumption_warning_percent: Decimal = Decimal("30")
    water_distribution_mode: WaterDistributionMode = WaterDistributionMode.UNCONFIGURED
    water_distribution_config: dict[str, Any] = Field(default_factory=dict)
    vision_confidence_threshold: Decimal = Decimal("0.70")


# Fixed common electricity shares (hours-based), unless changed explicitly in DB seed.
COMMON_SHARE_FLOOR_1 = Decimal("0.375")
COMMON_SHARE_FLOOR_2 = Decimal("0.34375")
COMMON_SHARE_FLOOR_3 = Decimal("0.28125")

FLOOR_WORK_HOURS = {
    1: Decimal("12"),
    2: Decimal("11"),
    3: Decimal("9"),
}

MONTH_NAMES_RU = {
    1: "Январь",
    2: "Февраль",
    3: "Март",
    4: "Апрель",
    5: "Май",
    6: "Июнь",
    7: "Июль",
    8: "Август",
    9: "Сентябрь",
    10: "Октябрь",
    11: "Ноябрь",
    12: "Декабрь",
}
