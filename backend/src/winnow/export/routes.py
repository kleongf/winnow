from typing import Annotated

from fastapi import APIRouter, Depends, status

from winnow.core.context import AppContext, get_context
from winnow.export.models import ExportStarted
from winnow.export.service import start_export

router = APIRouter(tags=["export"])

Context = Annotated[AppContext, Depends(get_context)]


@router.post("/export", status_code=status.HTTP_202_ACCEPTED)
async def post_export(ctx: Context) -> ExportStarted:
    """Export the kept Episodes in the background: a LeRobot v3.0 dataset per source, never the
    Test set, with rejections.jsonl holding the Reason for each Episode not kept. The finished
    job's item names the new folder under the data dir's exports/."""
    return ExportStarted(job_id=start_export(ctx))
