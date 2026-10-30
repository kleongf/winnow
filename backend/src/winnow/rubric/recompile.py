"""Recompile: after a Description edit, Spark is asked about only the changed text.

Every Phrase the edit left alone is kept as it was, with its Criteria: their ids, thresholds,
hard/soft and on/off survive, and so do labels, which hang off the Phrase's text. A Criterion
compiled anew takes back the id a Criterion of the same Phrase and primitive had, and otherwise
gets one no Criterion of the draft had. Visual Criteria kept this way ask exactly what they
asked before, so their answers are Meta cache hits.
"""

from collections import defaultdict
from datetime import UTC, datetime

from winnow.criteria.models import Criterion
from winnow.meta.client import MetaClient
from winnow.rubric.compile import (
    Compiled,
    Scope,
    ask_phrases,
    draft_phrases,
    in_phrase_order,
    numbered,
)
from winnow.rubric.diff import DescriptionDiff
from winnow.rubric.models import RubricDraft
from winnow.rubric.prompt import recompile_prompt


async def recompile_rubric(
    meta: MetaClient | None,
    draft: RubricDraft,
    description: str,
    manifest: str,
    diff: DescriptionDiff,
) -> RubricDraft:
    """`diff` is from the draft's Description to `description`. Makes no Spark call (and needs no
    `meta`) when the edit only took text out."""
    scope = Scope(description, tuple((p.start, p.end) for p in diff.kept))
    compiled = Compiled([], [])
    if diff.stretches:
        assert meta is not None
        kept, changed = [p.text for p in diff.kept], [s.text for s in diff.stretches]
        prompt = recompile_prompt(description, manifest, kept, changed)
        compiled = await ask_phrases(meta, prompt, scope)
    added, rejected = draft_phrases(compiled, scope)
    phrases = sorted([*diff.kept, *added], key=lambda p: p.start)
    criteria = in_phrase_order(_criteria(draft, diff, compiled), phrases)
    ids = {c.id for c in criteria}
    return draft.model_copy(
        update={
            "description": description,
            "phrases": phrases,
            "criteria": criteria,
            "disabled": [id_ for id_ in draft.disabled if id_ in ids],
            "rejected": rejected,
            "recompiled": diff.stretches,
            "compiled_at": datetime.now(UTC).isoformat(),
        }
    )


def _criteria(draft: RubricDraft, diff: DescriptionDiff, compiled: Compiled) -> list[Criterion]:
    kept_phrases = {p.text for p in diff.kept}
    kept = [c for c in draft.criteria if c.phrase in kept_phrases]
    reuse: defaultdict[tuple[str, str], list[str]] = defaultdict(list)
    for gone in (c for c in draft.criteria if c.phrase not in kept_phrases):
        reuse[(gone.phrase, gone.primitive)].append(gone.id)
    new = [c for checked in compiled.accepted for c in checked.criteria]
    return [*kept, *numbered(new, {c.id for c in draft.criteria}, reuse)]
