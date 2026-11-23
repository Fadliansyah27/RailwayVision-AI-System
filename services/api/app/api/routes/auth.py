import hashlib
from datetime import timedelta

from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import AuthContext, get_auth_context
from app.core.config import get_settings
from app.core.errors import AppError
from app.db.session import get_db
from app.models.identity import AuthSession, PasswordResetRequest
from app.schemas.auth import (
    LoginRequest,
    PasswordChange,
    PasswordResetConfirm,
    PasswordResetRequestIn,
    ProfileUpdate,
    RefreshRequest,
    TokenResponse,
    UserOut,
)
from app.services.access import user_out
from app.services.audit import record_audit
from app.services.auth import (
    as_utc,
    create_session,
    load_user,
    load_user_by_email,
    utcnow,
)
from app.services.security import (
    create_access_token,
    generate_refresh_token,
    hash_password,
    hash_refresh_token,
    verify_password,
)

router = APIRouter(prefix="/auth", tags=["auth"])

REFRESH_COOKIE = "rv_refresh"
REFRESH_COOKIE_PATH = "/api/v1/auth"
REFRESH_BODY_HEADER = "X-Refresh-Transport"


def _client_metadata(request: Request) -> tuple[str | None, str | None]:
    user_agent = request.headers.get("User-Agent")
    ip_address = request.client.host if request.client else None
    return user_agent, ip_address


def _wants_body_token(request: Request) -> bool:
    return request.headers.get(REFRESH_BODY_HEADER, "").lower() == "body"


def _set_refresh_cookie(response: Response, token: str) -> None:
    settings = get_settings()
    response.set_cookie(
        key=REFRESH_COOKIE,
        value=token,
        max_age=settings.refresh_token_days * 86400,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="lax",
        path=REFRESH_COOKIE_PATH,
    )


def _clear_refresh_cookie(response: Response) -> None:
    response.delete_cookie(key=REFRESH_COOKIE, path=REFRESH_COOKIE_PATH)


def _token_response(
    request: Request, user, session: AuthSession, refresh_token: str, expires_in: int
) -> TokenResponse:
    return TokenResponse(
        access_token=create_access_token(str(user.id), str(session.id))[0],
        expires_in=expires_in,
        user=user_out(user),
        refresh_token=refresh_token if _wants_body_token(request) else None,
    )


async def _enforce_login_rate_limit(request: Request, email: str) -> str:
    settings = get_settings()
    digest = hashlib.sha256(email.lower().encode("utf-8")).hexdigest()[:32]
    key = f"rvai:login:{digest}"
    redis = getattr(request.app.state, "redis", None)
    if redis is None:
        return key
    try:
        attempts = await redis.incr(key)
        if attempts == 1:
            await redis.expire(key, settings.login_window_seconds)
        if isinstance(attempts, int) and attempts > settings.login_max_attempts:
            raise AppError(
                429,
                "rate_limited",
                "Terlalu banyak percobaan masuk. Tunggu sebentar lalu coba lagi.",
            )
    except AppError:
        raise
    except Exception:
        # Redis failure must not lock users out of authentication.
        return key
    return key


