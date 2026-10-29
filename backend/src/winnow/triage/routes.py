from typing import Annotated

from fastapi import APIRouter, Depends

from winnow.core.context import AppContext, get_context
from winnow.episodes.routes import find_episode
from winnow.triage.models import EpisodeTriage, TriageList
from winnow.triage.service import episode_triage, triage_list

router = APIRouter(tags=["triage"])

Context = Annotated[AppContext, Depends(get_context)]


@router.get("/triage")
async def list_triage(ctx: Context) -> TriageList:
    """Every Episode's Triage decision and Reason, for the Episodes table."""
    return triage_list(ctx)


@router.get("/episodes/{episode_id}/triage")
async def get_triage(episode_id: str, ctx: Context) -> EpisodeTriage:
    """One Episode's Criterion results, Phrase results, Triage decision and Reason."""
    return episode_triage(ctx, find_episode(ctx, episode_id))
