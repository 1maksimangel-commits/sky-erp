-- Kuznetsova Utility Bot — simple schema for one building / three floors.
-- Run in Supabase SQL editor (or psql) once.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- Tenants
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    floor_number INTEGER NOT NULL UNIQUE CHECK (floor_number BETWEEN 1 AND 3),
    responsible_name TEXT NOT NULL,
    phone TEXT,
    work_hours_start TEXT NOT NULL,
    work_hours_end TEXT NOT NULL,
    work_hours_per_day NUMERIC(6, 2) NOT NULL,
    common_electricity_share NUMERIC(10, 6) NOT NULL,
    telegram_user_id BIGINT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Meters
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS meters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meter_number TEXT NOT NULL UNIQUE,
    model_name TEXT NOT NULL,
    meter_kind TEXT NOT NULL CHECK (
        meter_kind IN ('floor_electricity', 'main_electricity', 'common_water')
    ),
    coefficient NUMERIC(10, 4) NOT NULL DEFAULT 1,
    tenant_id UUID REFERENCES tenants (id),
    baseline_reading NUMERIC(14, 3),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_meters_tenant ON meters (tenant_id);
CREATE INDEX IF NOT EXISTS idx_meters_kind ON meters (meter_kind);

-- ---------------------------------------------------------------------------
-- Tariffs (historical — never overwrite; insert new rows)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tariffs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    utility_type TEXT NOT NULL CHECK (utility_type IN ('electricity', 'water')),
    price NUMERIC(14, 4) NOT NULL CHECK (price >= 0),
    valid_from DATE NOT NULL,
    valid_to DATE,
    currency TEXT NOT NULL DEFAULT 'RUB',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (valid_to IS NULL OR valid_to >= valid_from)
);

CREATE INDEX IF NOT EXISTS idx_tariffs_lookup
    ON tariffs (utility_type, valid_from, valid_to);

-- ---------------------------------------------------------------------------
-- Readings
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS readings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meter_id UUID NOT NULL REFERENCES meters (id),
    billing_year INTEGER NOT NULL,
    billing_month INTEGER NOT NULL CHECK (billing_month BETWEEN 1 AND 12),
    reading_value NUMERIC(14, 3) NOT NULL,
    previous_reading NUMERIC(14, 3),
    consumption NUMERIC(14, 3),
    photo_path TEXT,
    confidence NUMERIC(5, 4),
    status TEXT NOT NULL DEFAULT 'approved'
        CHECK (status IN ('pending', 'approved', 'rejected', 'requires_review')),
    submitted_by_telegram_id BIGINT,
    recognized_meter_number TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (meter_id, billing_year, billing_month, status)
);

-- Allow re-submissions: unique only for approved readings per meter/month
DROP INDEX IF EXISTS readings_meter_id_billing_year_billing_month_status_key;
ALTER TABLE readings DROP CONSTRAINT IF EXISTS readings_meter_id_billing_year_billing_month_status_key;

CREATE UNIQUE INDEX IF NOT EXISTS uq_readings_approved_per_month
    ON readings (meter_id, billing_year, billing_month)
    WHERE status = 'approved';

CREATE INDEX IF NOT EXISTS idx_readings_period
    ON readings (billing_year, billing_month);

-- ---------------------------------------------------------------------------
-- Monthly calculations
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS monthly_calculations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    billing_year INTEGER NOT NULL,
    billing_month INTEGER NOT NULL CHECK (billing_month BETWEEN 1 AND 12),
    main_consumption NUMERIC(14, 3),
    common_kwh NUMERIC(14, 3),
    common_percentage NUMERIC(8, 4),
    electricity_tariff NUMERIC(14, 4),
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'completed', 'requires_review')),
    warnings JSONB NOT NULL DEFAULT '[]'::jsonb,
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (billing_year, billing_month)
);

-- ---------------------------------------------------------------------------
-- Charges (per tenant per month)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS charges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    calculation_id UUID NOT NULL REFERENCES monthly_calculations (id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants (id),
    billing_year INTEGER NOT NULL,
    billing_month INTEGER NOT NULL,
    personal_kwh NUMERIC(14, 3) NOT NULL DEFAULT 0,
    allocated_common_kwh NUMERIC(14, 3) NOT NULL DEFAULT 0,
    personal_electricity_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
    common_electricity_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
    electricity_total NUMERIC(14, 2) NOT NULL DEFAULT 0,
    water_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
    previous_debt NUMERIC(14, 2) NOT NULL DEFAULT 0,
    adjustments NUMERIC(14, 2) NOT NULL DEFAULT 0,
    total_due NUMERIC(14, 2) NOT NULL DEFAULT 0,
    confirmed_payments NUMERIC(14, 2) NOT NULL DEFAULT 0,
    debt NUMERIC(14, 2) NOT NULL DEFAULT 0,
    payment_status TEXT NOT NULL DEFAULT 'unpaid'
        CHECK (payment_status IN ('unpaid', 'partially_paid', 'paid')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, billing_year, billing_month)
);

