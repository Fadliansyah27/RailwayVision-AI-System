import asyncio
import functools
import io
import re
from collections.abc import Callable

import anyio
from minio import Minio
from minio.error import S3Error

from app.core.config import get_settings
from app.core.errors import AppError

ALLOWED_IMAGE_TYPES: dict[str, str] = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
}

_SHA256_PATTERN = re.compile(r"^[a-f0-9]{64}$")


class StorageUnavailable(Exception):
    pass


def sniff_image_type(header: bytes) -> str | None:
    if header.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if header.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if len(header) >= 12 and header[:4] == b"RIFF" and header[8:12] == b"WEBP":
        return "image/webp"
    return None


def is_sha256(value: str) -> bool:
    return bool(_SHA256_PATTERN.fullmatch(value))


def safe_filename(value: str) -> str:
    name = value.replace("\\", "/").rsplit("/", 1)[-1].strip()
    name = re.sub(r"[\x00-\x1f\x7f]", "", name)
    return name[:200] or "upload"


class MinioStorage:
    """Private S3-compatible storage; objects are only reachable through the API."""

    def __init__(
        self,
        endpoint: str,
        access_key: str,
        secret_key: str,
        secure: bool,
        media_bucket: str,
        quarantine_bucket: str,
    ) -> None:
        self.client = Minio(
            endpoint,
            access_key=access_key,
            secret_key=secret_key,
            secure=secure,
        )
        self.media_bucket = media_bucket
        self.quarantine_bucket = quarantine_bucket
        self._buckets_ready = False
        self._buckets_lock = asyncio.Lock()

    async def _run(self, func: Callable, *args, **kwargs):
        if kwargs:
            func = functools.partial(func, *args, **kwargs)
            args = ()
        try:
            return await anyio.to_thread.run_sync(func, *args)
        except S3Error as exc:
            raise StorageUnavailable("object storage request failed") from exc
        except OSError as exc:
            raise StorageUnavailable("object storage is unreachable") from exc

    async def ensure_buckets(self) -> None:
        if self._buckets_ready:
            return
        async with self._buckets_lock:
            if self._buckets_ready:
                return
            for bucket in (self.media_bucket, self.quarantine_bucket):
                exists = await self._run(self.client.bucket_exists, bucket)
                if not exists:
                    await self._run(self.client.make_bucket, bucket)
            self._buckets_ready = True

    async def put_bytes(self, bucket: str, key: str, data: bytes, content_type: str) -> None:
        await self.ensure_buckets()
        await self._run(
            self.client.put_object,
            bucket,
            key,
            io.BytesIO(data),
            len(data),
            content_type=content_type,
        )

    async def get_bytes(self, bucket: str, key: str) -> bytes:
        response = await self._run(self.client.get_object, bucket, key)
        try:
            return await self._run(response.read)
        finally:
            await self._run(response.close)
            await self._run(response.release_conn)

    async def move_to_quarantine(self, key: str, data: bytes, content_type: str) -> str:
        quarantine_key = f"quarantine/{key}"
        await self.put_bytes(self.quarantine_bucket, quarantine_key, data, content_type)
        return quarantine_key

    async def delete_object(self, bucket: str, key: str) -> None:
        await self._run(self.client.remove_object, bucket, key)


_storage: MinioStorage | None = None


def get_storage() -> MinioStorage:
    global _storage
    settings = get_settings()
    if not settings.minio_access_key or not settings.minio_secret_key:
        raise StorageUnavailable("media storage credentials are not configured")
    if _storage is None:
        _storage = MinioStorage(
            endpoint=settings.minio_endpoint,
            access_key=settings.minio_access_key,
            secret_key=settings.minio_secret_key,
            secure=settings.minio_secure,
            media_bucket=settings.minio_media_bucket,
            quarantine_bucket=settings.minio_quarantine_bucket,
        )
    return _storage


def storage_dependency() -> MinioStorage:
    try:
        return get_storage()
    except StorageUnavailable as exc:
        raise AppError(503, "service_unavailable", "Penyimpanan media tidak tersedia.") from exc
