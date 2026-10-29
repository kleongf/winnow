from typing import Annotated

from fastapi import APIRouter, Depends

from winnow.core.context import AppContext, get_context
from winnow.dataset.models import DatasetStatus
from winnow.dataset.service import dataset_status

router = APIRouter(tags=["dataset"])


@router.get("/dataset")
async def get_dataset(ctx: Annotated[AppContext, Depends(get_context)]) -> DatasetStatus:
    return dataset_status(ctx)
