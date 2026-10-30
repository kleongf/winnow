"""The Audit sample, scored like every other read. It is drawn once per Rubric version from
Winnow's own decisions (no label decided them) outside the Test set, then stored. The auditor's
marks are `audit` labels, which scoring never reads, so Keep precision measures Winnow alone."""

import random
from collections.abc import Sequence

from winnow.audit.models import AuditItem, AuditMark, AuditSample, KeepPrecision
from winnow.audit.store import Pick, StoredSample
from winnow.core.context import AppContext
from winnow.episodes.models import Episode
from winnow.evaluation.stats import clopper_pearson_lower, wilson
from winnow.rubric.models import RubricVersion
from winnow.triage.models import EpisodeTriage
from winnow.triage.service import plain_reason, scored

KEEPS = 12
REJECTS = 5  # a few Rejects too, to catch a good Episode wrongly rejected
ONE_SIDED = 0.90  # the confidence of the bound shown when every Keep is good


class NothingToAuditError(ValueError):
    pass


def draw(keeps: Sequence[str], rejects: Sequence[str], seed: int) -> list[Pick]:
    """A uniform sample of up to KEEPS Keeps and REJECTS Rejects, each kept in the order given;
    the same seed, the same sample."""
    rng = random.Random(seed)
    kept = set(rng.sample(list(keeps), min(KEEPS, len(keeps))))
    rejected = set(rng.sample(list(rejects), min(REJECTS, len(rejects))))
    return [Pick(e, "keep") for e in keeps if e in kept] + [
        Pick(e, "reject") for e in rejects if e in rejected
    ]


def keep_precision(marks: Sequence[AuditMark | None]) -> KeepPrecision:
    """Good Keeps of those marked, with the one-sided bound only when every one is good."""
    marked = [m for m in marks if m is not None]
    good = marked.count("good")
    every = bool(marked) and good == len(marked)
    return KeepPrecision(
        good=wilson(good, len(marked)),
        lower_bound=clopper_pearson_lower(good, len(marked), ONE_SIDED) if every else None,
        lower_bound_confidence=ONE_SIDED,
    )


def _automatic(triage: EpisodeTriage) -> bool:
    return all(p.label is None for p in triage.phrases)


def _pool(ctx: AppContext, episodes: list[Episode]) -> tuple[list[str], list[str]]:
    """Winnow's own Keeps and Rejects among `episodes`, leaving out the Test set's."""
    test = set(ctx.sets.get("test").episode_ids)
    _, triages = scored(ctx, [e for e in episodes if e.id not in test])
    own = [t for t in triages if _automatic(t)]
    return (
        [t.episode_id for t in own if t.decision == "keep"],
        [t.episode_id for t in own if t.decision == "reject"],
    )


def draw_sample(ctx: AppContext, episodes: list[Episode], seed: int | None) -> AuditSample:
    """Draws the latest Rubric version's sample from `episodes` unless it has one already.
    Raises NothingToAuditError when none is an auto-Keep outside the Test set."""
    version = ctx.rubrics.latest()
    if ctx.audit.get(version.version) is None:
        keeps, rejects = _pool(ctx, episodes)
        if not keeps:
            raise NothingToAuditError("No auto-Keep outside the Test set to audit yet")
        chosen = random.SystemRandom().randrange(2**31) if seed is None else seed
        ctx.audit.save(version.version, chosen, draw(keeps, rejects, chosen))
    return audit_sample(ctx)


def audit_sample(ctx: AppContext) -> AuditSample:
    version = ctx.rubrics.latest()
    stored = ctx.audit.get(version.version)
    items = [] if stored is None else _items(ctx, version, stored)
    return AuditSample(
        rubric_version=version.version,
        seed=None if stored is None else stored.seed,
        drawn_at=None if stored is None else stored.created_at,
        phrases=version.rubric.phrases,
        items=items,
        precision=keep_precision([i.mark for i in items if i.kind == "keep"]),
    )


def _items(ctx: AppContext, version: RubricVersion, stored: StoredSample) -> list[AuditItem]:
    episodes = [ctx.episodes.get(p.episode_id) for p in stored.picks]
    _, triages = scored(ctx, [e for e in episodes if e is not None])
    reasons = {t.episode_id: plain_reason(t) for t in triages}
    return [
        _item(ctx, version, pick, reasons[pick.episode_id])
        for pick in stored.picks
        if pick.episode_id in reasons
    ]


def _item(ctx: AppContext, version: RubricVersion, pick: Pick, reason: str) -> AuditItem:
    """Marked by the newest audit label on each Phrase given against this Rubric version."""
    labels = {
        label.phrase: label.value
        for label in ctx.labels.in_force(pick.episode_id, ("audit",))
        if label.rubric_version == version.version
    }
    phrases = version.rubric.phrases
    failed = [p for p in phrases if labels.get(p) == "fail"]
    mark: AuditMark | None = None
    if failed:
        mark = "bad"
    elif all(labels.get(p) == "pass" for p in phrases):
        mark = "good"
    return AuditItem(
        episode_id=pick.episode_id, kind=pick.kind, reason=reason, mark=mark, failed=failed
    )
