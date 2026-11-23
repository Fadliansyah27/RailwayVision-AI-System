import io

import pytest
from PIL import Image

from worker.demo_ai import UnsupportedImage, analyze_image_bytes


def _image_bytes(size: tuple[int, int], color: tuple[int, int, int]) -> bytes:
    buffer = io.BytesIO()
    Image.new("RGB", size, color).save(buffer, format="PNG")
    return buffer.getvalue()


def test_dark_small_image_reports_demo_quality_flags():
    result = analyze_image_bytes(_image_bytes((320, 200), (8, 8, 8)))

    assert result["kind"] == "demo_image_quality"
    assert result["advisory"] is True
    assert "bukan deteksi kerusakan" in result["disclaimer"]
    assert "low_light" in result["quality_flags"]
    assert "low_resolution" in result["quality_flags"]
    assert result["metrics"]["width"] == 320
    assert "detections" not in result
    assert "severity" not in result


def test_bright_image_reports_metrics_without_low_light_flag():
    result = analyze_image_bytes(_image_bytes((800, 600), (240, 240, 240)))

    assert result["metrics"]["width"] == 800
    assert "low_light" not in result["quality_flags"]
    assert "low_resolution" not in result["quality_flags"]
    assert result["thresholds"]["low_light_mean"] > 0


def test_unsupported_bytes_are_rejected():
    with pytest.raises(UnsupportedImage):
        analyze_image_bytes(b"not-an-image")
