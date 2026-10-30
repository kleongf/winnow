"""The Describe interview: question cards code picks and words from templates (no model call),
and the answers, each kept with what undo needs to put back."""

from typing import Annotated, Literal

from pydantic import BaseModel, Field

from winnow.criteria.models import Criterion
from winnow.interview.bisection import Outcome
from winnow.rubric.models import DraftPhrase

QuestionKind = Literal["phrase", "words", "threshold"]
# accept: leave it unchecked; context: it checks nothing; pass / fail: the anchor Episode is
# fine or not on the Phrase; skip: leave the threshold assumed.
AnswerValue = Literal["accept", "context", "pass", "fail", "skip"]


class Option(BaseModel):
    answer: AnswerValue
    label: str  # says what the answer does, e.g. which one means pass


class PhraseQuestion(BaseModel):
    """An Unsupported Phrase (`phrase`), or meaningful words in no Phrase (`words`)."""

    kind: Literal["phrase", "words"]
    key: str
    prompt: str
    options: list[Option]
    text: str
    start: int  # where it sits in the Description, in characters
    end: int
    reason: str | None  # why nothing checks it


class Clip(BaseModel):
    start: float  # s
    end: float


class ThresholdQuestion(BaseModel):
    """Is this anchor Episode's measured value fine? One step of bisecting an assumed
    threshold."""

    kind: Literal["threshold"] = "threshold"
    key: str
    prompt: str
    options: list[Option]
    criterion_id: str
    phrase: str
    english: str
    episode_id: str
    value: float
    measurement: str  # the value as the user reads it, e.g. "1.8 s"
    camera: str | None  # the view to play
    clip: Clip  # the measured stretch
    asked: int  # questions already answered on this threshold
    max_questions: int
    near: int  # anchor Episodes within the threshold's margin


Question = Annotated[PhraseQuestion | ThresholdQuestion, Field(discriminator="kind")]


class AnswerDraw(BaseModel):
    key: str  # the question's
    episode_id: str | None = None  # a threshold question's anchor Episode
    answer: AnswerValue


class InterviewAnswer(BaseModel):
    """An answered card: collapsed to the answer and its effect."""

    id: int
    key: str
    kind: QuestionKind
    subject: str  # the Phrase or words asked about
    episode_id: str | None
    measurement: str | None
    answer: AnswerValue
    effect: str  # what the answer changed, in a sentence
    changed_criterion: str | None  # the Criterion it changed, to highlight
    label_id: int | None  # the interview label it left
    resolution: Outcome | None  # set by the answer that settles a threshold
    answered_at: str


class StoredAnswer(InterviewAnswer):
    """An answer as kept, with what undo puts back."""

    value: float | None = None  # a threshold answer's measured value
    # What undo puts back, and only that, so later answers and direct edits stand: the settled
    # Criterion's threshold, margin and assumptions; the Phrase made Context (None when it was
    # words in no Phrase, which undo takes out of the Phrases again).
    criterion_before: Criterion | None = None
    context_at: int | None = None  # where the Phrase made Context starts
    phrase_before: DraftPhrase | None = None


class Interview(BaseModel):
    answered: list[InterviewAnswer]  # the timeline, oldest first
    question: Question | None  # what code asks next; None when nothing is left to ask
    covered: bool  # every Phrase is covered: the interview is done
    phrases_left: int  # Unsupported Phrases and uncovered words not yet answered
    thresholds_left: int  # assumed thresholds code can still ask about