CREATE INDEX IF NOT EXISTS idx_charges_period ON charges (billing_year, billing_month);

-- ---------------------------------------------------------------------------
-- Payments
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    charge_id UUID NOT NULL REFERENCES charges (id),
    tenant_id UUID NOT NULL REFERENCES tenants (id),
    amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
    payment_date DATE,
    document_number TEXT,
    payer_name TEXT,
    document_path TEXT,
    source TEXT NOT NULL DEFAULT 'telegram',
    confidence NUMERIC(5, 4),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payments_charge ON payments (charge_id);
CREATE INDEX IF NOT EXISTS idx_payments_tenant ON payments (tenant_id);

-- ---------------------------------------------------------------------------
-- Monthly status (one pinned Telegram message per month)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS monthly_status (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    billing_year INTEGER NOT NULL,
    billing_month INTEGER NOT NULL,
    telegram_message_id BIGINT,
    status_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (billing_year, billing_month)
);

-- ---------------------------------------------------------------------------
-- Bot settings (single-row style key/value)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bot_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Reminders log (avoid duplicate daily posts)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reminders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    billing_year INTEGER NOT NULL,
    billing_month INTEGER NOT NULL,
    reminder_day INTEGER NOT NULL,
    reminder_kind TEXT NOT NULL,
    sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (billing_year, billing_month, reminder_day, reminder_kind)
);

-- ===========================================================================
-- SEED DATA
-- ===========================================================================

INSERT INTO tenants (
    floor_number, responsible_name, phone,
    work_hours_start, work_hours_end, work_hours_per_day, common_electricity_share
) VALUES
    (1, 'Константин', '+79140651556', '10:00', '22:00', 12, 0.375),
    (2, 'Данил', '+79242414752', '10:00', '21:00', 11, 0.34375),
    (3, 'Наталья', NULL, '09:00', '18:00', 9, 0.28125)
ON CONFLICT (floor_number) DO NOTHING;

INSERT INTO meters (meter_number, model_name, meter_kind, coefficient, tenant_id, baseline_reading)
SELECT '57053067', 'НЕВА 303 1SO', 'floor_electricity', 1, t.id, 193905.0
FROM tenants t WHERE t.floor_number = 1
ON CONFLICT (meter_number) DO NOTHING;

INSERT INTO meters (meter_number, model_name, meter_kind, coefficient, tenant_id, baseline_reading)
SELECT '57053055', 'НЕВА 303 1SO', 'floor_electricity', 1, t.id, 117222.1
FROM tenants t WHERE t.floor_number = 2
ON CONFLICT (meter_number) DO NOTHING;

INSERT INTO meters (meter_number, model_name, meter_kind, coefficient, tenant_id, baseline_reading)
SELECT '3200005857', 'ЭНРОН 301-10(100)-1-ШР2М', 'floor_electricity', 1, t.id, 10886.9
FROM tenants t WHERE t.floor_number = 3
ON CONFLICT (meter_number) DO NOTHING;

-- Main building electricity — baseline pending (do not invent)
INSERT INTO meters (meter_number, model_name, meter_kind, coefficient, tenant_id, baseline_reading)
VALUES ('21650270', 'Меркурий 230 ART-01 RN', 'main_electricity', 1, NULL, NULL)
ON CONFLICT (meter_number) DO NOTHING;

-- Common water — baseline pending (do not invent)
INSERT INTO meters (meter_number, model_name, meter_kind, coefficient, tenant_id, baseline_reading)
SELECT '47547455', 'Общий водомер', 'common_water', 1, t.id, NULL
FROM tenants t WHERE t.floor_number = 1
ON CONFLICT (meter_number) DO NOTHING;

-- Default bot settings
INSERT INTO bot_settings (key, value) VALUES
    ('telegram_group_id', 'null'::jsonb),
    ('timezone', '"Asia/Vladivostok"'::jsonb),
    ('reminder_start_day', '23'::jsonb),
    ('reading_due_day', '25'::jsonb),
    ('common_warning_percent', '25'::jsonb),
    ('consumption_warning_percent', '30'::jsonb),
    ('water_distribution_mode', '"unconfigured"'::jsonb),
    ('water_distribution_config', '{}'::jsonb),
    ('vision_confidence_threshold', '0.70'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Note: electricity / water tariffs must be inserted with real prices before
-- calculations can finalize money amounts. Example (do not invent production price):
-- INSERT INTO tariffs (utility_type, price, valid_from)
-- VALUES ('electricity', 0.0000, '2026-01-01');
