"""The one pure scoring function: (Rubric, Episode facts, labels) -> Triage.

Every route, preview, queue and evaluation calls `score`; nothing downstream of the Meta cache
is stored, so a changed threshold or a new label re-sorts every Episode with no model call.
"""

from collections.abc import Sequence

from winnow.criteria.catalog import CATALOG
from winnow.criteria.english import english
from winnow.criteria.facts import EpisodeFacts
from winnow.criteria.grasps import Grasps, find_grasps
from winnow.criteria.measured import Measurement
from winnow.criteria.models import Criterion, Status, TextSpan, Window
from winnow.criteria.primitives import PRIMITIVES
from winnow.criteria.windows import resolve_window, window_name
from winnow.rubric.models import Rubric
from winnow.triage.models import (
    CriterionResult,
    PhraseLabel,
    PhraseResult,
    TimeWindow,
    Triage,
    TriageDecision,
)
from winnow.triage.reason import reason_for


def score(rubric: Rubric, facts: EpisodeFacts, labels: Sequence[PhraseLabel] = ()) -> Triage:
    grasps = find_grasps(facts.signals, rubric.settings)
    results = [criterion_result(c, facts, grasps) for c in rubric.criteria]
    by_phrase = {label.phrase: label for label in labels}
    phrases = [
        phrase_result(p, [r for r in results if r.phrase == p], by_phrase.get(p))
        for p in rubric.phrases
    ]
    decision = weakest_link(phrases)
    return Triage(
        decision=decision,
        reason=reason_for(decision, results, phrases),
        criteria=results,
        phrases=phrases,
    )


def _passes(criterion: Criterion, value: float) -> bool:
    match criterion.comparator:
        case "<":
            return value < criterion.threshold
        case "<=":
            return value <= criterion.threshold
        case ">=":
            return value >= criterion.threshold
        case ">":
            return value > criterion.threshold
        case "==":
            return value == criterion.threshold


def _empty_window(window: Window, grasps: Grasps) -> Measurement:
    why = "no grasp" if grasps.grasp is None else "the grasp never opened"
    evidence = [TextSpan(text=f"No window {window_name(window)}: {why}.")]
    return Measurement(None, "no window", evidence, [], status="unsure")


def criterion_result(criterion: Criterion, facts: EpisodeFacts, grasps: Grasps) -> CriterionResult:
    frames = resolve_window(criterion.window, grasps, facts.signals.fps)
    if frames is None:
        measured = _empty_window(criterion.window, grasps)
    else:
        measured = CATALOG[criterion.primitive].measure(criterion, facts, grasps, frames)
    status: Status = measured.status or (
        "unsure"
        if measured.value is None
        else "pass"
        if _passes(criterion, measured.value)
        else "fail"
    )
    return CriterionResult(
        criterion_id=criterion.id,
        phrase=criterion.phrase,
        primitive=criterion.primitive,
        kind=criterion.kind,
        hard=criterion.hard,
        english=english(criterion),
        status=status,
        value=measured.value,
        measurement=measured.shown,
        comparator=criterion.comparator,
        threshold=criterion.threshold,
        unit=criterion.unit,
        evidence=measured.evidence,
        moments=measured.moments,
        window=None
        if frames is None
        else TimeWindow(start=facts.t[frames.start], end=facts.t[frames.end]),
        window_name=window_name(criterion.window),
        at_s=measured.at_s if status == "fail" else None,
        uncertainty="window empty" if frames is None else None,
        camera=criterion.views[0] if criterion.views else None,
    )


def conclusive_fail(result: CriterionResult) -> bool:
    """A crisp fail that can fail its Phrase on its own."""
    return result.status == "fail" and PRIMITIVES[result.primitive].conclusive


def phrase_result(
    phrase: str, results: list[CriterionResult], label: PhraseLabel | None
) -> PhraseResult:
    """Fails on any crisp conclusive fail, passes only when all its Criteria pass, else unsure.
    Only hard Criteria decide a Phrase that has any; a human label overrides them all."""
    hard = [r for r in results if r.hard]
    deciding = hard or results
    status: Status | None = None
    if label is not None:
        status = label.value
    elif any(conclusive_fail(r) for r in deciding):
        status = "fail"
    elif deciding:
        status = "pass" if all(r.status == "pass" for r in deciding) else "unsure"
    return PhraseResult(phrase=phrase, hard=bool(hard), status=status, label=label)


def weakest_link(phrases: list[PhraseResult]) -> TriageDecision:
    """Over hard Phrases: any fail rejects, all passing keeps, anything else needs review."""
    statuses = [p.status for p in phrases if p.hard]
    if "fail" in statuses:
        return "reject"
    return "keep" if all(s == "pass" for s in statuses) else "needs_review"
