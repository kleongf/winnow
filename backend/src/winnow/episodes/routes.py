from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse

from winnow.core.context import AppContext, get_context
from winnow.episodes.models import Episode, IngestRequest, IngestStarted, Signals
from winnow.episodes.service import ingest_items, workstation_signals
from winnow.episodes.store import clip_path

router = APIRouter(tags=["episodes"])

Context = Annotated[AppContext, Depends(get_context)]


@router.get("/episodes")
async def list_episodes(ctx: Context) -> list[Episode]:
    return ctx.episodes.list()


def _episode(ctx: AppContext, episode_id: str) -> Episode:
    episode = ctx.episodes.get(episode_id)
    if episode is None:
        raise HTTPException(status_code=404, detail=f"No Episode {episode_id}")
    return episode


@router.get("/episodes/{episode_id}/signals")
async def get_signals(episode_id: str, ctx: Context) -> Signals:
    episode = _episode(ctx, episode_id)
    return workstation_signals(ctx.episodes.load_signals(episode))


@router.get(
    "/episodes/{episode_id}/clips/{camera}",
    response_class=FileResponse,
    responses={200: {"content": {"video/mp4": {}}}},
)
async def get_clip(episode_id: str, camera: str, ctx: Context) -> FileResponse:
    episode = _episode(ctx, episode_id)
    if camera not in episode.cameras:
        raise HTTPException(status_code=404, detail=f"No {camera} clip for {episode_id}")
    path = clip_path(ctx.episodes.episode_folder(episode), camera)
    return FileResponse(path, media_type="video/mp4")


@router.post("/episodes/ingest", status_code=status.HTTP_202_ACCEPTED)
async def start_ingest(request: IngestRequest, ctx: Context) -> IngestStarted:
    items = ingest_items(request.source, request.indices)
    return IngestStarted(job_id=ctx.runner.submit("ingest", items))
