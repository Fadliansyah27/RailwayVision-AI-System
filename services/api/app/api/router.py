from fastapi import APIRouter

from app.api.routes import (
    ai_registry,
    assets,
    audit,
    auth,
    checklists,
    dashboard,
    inspections,
    maintenance,
    media,
    meta,
    ops,
    reports,
    users,
)

api_router = APIRouter()
api_router.include_router(meta.router)
api_router.include_router(dashboard.router)
api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(assets.router)
api_router.include_router(checklists.router)
api_router.include_router(inspections.router)
api_router.include_router(media.router)
api_router.include_router(ai_registry.router)
api_router.include_router(audit.router)
api_router.include_router(maintenance.router)
api_router.include_router(reports.router)
api_router.include_router(ops.router)
