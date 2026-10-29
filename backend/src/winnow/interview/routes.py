from collections.abc import Callable
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException

from winnow.core.context import AppContext, get_context
from winnow.interview.models import AnswerDraw, Interview
from winnow.interview.service import (
    StaleQuestionError,
    UnknownAnswerError,
    answer,
    current,
    undo,
)
from winnow.rubric.service import NoDraftError

router = APIRouter(tags=["interview"])

Context = Annotated[AppContext, Depends(get_context)]

NO_DRAFT: dict[int | str, dict[str, object]] = {
    404: {"description": "No Description has been compiled yet, or no such answer"},
}


def _on_interview(act: Callable[[], Interview]) -> Interview:
    try:
        return act()
    except (NoDraftError, UnknownAnswerError) as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except StaleQuestionError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error


@router.get("/interview", responses=NO_DRAFT)
async def get_interview(ctx: Context) -> Interview:
    """The interview on the Rubric draft: the answered cards and the question code asks next."""
    return _on_interview(lambda: current(ctx))


@router.post(
    "/interview/answers",
    responses={**NO_DRAFT, 409: {"description": "Not the question being asked"}},
)
async def post_answer(draw: AnswerDraw, ctx: Context) -> Interview:
    """Answer the question being asked. A threshold answer is also an interview label on the
    anchor Episode's Phrase; the answer that settles a threshold changes the Criterion."""
    return _on_interview(lambda: answer(ctx, draw))


@router.delete("/interview/answers/{answer_id}", responses=NO_DRAFT)
async def delete_answer(answer_id: int, ctx: Context) -> Interview:
    """Undo an answer, and the later ones on the same question: the draft gets back what they
    changed, and their labels are withdrawn."""
    return _on_interview(lambda: undo(ctx, answer_id))
