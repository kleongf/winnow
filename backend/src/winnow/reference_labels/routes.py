from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from winnow.core.context import AppContext, get_context
from winnow.episodes.routes import find_episode
from winnow.reference_labels.models import ReferenceLabel, ReferenceLabelDraw
from winnow.reference_labels.service import InvalidLabelError, LabelConflictError, save_label

router = APIRouter(tags=["reference_labels"])

Context = Annotated[AppContext, Depends(get_context)]


@router.get("/reference-labels")
async def list_reference_labels(ctx: Context) -> list[ReferenceLabel]:
    return ctx.reference_labels.list()


@router.post("/episodes/{episode_id}/reference-labels", status_code=status.HTTP_201_CREATED)
async def post_reference_label(
    episode_id: str, draw: ReferenceLabelDraw, ctx: Context
) -> ReferenceLabel:
    episode = find_episode(ctx, episode_id)
    try:
        return save_label(ctx, episode, draw)
    except InvalidLabelError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    except LabelConflictError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error
