import logging
import re
import time
import uuid

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import JSONResponse, Response
from starlette.types import ASGIApp

from app.core.errors import error_payload
from app.core.logging import request_id_var

logger = logging.getLogger("railwayvision.http")

_REQUEST_ID_PATTERN = re.compile(r"^[A-Za-z0-9._-]{8,64}$")


class RequestContextMiddleware(BaseHTTPMiddleware):
    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        supplied_id = request.headers.get("x-request-id", "")
        request_id = (
            supplied_id if _REQUEST_ID_PATTERN.fullmatch(supplied_id) else uuid.uuid4().hex
        )
        token = request_id_var.set(request_id)
        started = time.perf_counter()
        try:
            response = await call_next(request)
        finally:
            duration_ms = round((time.perf_counter() - started) * 1000, 1)
            logger.info(
                "http_request",
                extra={
                    "event": "http_request",
                    "method": request.method,
                    "path": request.url.path,
                    "duration_ms": duration_ms,
                    "outcome": "completed",
                },
            )
            request_id_var.reset(token)
        response.headers["X-Request-ID"] = request_id
        return response


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    def __init__(self, app: ASGIApp, enable_hsts: bool = False) -> None:
        super().__init__(app)
        self.enable_hsts = enable_hsts

    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        response = await call_next(request)
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault("Referrer-Policy", "no-referrer")
        response.headers.setdefault(
            "Permissions-Policy", "camera=(), microphone=(), geolocation=()"
        )
        response.headers.setdefault(
            "Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'"
        )
        response.headers.setdefault("Cache-Control", "no-store")
        if self.enable_hsts:
            response.headers.setdefault(
                "Strict-Transport-Security", "max-age=31536000; includeSubDomains"
            )
        return response


class BodySizeLimitMiddleware(BaseHTTPMiddleware):
    def __init__(
        self,
        app: ASGIApp,
        max_bytes: int,
        media_max_bytes: int | None = None,
        media_path_prefix: str = "/api/v1/media/",
    ) -> None:
        super().__init__(app)
        self.max_bytes = max_bytes
        self.media_max_bytes = media_max_bytes or max_bytes
        self.media_path_prefix = media_path_prefix

    def _max_for(self, request: Request) -> int:
        path = request.url.path
        if (
            request.method == "PUT"
            and path.startswith(self.media_path_prefix)
            and path.endswith("/content")
        ):
            return self.media_max_bytes
        return self.max_bytes

    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        limit = self._max_for(request)
        content_length = request.headers.get("content-length")
        if content_length is not None:
            try:
                declared_size = int(content_length)
            except ValueError:
                return JSONResponse(
                    status_code=400,
                    content=error_payload("bad_request", "Invalid Content-Length header"),
                )
            if declared_size > limit:
                return JSONResponse(
                    status_code=413,
                    content=error_payload(
                        "payload_too_large", "Request body exceeds the allowed size"
                    ),
                )
        return await call_next(request)
