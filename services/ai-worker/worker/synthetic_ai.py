import io

from PIL import Image, ImageFilter, ImageStat

LOW_LIGHT_MEAN = 60.0
LOW_CONTRAST_STDDEV = 18.0
POSSIBLE_BLUR_EDGE_VARIANCE = 120.0
LOW_RESOLUTION_WIDTH = 640

DISCLAIMER = (
    "Hanya heuristik kualitas gambar sintetis. Ini bukan deteksi kerusakan, tidak mengklaim "
    "akurasi, dan tidak boleh digunakan untuk keputusan keselamatan atau pemeliharaan."
)


class UnsupportedImage(Exception):
    pass


def analyze_image_bytes(data: bytes) -> dict:
    """Compute deterministic quality metrics; no defect inference is performed."""
    try:
        with Image.open(io.BytesIO(data)) as image:
            image.load()
            width, height = image.size
            gray = image.convert("L")
    except Exception as exc:  # Pillow raises several decode-related types
        raise UnsupportedImage("image could not be decoded") from exc

    stats = ImageStat.Stat(gray)
    mean = float(stats.mean[0])
    stddev = float(stats.stddev[0])
    edge_variance = float(ImageStat.Stat(gray.filter(ImageFilter.FIND_EDGES)).var[0])

    flags: list[str] = []
    if mean < LOW_LIGHT_MEAN:
        flags.append("low_light")
    if stddev < LOW_CONTRAST_STDDEV:
        flags.append("low_contrast")
    if edge_variance < POSSIBLE_BLUR_EDGE_VARIANCE:
        flags.append("possible_blur")
    if width < LOW_RESOLUTION_WIDTH:
        flags.append("low_resolution")

    return {
        "kind": "synthetic_image_quality",
        "advisory": True,
        "disclaimer": DISCLAIMER,
        "metrics": {
            "width": width,
            "height": height,
            "mean_luminance": round(mean, 1),
            "contrast_stddev": round(stddev, 1),
            "edge_variance": round(edge_variance, 1),
        },
        "quality_flags": flags,
        "thresholds": {
            "low_light_mean": LOW_LIGHT_MEAN,
            "low_contrast_stddev": LOW_CONTRAST_STDDEV,
            "possible_blur_edge_variance": POSSIBLE_BLUR_EDGE_VARIANCE,
            "low_resolution_width": LOW_RESOLUTION_WIDTH,
        },
        "note": (
            "Ambang batas adalah konstanta sintetis tetap, bukan nilai yang disetujui KCIC."
        ),
    }