@router.post("/login", response_model=TokenResponse)
async def login(
    payload: LoginRequest,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    email = str(payload.email).strip().lower()
    rate_key = await _enforce_login_rate_limit(request, email)

    user = await load_user_by_email(db, email)
    if (
        user is None
        or not user.is_active
        or not verify_password(payload.password, user.password_hash)
    ):
        if user is not None:
            await record_audit(
                db,
                action="auth.login",
                actor=user,
                outcome="failure",
                metadata={"reason": "invalid_credentials"},
            )
            await db.commit()
        raise AppError(401, "unauthorized", "Email atau kata sandi tidak valid.")

    refresh_token = generate_refresh_token()
    user_agent, ip_address = _client_metadata(request)
    session = await create_session(
        db,
        user,
        refresh_token,
        user_agent=user_agent,
        ip_address=ip_address,
    )
    user.last_login_at = utcnow()
    await record_audit(
        db,
        action="auth.login",
        actor=user,
        target_type="session",
        target_id=session.id,
    )
    await db.commit()

    redis = getattr(request.app.state, "redis", None)
    if redis is not None:
        try:
            await redis.delete(rate_key)
        except Exception:
            pass

    access_token, expires_in = create_access_token(str(user.id), str(session.id))
    _set_refresh_cookie(response, refresh_token)
    return TokenResponse(
        access_token=access_token,
        expires_in=expires_in,
        user=user_out(user),
        refresh_token=refresh_token if _wants_body_token(request) else None,
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh(
    payload: RefreshRequest,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    settings = get_settings()
    token = payload.refresh_token or request.cookies.get(REFRESH_COOKIE)
    if not token:
        raise AppError(401, "unauthorized", "Token refresh tidak ada.")

    stmt = select(AuthSession).where(AuthSession.token_hash == hash_refresh_token(token))
    session = (await db.execute(stmt)).scalar_one_or_none()
    if (
        session is None
        or session.revoked_at is not None
        or as_utc(session.expires_at) <= utcnow()
    ):
        raise AppError(401, "unauthorized", "Sesi tidak lagi valid.")

    user = await load_user(db, session.user_id)
    if user is None or not user.is_active:
        raise AppError(401, "unauthorized", "Sesi tidak lagi valid.")

    new_token = generate_refresh_token()
    session.token_hash = hash_refresh_token(new_token)
    session.expires_at = utcnow() + timedelta(days=settings.refresh_token_days)
    session.last_used_at = utcnow()
    await db.commit()

    _set_refresh_cookie(response, new_token)
    access_token, expires_in = create_access_token(str(user.id), str(session.id))
    return TokenResponse(
        access_token=access_token,
        expires_in=expires_in,
        user=user_out(user),
        refresh_token=new_token if _wants_body_token(request) else None,
    )


@router.post("/logout", status_code=204)
async def logout(
    payload: RefreshRequest,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> Response:
    token = payload.refresh_token or request.cookies.get(REFRESH_COOKIE)
    if token:
        stmt = select(AuthSession).where(
            AuthSession.token_hash == hash_refresh_token(token),
            AuthSession.revoked_at.is_(None),
        )
        session = (await db.execute(stmt)).scalar_one_or_none()
        if session is not None:
            session.revoked_at = utcnow()
            user = await load_user(db, session.user_id)
            await record_audit(
                db,
                action="auth.logout",
                actor=user,
                target_type="session",
                target_id=session.id,
            )
            await db.commit()
    _clear_refresh_cookie(response)
    response.status_code = 204
    return response


@router.get("/me", response_model=UserOut)
async def me(ctx: AuthContext = Depends(get_auth_context)) -> UserOut:
    return user_out(ctx.user)


@router.patch("/me", response_model=UserOut)
async def update_profile(
    payload: ProfileUpdate,
    ctx: AuthContext = Depends(get_auth_context),
    db: AsyncSession = Depends(get_db),
) -> UserOut:
    ctx.user.full_name = payload.full_name.strip()
    await record_audit(db, action="auth.profile_updated", actor=ctx.user)
    await db.commit()
    return user_out(ctx.user)


@router.post("/change-password", status_code=204)
async def change_password(
    payload: PasswordChange,
    response: Response,
    ctx: AuthContext = Depends(get_auth_context),
    db: AsyncSession = Depends(get_db),
) -> Response:
    settings = get_settings()
    if not verify_password(payload.current_password, ctx.user.password_hash):
        raise AppError(400, "bad_request", "Kata sandi saat ini salah.")
    if len(payload.new_password) < settings.password_min_length:
        raise AppError(
            422,
            "validation_error",
            f"Kata sandi minimal {settings.password_min_length} karakter.",
        )
    if payload.new_password == payload.current_password:
        raise AppError(
            400,
            "bad_request",
            "Kata sandi baru harus berbeda dari kata sandi saat ini.",
        )

    ctx.user.password_hash = hash_password(payload.new_password)
    await db.execute(
        update(AuthSession)
        .where(AuthSession.user_id == ctx.user.id, AuthSession.revoked_at.is_(None))
        .values(revoked_at=utcnow())
    )
    await record_audit(db, action="auth.password_changed", actor=ctx.user)
    await db.commit()
    _clear_refresh_cookie(response)
    response.status_code = 204
    return response


@router.post("/password-reset/request", status_code=202)
async def request_password_reset(
    payload: PasswordResetRequestIn,
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    # The response is intentionally identical for known and unknown addresses so
    # the endpoint cannot be used to enumerate accounts.
    email = str(payload.email).strip().lower()
    user = await load_user_by_email(db, email)
    if user is not None and user.is_active:
        latest = (
            await db.execute(
                select(PasswordResetRequest)
                .where(PasswordResetRequest.user_id == user.id)
                .order_by(PasswordResetRequest.requested_at.desc())
                .limit(1)
            )
        ).scalar_one_or_none()
        if latest is None or latest.status == "completed":
            db.add(
                PasswordResetRequest(
                    user_id=user.id,
                    status="pending",
                    requested_at=utcnow(),
                )
            )
        else:
            latest.status = "pending"
            latest.requested_at = utcnow()
            latest.token_hash = None
            latest.token_expires_at = None
            latest.used_at = None
        await record_audit(
            db, action="auth.password_reset_requested", actor=user
        )
        await db.commit()
    return {"status": "accepted"}


@router.post("/password-reset/confirm", status_code=204)
async def confirm_password_reset(
    payload: PasswordResetConfirm,
    db: AsyncSession = Depends(get_db),
) -> Response:
    settings = get_settings()
    if len(payload.new_password) < settings.password_min_length:
        raise AppError(
            422,
            "validation_error",
            f"Kata sandi minimal {settings.password_min_length} karakter.",
        )
    reset = (
        await db.execute(
            select(PasswordResetRequest).where(
                PasswordResetRequest.token_hash == hash_refresh_token(payload.token)
            )
        )
    ).scalar_one_or_none()
    if (
        reset is None
        or reset.status != "issued"
        or reset.used_at is not None
        or reset.token_expires_at is None
        or as_utc(reset.token_expires_at) <= utcnow()
    ):
        raise AppError(400, "bad_request", "Token reset tidak valid atau kedaluwarsa.")

    user = await load_user(db, reset.user_id)
    if user is None or not user.is_active:
        raise AppError(400, "bad_request", "Token reset tidak valid atau kedaluwarsa.")

    user.password_hash = hash_password(payload.new_password)
    reset.status = "completed"
    reset.used_at = utcnow()
    reset.token_hash = None
    await db.execute(
        update(AuthSession)
        .where(AuthSession.user_id == user.id, AuthSession.revoked_at.is_(None))
        .values(revoked_at=utcnow())
    )
    await record_audit(db, action="auth.password_reset_completed", actor=user)
    await db.commit()
    response = Response(status_code=204)
    _clear_refresh_cookie(response)
    return response
