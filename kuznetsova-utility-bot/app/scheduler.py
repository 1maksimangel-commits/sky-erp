"""APScheduler jobs for monthly reading reminders (Asia/Vladivostok)."""

from __future__ import annotations

import logging
from datetime import datetime
from zoneinfo import ZoneInfo

from aiogram import Bot
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from app.database import Database
from app.status_message import StatusMessageService

logger = logging.getLogger(__name__)

START_REMINDER = """📢 Начинается приём показаний за текущий месяц.

До 25 числа необходимо отправить фотографии счётчиков.

Константин — 1 этаж:
• счётчик 1 этажа
• главный счётчик здания
• общий водомер

Данил — 2 этаж:
• счётчик 2 этажа

Наталья — 3 этаж:
• счётчик 3 этажа"""


class ReminderScheduler:
    def __init__(
        self,
        bot: Bot,
        db: Database,
        status: StatusMessageService,
        group_id: int,
        timezone: str = "Asia/Vladivostok",
        reminder_start_day: int = 23,
        reading_due_day: int = 25,
    ) -> None:
        self.bot = bot
        self.db = db
        self.status = status
        self.group_id = group_id
        self.timezone = timezone
        self.reminder_start_day = reminder_start_day
        self.reading_due_day = reading_due_day
        self.scheduler = AsyncIOScheduler(timezone=timezone)

    def start(self) -> None:
        tz = ZoneInfo(self.timezone)
        # Run daily at 09:00 local; decide which reminder by day-of-month.
        self.scheduler.add_job(
            self.daily_check,
            CronTrigger(hour=9, minute=0, timezone=tz),
            id="daily_reminder_check",
            replace_existing=True,
        )
        self.scheduler.start()
        logger.info(
            "scheduler_started timezone=%s start_day=%s due_day=%s",
            self.timezone,
            self.reminder_start_day,
            self.reading_due_day,
        )

    def shutdown(self) -> None:
        if self.scheduler.running:
            self.scheduler.shutdown(wait=False)
            logger.info("scheduler_stopped")

    async def daily_check(self) -> None:
        now = datetime.now(ZoneInfo(self.timezone))
        year, month, day = now.year, now.month, now.day
        logger.info("scheduler_tick year=%s month=%s day=%s", year, month, day)

        settings = self.db.get_bot_settings()
        start_day = settings.reminder_start_day or self.reminder_start_day
        due_day = settings.reading_due_day or self.reading_due_day
        status_day = start_day + 1  # 24th when start is 23

        if day == start_day:
            await self._send_once(year, month, day, "start", START_REMINDER)
            await self.status.refresh(year, month)
        elif day == status_day:
            text = self.status.submission_status_lines(year, month)
            await self._send_once(year, month, day, "status", text)
        elif day == due_day:
            text = self.status.missing_responsible_mentions(year, month)
            await self._send_once(year, month, day, "final", text)

    async def _send_once(
        self, year: int, month: int, day: int, kind: str, text: str
    ) -> None:
        if self.db.reminder_already_sent(year, month, day, kind):
            logger.info("reminder_skip_duplicate kind=%s", kind)
            return
        await self.bot.send_message(self.group_id, text)
        self.db.mark_reminder_sent(year, month, day, kind)
        logger.info("reminder_sent kind=%s year=%s month=%s", kind, year, month)
