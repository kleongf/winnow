"""Template Reasons: one sentence per Episode, written from its results the moment they exist.

A Reject leads with its earliest-in-time conclusive fail and lists the others after it; a
label-only Reject names the labelled Phrase and its source; Needs review lists its Uncertainty
signals.
"""

from winnow.criteria.measured import at_times
from winnow.criteria.models import TextSpan
from winnow.criteria.primitives import PRIMITIVES
from winnow.triage.models import CriterionResult, PhraseResult, TriageDecision


def _fails(results: list[CriterionResult], phrases: list[PhraseResult]) -> list[CriterionResult]:
    """Conclusive fails of hard Criteria whose Phrase failed, earliest first (untimed last)."""
    failed = {p.phrase for p in phrases if p.hard and p.status == "fail"}
    fails = [
        r
        for r in results
        if r.hard
        and r.phrase in failed
        and r.status == "fail"
        and PRIMITIVES[r.primitive].conclusive
    ]
    return sorted(fails, key=lambda r: (r.at_s is None, r.at_s or 0.0))


def _reject(results: list[CriterionResult], phrases: list[PhraseResult]) -> list[TextSpan]:
    fails = _fails(results, phrases)
    labelled = [p for p in phrases if p.hard and p.status == "fail" and p.label is not None]
    if not fails:
        first = labelled[0]
        source = first.label.source if first.label else "review"
        return [TextSpan(text=f'Rejected: "{first.phrase}" was marked fail in {source}.')]
    lead, *others = fails
    spans = [TextSpan(text=f'Rejected: "{lead.phrase}" failed. '), *lead.evidence]
    for i, other in enumerate(others):
        spans.append(
            TextSpan(text=f' Also failed: "{other.phrase}"' if i == 0 else f'; "{other.phrase}"')
        )
        if other.at_s is not None:
            spans += [TextSpan(text=" at "), *at_times([other.at_s])]
    if others:
        spans.append(TextSpan(text="."))
    return spans


def _needs_review(results: list[CriterionResult], phrases: list[PhraseResult]) -> list[TextSpan]:
    unsure = {p.phrase for p in phrases if p.hard and p.status == "unsure"}
    signals = [
        f'"{r.phrase}": {r.uncertainty or r.status} ({r.window_name})'
        for r in results
        if r.phrase in unsure and r.hard and r.status != "pass"
    ]
    return [TextSpan(text=f"Needs review: {'; '.join(dict.fromkeys(signals))}.")]


def reason_for(
    decision: TriageDecision, results: list[CriterionResult], phrases: list[PhraseResult]
) -> list[TextSpan]:
    if decision == "reject":
        return _reject(results, phrases)
    if decision == "needs_review":
        return _needs_review(results, phrases)
    checked = sum(1 for p in phrases if p.hard)
    if checked == 0:
        return [TextSpan(text="Kept: no hard Criterion checks this Rubric's Phrases.")]
    return [TextSpan(text="Kept: every hard Phrase passed.")]
