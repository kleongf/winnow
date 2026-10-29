from collections.abc import Callable
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException

from winnow.core.context import AppContext, get_context
from winnow.sets.models import EpisodeSet, SetMembers, SetName
from winnow.sets.service import (
    NotInSetError,
    SetConflictError,
    SetError,
    add_episodes,
    freeze,
    remove_episode,
)

router = APIRouter(tags=["sets"])

Context = Annotated[AppContext, Depends(get_context)]


def _status(error: SetError) -> int:
    if isinstance(error, SetConflictError):
        return 409
    if isinstance(error, NotInSetError):
        return 404
    return 422


def _answer(change: Callable[[], EpisodeSet]) -> EpisodeSet:
    try:
        return change()
    except SetError as error:
        raise HTTPException(status_code=_status(error), detail=str(error)) from error


@router.get("/sets")
async def list_sets(ctx: Context) -> list[EpisodeSet]:
    return ctx.sets.list()


@router.post("/sets/{name}/episodes")
async def post_set_episodes(name: SetName, members: SetMembers, ctx: Context) -> EpisodeSet:
    return _answer(lambda: add_episodes(ctx.sets, ctx.episodes, name, members.episode_ids))


@router.delete("/sets/{name}/episodes/{episode_id}")
async def delete_set_episode(name: SetName, episode_id: str, ctx: Context) -> EpisodeSet:
    return _answer(lambda: remove_episode(ctx.sets, name, episode_id))


@router.post("/sets/{name}/freeze")
async def post_freeze(name: SetName, ctx: Context) -> EpisodeSet:
    return _answer(lambda: freeze(ctx.sets, name))
