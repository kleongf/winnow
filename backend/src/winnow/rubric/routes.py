from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from winnow.core.context import AppContext, get_context
from winnow.rubric.anchor_pool import AnchorPool, anchor_pool
from winnow.rubric.models import RubricDraft, RubricVersion
from winnow.rubric.service import MetaUnavailableError, compile_draft

router = APIRouter(tags=["rubric"])

Context = Annotated[AppContext, Depends(get_context)]


class CompileRequest(BaseModel):
    description: str = Field(min_length=1, max_length=2000)


@router.get("/rubric")
async def get_rubric(ctx: Context) -> RubricVersion:
    """The latest Rubric version: the one every Episode is scored against."""
    return ctx.rubrics.latest()


@router.get("/rubric/draft")
async def get_draft(ctx: Context) -> RubricDraft | None:
    """The Rubric draft on the Describe page; null until a Description is compiled."""
    return ctx.drafts.get()


@router.post(
    "/rubric/draft/compile",
    responses={
        502: {"description": "Spark's answer couldn't be used"},
        503: {"description": "The Meta API isn't configured"},
    },
)
async def post_compile(request: CompileRequest, ctx: Context) -> RubricDraft:
    """Compile a Description into the Rubric draft, replacing the one there: one Spark call,
    plus one repair turn when its answer fails code's checks."""
    description = request.description.strip()
    try:
        return await compile_draft(ctx, description)
    except MetaUnavailableError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
    except RuntimeError as error:  # the Meta API failed, or its answer couldn't be read
        raise HTTPException(status_code=502, detail=f"Compile failed: {error}") from error


@router.get("/anchor-pool")
async def get_anchor_pool(ctx: Context) -> AnchorPool:
    """The Episodes the Rubric is written against: the Dev set, never the Test set."""
    return anchor_pool(ctx)
