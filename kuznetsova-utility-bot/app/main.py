"""Entry point for Kuznetsova Utility Bot."""

from __future__ import annotations

import asyncio
import logging

from app.bot import create_bot, create_dispatcher, setup_logging
from app.config import get_settings
from app.database import Database
from app.handlers import AppContext, register_handlers, router
from app.scheduler import ReminderScheduler
from app.status_message import StatusMessageService
from app.storage import Storage
from app.vision import VisionService

logger = logging.getLogger(__name__)


async def main() -> None:
    settings = get_settings()
    setup_logging(settings.log_level)
    logger.info("bot_startup timezone=%s group_id=%s", settings.timezone, settings.telegram_group_id)

    bot = create_bot(settings)
    dp = create_dispatcher()

    db = Database.from_settings(settings.supabase_url, settings.supabase_service_role_key)
    storage = Storage(
        db.client,
        meter_photos_bucket=settings.meter_photos_bucket,
        payment_documents_bucket=settings.payment_documents_bucket,
        reports_bucket=settings.reports_bucket,
    )
    vision = VisionService(settings.openai_api_key, model=settings.openai_vision_model)
    status = StatusMessageService(bot, db, settings.telegram_group_id)
    ctx = AppContext(settings, db, storage, vision, status)

    register_handlers(router, ctx)
    dp.include_router(router)

    bot_settings = db.get_bot_settings()
    scheduler = ReminderScheduler(
        bot=bot,
        db=db,
        status=status,
        group_id=settings.telegram_group_id,
        timezone=bot_settings.timezone or settings.timezone,
        reminder_start_day=bot_settings.reminder_start_day,
        reading_due_day=bot_settings.reading_due_day,
    )
    scheduler.start()

    try:
        logger.info("bot_polling_start")
        await dp.start_polling(bot)
    finally:
        scheduler.shutdown()
        await bot.session.close()
        logger.info("bot_shutdown")


if __name__ == "__main__":
    asyncio.run(main())
