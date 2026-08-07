"""Supabase Storage helpers for meter photos and payment documents."""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Optional
from uuid import uuid4

from supabase import Client

logger = logging.getLogger(__name__)


class Storage:
    def __init__(
        self,
        client: Client,
        *,
        meter_photos_bucket: str = "meter-photos",
        payment_documents_bucket: str = "payment-documents",
        reports_bucket: str = "reports",
    ) -> None:
        self.client = client
        self.meter_photos_bucket = meter_photos_bucket
        self.payment_documents_bucket = payment_documents_bucket
        self.reports_bucket = reports_bucket

    def _path(self, prefix: str, filename: str) -> str:
        stamp = datetime.now(timezone.utc).strftime("%Y/%m/%d")
        return f"{prefix}/{stamp}/{uuid4().hex}_{filename}"

    def upload_bytes(
        self,
        bucket: str,
        path: str,
        data: bytes,
        content_type: str,
    ) -> str:
        try:
            self.client.storage.from_(bucket).upload(
                path,
                data,
                file_options={
                    "content-type": content_type,
                    "upsert": "false",
                },
            )
        except Exception:
            logger.exception("supabase_storage_upload_failed bucket=%s path=%s", bucket, path)
            raise
        logger.info("storage_upload_ok bucket=%s path=%s bytes=%s", bucket, path, len(data))
        return path

    def upload_meter_photo(
        self,
        data: bytes,
        *,
        filename: str = "meter.jpg",
        content_type: str = "image/jpeg",
        year: Optional[int] = None,
        month: Optional[int] = None,
    ) -> str:
        prefix = "meters"
        if year and month:
            prefix = f"meters/{year}/{month:02d}"
        path = self._path(prefix, filename)
        return self.upload_bytes(self.meter_photos_bucket, path, data, content_type)

    def upload_payment_document(
        self,
        data: bytes,
        *,
        filename: str = "payment.jpg",
        content_type: str = "image/jpeg",
        year: Optional[int] = None,
        month: Optional[int] = None,
    ) -> str:
        prefix = "payments"
        if year and month:
            prefix = f"payments/{year}/{month:02d}"
        path = self._path(prefix, filename)
        return self.upload_bytes(self.payment_documents_bucket, path, data, content_type)

    def create_signed_url(self, bucket: str, path: str, expires_in: int = 3600) -> str:
        result = self.client.storage.from_(bucket).create_signed_url(path, expires_in)
        if isinstance(result, dict):
            return result.get("signedURL") or result.get("signedUrl") or ""
        return str(result)
