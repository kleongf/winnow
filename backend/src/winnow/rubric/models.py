from typing import Self

from pydantic import BaseModel, model_validator

from winnow.criteria.models import Criterion, RubricSettings


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
