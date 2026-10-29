"""Saving a label against the latest Rubric version."""

from datetime import UTC, datetime

from winnow.core.context import AppContext
from winnow.episodes.models import Episode
from winnow.labels.models import LabelDraw, StoredLabel


class UnknownPhraseError(ValueError):
    pass


def save_label(ctx: AppContext, episode: Episode, draw: LabelDraw) -> StoredLabel:
    """Raises UnknownPhraseError unless `draw` names a Phrase of the latest Rubric version."""
    version = ctx.rubrics.latest()
    if draw.phrase not in version.rubric.phrases:
        raise UnknownPhraseError(f"{draw.phrase!r} isn't a Phrase of Rubric v{version.version}")
    label = StoredLabel(
        **draw.model_dump(),
        episode_id=episode.id,
        rubric_version=version.version,
        labelled_at=datetime.now(UTC).isoformat(),
    )
    ctx.labels.add(label)
    return label
