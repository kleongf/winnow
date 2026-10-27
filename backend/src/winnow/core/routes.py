from typing import Annotated

from fastapi import APIRouter, Depends

from winnow.core.models import Health
from winnow.core.service import check_health
from winnow.core.settings import Settings, get_settings

router = APIRouter(tags=["core"])


@router.get("/health")
def get_health(settings: Annotated[Settings, Depends(get_settings)]) -> Health:
    return check_health(settings)
