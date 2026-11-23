"""Regression tests for the real storage and queue adapters.

The media API tests use fakes, so these exercise the adapter plumbing itself
without touching MinIO or Redis.
"""

import pytest

from app.core.errors import AppError
from app.services import queue as queue_module
from app.services import storage as storage_module
from app.services.queue import CeleryTaskQueue
from app.services.storage import MinioStorage, StorageUnavailable, sniff_image_type


class RecordingClient:
    def __init__(self) -> None:
        self.calls: list[tuple] = []
        self.kwargs: list[dict] = []

    def send_task(self, name, *args, **kwargs):
        self.calls.append((name, *args))
        self.kwargs.append(kwargs)
        return "task-id"


async def test_queue_adapter_forwards_task_arguments():
    adapter = CeleryTaskQueue.__new__(CeleryTaskQueue)
    adapter._client = RecordingClient()
    await adapter.enqueue_demo_quality_check("job-123")
    assert adapter._client.calls == [("ai.demo_quality_check",)]
    assert adapter._client.kwargs == [{"args": ["job-123"]}]


async def test_queue_adapter_reports_outage(monkeypatch):
    adapter = CeleryTaskQueue.__new__(CeleryTaskQueue)
    client = RecordingClient()

    def explode(*args, **kwargs):
        raise ConnectionError("broker down")

    client.send_task = explode
    adapter._client = client
    with pytest.raises(AppError) as excinfo:
        await adapter.enqueue_demo_quality_check("job-123")
    assert excinfo.value.status_code == 503


async def test_storage_put_bytes_forwards_content_type():
    store = MinioStorage.__new__(MinioStorage)
    calls: list[dict] = []

    class BucketClient:
        def put_object(self, bucket, key, data, length, **kwargs):
            calls.append({"bucket": bucket, "key": key, "length": length, "kwargs": kwargs})

    store.client = BucketClient()
    store.media_bucket = "media"
    store.quarantine_bucket = "quarantine"
    store._buckets_ready = True

    await store.put_bytes("media", "k.png", b"payload", "image/png")
    assert calls[0]["kwargs"] == {"content_type": "image/png"}


async def test_storage_translates_network_errors():
    store = MinioStorage.__new__(MinioStorage)

    def boom(*args, **kwargs):
        raise OSError("unreachable")

    with pytest.raises(StorageUnavailable):
        await store._run(boom, 1, 2, three=3)


@pytest.mark.parametrize(
    ("magic", "expected"),
    [
        (b"\xff\xd8\xff\xe0", "image/jpeg"),
        (b"\x89PNG\r\n\x1a\n", "image/png"),
        (b"RIFF\x00\x00\x00\x00WEBP", "image/webp"),
        (b"GIF89a", None),
    ],
)
def test_sniff_image_type(magic, expected):
    assert sniff_image_type(magic) == expected


def test_storage_module_exports_are_intact():
    assert storage_module.ALLOWED_IMAGE_TYPES["image/png"] == "png"
    assert queue_module.TaskQueue is not None
