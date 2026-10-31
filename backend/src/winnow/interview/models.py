"""The Describe interview: question cards code picks and words from templates (no model call),
and the answers, each kept with what undo needs to put back."""

from datetime import UTC, datetime
from typing import Annotated, Literal

from pydantic import BaseModel, Field

from winnow.criteria.models import Criterion, Setting
from winnow.interview.bisection import Outcome
from winnow.rubric.models import DraftPhrase

QuestionKind = Literal["phrase", "words", "threshold", "hard_soft", "setting"]
# accept: leave it unchecked; context: it checks nothing; pass / fail: the anchor Episode is
# fine or not on the Phrase (on a setting: closed or lifted, or not); hard / soft: failing the
# Criterion rejects the Episode, or only lowers its quality; skip: leave it as assumed.
AnswerValue = Literal["accept", "context", "pass", "fail", "hard", "soft", "skip"]
SettingName = Literal["gripper_closed_level", "grasp_rise_m"]
SETTING_NAMES: tuple[SettingName, ...] = ("gripper_closed_level", "grasp_rise_m")


def hard_key(criterion_id: str) -> str:
    return f"hard:{criterion_id}"


def setting_key(name: SettingName) -> str:
    return f"setting:{name}"


def setting_of(key: str) -> SettingName:
    """The grasp setting a `setting:` question's key is about."""
    return next(n for n in SETTING_NAMES if setting_key(n) == key)


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


class HardSoftQuestion(BaseModel):
    """Should failing this Criterion reject an Episode outright, or only lower its quality?"""

    kind: Literal["hard_soft"] = "hard_soft"
    key: str
    prompt: str
    options: list[Option]
    criterion_id: str
    phrase: str
    english: str
    hard: bool  # as it stands


class SettingQuestion(BaseModel):
    """Is the gripper closed (or did it lift) at this anchor Episode's moment? One step of
    bisecting an assumed grasp setting."""

    kind: Literal["setting"] = "setting"
    key: str
    prompt: str
    options: list[Option]
    setting: SettingName
    name: str  # as the user reads it, e.g. "Gripper closed level"
    assumption: str
    episode_id: str
    value: float
    measurement: str  # e.g. "closed to 0.62"
    camera: str | None
    clip: Clip  # around the moment
    asked: int
    max_questions: int


Question = Annotated[
    PhraseQuestion | ThresholdQuestion | HardSoftQuestion | SettingQuestion,
    Field(discriminator="kind"),
]


class AnswerDraw(BaseModel):
    key: str  # the question's
    episode_id: str | None = None  # a threshold or setting question's anchor Episode
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

    value: float | None = None  # a threshold or setting answer's measured value
    # What undo puts back, and only that, so later answers and direct edits stand: the settled
    # Criterion's threshold, margin and assumptions (only `hard`, for a hard/soft answer); the
    # settled setting; the Phrase made Context (None when it was words in no Phrase, which undo
    # takes out of the Phrases again).
    criterion_before: Criterion | None = None
    setting_before: Setting | None = None
    context_at: int | None = None  # where the Phrase made Context starts
    phrase_before: DraftPhrase | None = None


def new_answer(
    key: str, kind: QuestionKind, subject: str, answer: AnswerValue, effect: str
) -> StoredAnswer:
    """An answer that changed nothing yet; callers add what it did."""
    return StoredAnswer(
        id=0,
        key=key,
        kind=kind,
        subject=subject,
        episode_id=None,
        measurement=None,
        answer=answer,
        effect=effect,
        changed_criterion=None,
        label_id=None,
        resolution=None,
        answered_at=datetime.now(UTC).isoformat(),
    )


class Interview(BaseModel):
    answered: list[InterviewAnswer]  # the timeline, oldest first
    question: Question | None  # what code asks next; None when nothing is left to ask
    covered: bool  # every Phrase is covered: the interview is done
    phrases_left: int  # Unsupported Phrases and uncovered words not yet answered
    thresholds_left: int  # assumed thresholds code can still ask about
    hard_soft_left: int  # Criteria not yet confirmed hard or soft
    settings_left: int  # assumed grasp settings code can still ask about
