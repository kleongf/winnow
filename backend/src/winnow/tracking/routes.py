from typing import Annotated

from fastapi import APIRouter, Depends

from winnow.core.context import AppContext, get_context
from winnow.episodes.routes import find_episode
from winnow.tracking.models import Track

router = APIRouter(tags=["tracking"])


@router.get("/episodes/{episode_id}/tracks")
async def get_tracks(
    episode_id: str, ctx: Annotated[AppContext, Depends(get_context)]
) -> list[Track]:
    """The Episode's SAM tracks so far, each with its health; empty before any has run."""
    return ctx.tracks.for_episode(find_episode(ctx, episode_id).id)
