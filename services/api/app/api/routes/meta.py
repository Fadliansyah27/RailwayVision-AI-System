from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.core.config import Settings, get_settings
from app.core.constants import AI_DISCLAIMER

router = APIRouter(tags=["system"])


class MetaResponse(BaseModel):
    name: str
    version: str
    environment: str
    api_version: str
    ai_disclaimer: str


@router.get("/meta", response_model=MetaResponse, summary="Service metadata")
async def meta(settings: Settings = Depends(get_settings)) -> MetaResponse:
    return MetaResponse(
        name=settings.app_name,
        version=settings.app_version,
        environment=settings.app_env,
        api_version="v1",
        ai_disclaimer=AI_DISCLAIMER,
    )
