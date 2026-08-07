# Kuznetsova Utility Bot

Private Telegram utility bot for **one building** and **one Telegram group** with three floors.

Not a SaaS/ERP. No admin portal. All reminders, meter photos, calculations, payments, and debt notices happen in the common group.

## Features

- Monthly meter collection reminders (23–25, `Asia/Vladivostok`)
- Photo → Supabase Storage → OpenAI Vision → validated reading
- Electricity calculation with common-area split by work hours (37.5% / 34.375% / 28.125%)
- Configurable water distribution (`equal` / `percentages` / `manual` / `unconfigured`)
- Public pinned monthly status message
- Payment receipts (photo/PDF) with partial/full payment and debt carry-forward

## Requirements

- Python **3.13** (Docker image uses 3.13; local 3.11+ usually works for tests)
- Supabase project (Postgres + Storage)
- Telegram bot token
- OpenAI API key (vision-capable model, default `gpt-4o`)

---

## 1. Python setup

```bash
cd kuznetsova-utility-bot
python3.13 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

## 2. Create `.env`

```bash
cp .env.example .env
```

Fill in:

```env
TELEGRAM_BOT_TOKEN=
TELEGRAM_GROUP_ID=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
OPENAI_API_KEY=
TIMEZONE=Asia/Vladivostok
LOG_LEVEL=INFO
```

Never commit `.env`.

## 3. Supabase setup

1. Create a Supabase project.
2. Copy **Project URL** → `SUPABASE_URL`.
3. Copy **service_role** key → `SUPABASE_SERVICE_ROLE_KEY` (server-only; do not expose to clients).

## 4. Run schema + seed

In Supabase SQL Editor, paste and run:

`sql/schema.sql`

This creates tables and seeds:

| Floor | Person | Phone | Meters |
| --- | --- | --- | --- |
| 1 | Константин | +79140651556 | 57053067, main 21650270, water 47547455 |
| 2 | Данил | +79242414752 | 57053055 |
| 3 | Наталья | — | 3200005857 |

Baselines are seeded for floor meters only. Main and water baselines stay `NULL` until real values arrive.

### Tariffs (required before money calculation)

Insert a real electricity tariff (do not invent production prices):

```sql
INSERT INTO tariffs (utility_type, price, valid_from)
VALUES ('electricity', 6.5000, '2026-01-01');
```

Optional water tariff when distribution is configured:

```sql
INSERT INTO tariffs (utility_type, price, valid_from)
VALUES ('water', 50.0000, '2026-01-01');
```

### Optional: bind Telegram user IDs

```sql
UPDATE tenants SET telegram_user_id = 123456789 WHERE floor_number = 1;
UPDATE tenants SET telegram_user_id = 234567890 WHERE floor_number = 2;
UPDATE tenants SET telegram_user_id = 345678901 WHERE floor_number = 3;
```

### Water distribution rule

Default is `unconfigured` (reading stored, water charge not finalized).

```sql
-- equal split example
UPDATE bot_settings SET value = '"equal"' WHERE key = 'water_distribution_mode';

-- or percentages
UPDATE bot_settings SET value = '"percentages"' WHERE key = 'water_distribution_mode';
UPDATE bot_settings SET value = '{"1": 40, "2": 30, "3": 30}' WHERE key = 'water_distribution_config';
```

## 5. Create Storage buckets

In Supabase Storage, create **private** buckets:

- `meter-photos`
- `payment-documents`
- `reports`

Do not make payment documents public.

## 6. Telegram bot token

1. Create a bot with [@BotFather](https://t.me/BotFather).
2. Put the token in `TELEGRAM_BOT_TOKEN`.
3. Add the bot to the building group.
4. Disable privacy mode if the bot must see all group photos (`/setprivacy` → Disable), or make the bot an admin.

## 7. Telegram group ID

1. Add the bot to the target group.
2. Send any message, then call `https://api.telegram.org/bot<TOKEN>/getUpdates`.
3. Read `chat.id` (often negative for groups) → `TELEGRAM_GROUP_ID`.

Also store it in DB if desired:

```sql
UPDATE bot_settings SET value = '-1001234567890' WHERE key = 'telegram_group_id';
```

The bot still requires `TELEGRAM_GROUP_ID` in `.env` for runtime filtering.

## 8. OpenAI key

Set `OPENAI_API_KEY` for a vision-capable model (default `gpt-4o`).

## 9. Start locally

```bash
source .venv/bin/activate
python -m app.main
```

## 10. Start with Docker

```bash
docker compose up --build -d
docker compose logs -f bot
```

## 11. Testing the bot

1. In the configured group, send a clear meter photo.
2. Expect `✅ Показание принято` or a retry message if recognition is weak.
3. After all four electricity readings (main + 3 floors) and a tariff row exists, expect the monthly calculation message.
4. Send a payment photo/PDF with caption like `1 этаж 14040.50`.
5. Check the pinned status message updates.

### Automated tests

```bash
pytest -q
```

Covers consumption math, common split, negative common error, 25%/30% warnings, partial/full payment, debt carry-forward, status text.

## 12. Deployment options

- **Docker Compose** on a small VPS (recommended): keep `.env` on the host, `restart: unless-stopped`.
- **Any always-on host** with Python 3.13: `python -m app.main` under systemd.
- Supabase stays the database/storage backend; the bot process must stay online for polling + APScheduler.

No webhook is required for the MVP (long polling).

---

## Project layout

```text
kuznetsova-utility-bot/
├── app/
│   ├── main.py              # entrypoint
│   ├── config.py            # env settings
│   ├── bot.py               # Bot/Dispatcher + logging
│   ├── handlers.py          # group photos/documents workflow
│   ├── database.py          # Supabase Postgres access
│   ├── storage.py           # Supabase Storage uploads
│   ├── vision.py            # OpenAI Vision JSON extraction
│   ├── calculations.py      # pure electricity math
│   ├── payments.py          # pure payment/debt math
│   ├── scheduler.py         # 23/24/25 reminders
│   ├── status_message.py    # pinned monthly status
│   └── models.py
├── sql/schema.sql
├── tests/
├── Dockerfile
├── docker-compose.yml
└── README.md
```

## Security notes

- Utility workflow runs only in `TELEGRAM_GROUP_ID`; other group chats are ignored and logged.
- Meter serial number is the primary identity check (not Telegram sender alone).
- Service role key and bot token stay on the server only.
- Logs never print full API keys or full banking payloads.

## Missing real-world data (expected)

- Main meter baseline (`21650270`)
- Water meter baseline (`47547455`)
- Наталья phone number
- Telegram user IDs for the three responsible people
- Actual electricity (and optionally water) tariff prices
- Water distribution rule choice
