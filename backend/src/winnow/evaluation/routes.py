from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException

from winnow.core.context import AppContext, get_context
from winnow.evaluation.models import EvaluationReport, EvaluationRequest, TestRun
from winnow.evaluation.service import UnknownRubricVersionError, run_evaluation

router = APIRouter(tags=["evaluation"])

Context = Annotated[AppContext, Depends(get_context)]


@router.post("/evaluation/runs")
async def post_evaluation_run(request: EvaluationRequest, ctx: Context) -> EvaluationReport:
    """Scores Winnow and the baselines against a set's Reference labels. A Test set run is
    appended to the Test run log; `winnow eval` returns the same report."""
    try:
        return run_evaluation(ctx, request)
    except UnknownRubricVersionError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error


@router.get("/evaluation/test-runs")
async def list_test_runs(ctx: Context) -> list[TestRun]:
    """Every Test set run, newest first."""
    return ctx.test_runs.list()
