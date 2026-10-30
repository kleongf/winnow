"""The evaluation: (set, Rubric version) -> report, over the set's Reference-labelled Episodes.

Reference labels are read here and nowhere in scoring. Only Episodes the blind gate reveals
(those with a first-pass Reference label) are scored, and only aggregates leave this module:
no per-Episode decision is in the report. Interview and review labels tune the
Rubric on the Dev set, so they are applied to Dev set Episodes only, never to the Test set.
"""

from collections.abc import Sequence

from winnow.baseline.prompts import FROZEN
from winnow.core.context import AppContext
from winnow.evaluation.cases import (
    EvaluationCase,
    failed_phrases,
    spark_alone_claim,
    spark_alone_decision,
    spark_alone_ranking,
    winnow_claim,
    winnow_ranking,
)
from winnow.evaluation.comparison import comparison, mcnemar, phrase_failures
from winnow.evaluation.models import EvaluationReport, EvaluationRequest
from winnow.evaluation.right_reason import measured_slack, right_reason
from winnow.evaluation.risk_coverage import matched_coverage, risk_coverage
from winnow.reference_labels.gate import revealed_ids
from winnow.reference_labels.models import ReferenceLabel
from winnow.rubric.models import RubricVersion
from winnow.sets.models import SetName
from winnow.triage.models import Label
from winnow.triage.scoring import score
from winnow.triage.service import episode_facts


class UnknownRubricVersionError(LookupError):
    pass


def _version(ctx: AppContext, rubric_version: int | None) -> RubricVersion:
    if rubric_version is None:
        return ctx.rubrics.latest()
    version = ctx.rubrics.get(rubric_version)
    if version is None:
        raise UnknownRubricVersionError(f"There is no Rubric v{rubric_version}")
    return version


def _case(
    ctx: AppContext, version: RubricVersion, label: ReferenceLabel, labels: Sequence[Label]
) -> EvaluationCase:
    episode = ctx.episodes.get(label.episode_id)
    assert episode is not None  # a Reference label names an ingested Episode
    triage = score(version.rubric, episode_facts(ctx, episode), labels)
    baseline = ctx.baseline.answers(episode.id, FROZEN.text)
    return EvaluationCase(
        episode_id=episode.id,
        duration_s=episode.duration_s,
        failed=failed_phrases(label),
        winnow=triage.decision,
        spark_alone=spark_alone_decision(baseline),
        winnow_claim=winnow_claim(triage),
        spark_alone_claim=spark_alone_claim(baseline),
        winnow_ranking=winnow_ranking(triage),
        spark_alone_ranking=spark_alone_ranking(baseline),
    )


def evaluation_report(
    ctx: AppContext,
    set_name: SetName,
    rubric_version: int | None = None,
) -> EvaluationReport:
    version = _version(ctx, rubric_version)
    members = ctx.sets.get(set_name).episode_ids
    revealed = revealed_ids(ctx)  # the blind gate: only these Episodes' outputs are read
    first_pass = {
        label.episode_id: label
        for label in ctx.reference_labels.list()
        if not label.relabel and label.episode_id in revealed
    }
    labels = [first_pass[id] for id in members if id in first_pass]

    def applied(episode_id: str) -> Sequence[Label]:
        return () if set_name == "test" else ctx.labels.in_force(episode_id)

    cases = [_case(ctx, version, label, applied(label.episode_id)) for label in labels]
    return EvaluationReport(
        set_name=set_name,
        rubric_version=version.version,
        episodes=len(members),
        labelled=len(cases),
        description_failures=sum(c.description_failure for c in cases),
        comparison=comparison(cases),
        right_reason=right_reason(cases, measured_slack(ctx.reference_labels.list())),
        risk_coverage=risk_coverage(cases),
        matched_coverage=matched_coverage(cases),
        mcnemar=mcnemar(cases),
        phrase_failures=phrase_failures(cases, FROZEN.phrases),
    )


def run_evaluation(ctx: AppContext, request: EvaluationRequest) -> EvaluationReport:
    """The report; a Test set run is also appended to the Test run log."""
    report = evaluation_report(ctx, request.set_name, request.rubric_version)
    if request.set_name == "test":
        ctx.test_runs.append(report)
    return report
