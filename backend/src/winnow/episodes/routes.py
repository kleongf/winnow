from typing import Annotated

from fastapi import APIRouter, Depends, status

from winnow.core.context import AppContext, get_context
from winnow.episodes.models import Episode, IngestRequest, IngestStarted
from winnow.episodes.service import ingest_items

router = APIRouter(tags=["episodes"])

Context = Annotated[AppContext, Depends(get_context)]


@router.get("/episodes")
async def list_episodes(ctx: Context) -> list[Episode]:
    return ctx.episodes.list()


@router.post("/episodes/ingest", status_code=status.HTTP_202_ACCEPTED)
async def start_ingest(request: IngestRequest, ctx: Context) -> IngestStarted:
    items = ingest_items(request.source, request.indices)
    return IngestStarted(job_id=ctx.runner.submit("ingest", items))
