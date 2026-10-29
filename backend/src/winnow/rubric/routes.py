from typing import Annotated

from fastapi import APIRouter, Depends

from winnow.core.context import AppContext, get_context
from winnow.rubric.models import RubricVersion

router = APIRouter(tags=["rubric"])

Context = Annotated[AppContext, Depends(get_context)]


@router.get("/rubric")
async def get_rubric(ctx: Context) -> RubricVersion:
    """The latest Rubric version: the one every Episode is scored against."""
    return ctx.rubrics.latest()
