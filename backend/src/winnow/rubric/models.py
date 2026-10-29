from typing import Literal, Self

from pydantic import BaseModel, computed_field, model_validator

from winnow.criteria.english import english
from winnow.criteria.models import Criterion, RubricSettings
from winnow.rubric.phrases import TextRange, uncovered_words


class Rubric(BaseModel):
    """A Description's Phrases, the Criteria each became, and what a grasp is."""

    description: str
    phrases: list[str]  # each an exact substring of the Description
    settings: RubricSettings
    criteria: list[Criterion]

    @model_validator(mode="after")
    def _consistent(self) -> Self:
        for phrase in self.phrases:
            if phrase not in self.description:
                raise ValueError(f"Phrase {phrase!r} isn't in the Description")
        for criterion in self.criteria:
            if criterion.phrase not in self.phrases:
                raise ValueError(f"Criterion {criterion.id} names an unknown Phrase")
        ids = [c.id for c in self.criteria]
        if len(set(ids)) != len(ids):
            raise ValueError("Criterion ids must be unique")
        return self


class RubricVersion(BaseModel):
    """A frozen Rubric: every Criterion result names the version it came from."""

    version: int
    created_at: str
    rubric: Rubric


PhraseStatus = Literal["checked", "context", "unsupported"]


class DraftPhrase(BaseModel):
    """One Phrase of a draft's Description and what compile made of it. Its Criteria are the
    draft's Criteria whose `phrase` is its text."""

    text: str  # an exact substring of the Description
    start: int  # where it sits in the Description, in characters
    end: int
    restatement: str  # what it requires, said precisely
    status: PhraseStatus
    # Context: why it checks nothing, which the user can overrule. Unsupported: Spark's reason,
    # or the validation error that survived the repair turn.
    reason: str | None = None


class RejectedPhrase(BaseModel):
    """A Phrase Spark proposed that code refused, e.g. one that isn't in the Description."""

    text: str
    reason: str


class RubricDraft(BaseModel):
    """The Rubric being written on the Describe page: compiled from a Description, edited, and
    frozen into a Rubric version by Run."""

    description: str
    phrases: list[DraftPhrase]  # in Description order, never overlapping
    settings: RubricSettings
    criteria: list[Criterion]
    rejected: list[RejectedPhrase] = []
    compiled_at: str

    @computed_field
    @property
    def uncovered(self) -> list[TextRange]:
        """Meaningful words outside every Phrase, so nothing written is silently ignored."""
        return uncovered_words(self.description, [(p.start, p.end) for p in self.phrases])

    @computed_field
    @property
    def english(self) -> dict[str, str]:
        """Each Criterion as the user reads it, by id."""
        return {c.id: english(c) for c in self.criteria}
