from typing import Annotated

from fastapi import APIRouter, Depends

from winnow.core.context import AppContext, get_context
from winnow.reference_labels.gate import (
    HIDDEN_UNTIL_LABELLED,
    RevealedEpisode,
    revealed_episodes,
)
from winnow.triage.models import EpisodeTriage, TriageList
from winnow.triage.service import episode_triage, triage_list

router = APIRouter(tags=["triage"])

Context = Annotated[AppContext, Depends(get_context)]


@router.get("/triage")
async def list_triage(ctx: Context) -> TriageList:
    """The Triage decision and Reason of every Episode with a Reference label, for the Episodes
    table; the rest await theirs."""
    return triage_list(ctx, revealed_episodes(ctx))


@router.get(
    "/episodes/{episode_id}/triage",
    responses=HIDDEN_UNTIL_LABELLED,
)
async def get_triage(episode: RevealedEpisode, ctx: Context) -> EpisodeTriage:
    """One labelled Episode's Criterion results, Phrase results, Triage decision and Reason."""
    return episode_triage(ctx, episode)
