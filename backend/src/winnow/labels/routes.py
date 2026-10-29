from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, status

from winnow.core.context import AppContext, get_context
from winnow.labels.models import LabelDraw, StoredLabel
from winnow.labels.service import UnknownPhraseError, save_label
from winnow.reference_labels.gate import RevealedEpisode

router = APIRouter(tags=["labels"])

Context = Annotated[AppContext, Depends(get_context)]

HIDDEN: dict[int | str, dict[str, Any]] = {
    403: {"description": "The Episode has no Reference label yet"}
}


@router.post("/episodes/{episode_id}/labels", status_code=status.HTTP_201_CREATED, responses=HIDDEN)
async def post_label(episode: RevealedEpisode, draw: LabelDraw, ctx: Context) -> StoredLabel:
    """Overrides one Phrase's result for this Episode; its Triage decision recomputes."""
    try:
        return save_label(ctx, episode, draw)
    except UnknownPhraseError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error


@router.get("/episodes/{episode_id}/labels", responses=HIDDEN)
async def list_labels(episode: RevealedEpisode, ctx: Context) -> list[StoredLabel]:
    """Every label the Episode was given, oldest first; the newest per Phrase is in force."""
    return ctx.labels.history(episode.id)
