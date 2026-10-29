"""The Project's Rubric draft: compiled from a Description, edited directly, previewed on the
anchor pool, and frozen by Run."""

from winnow.core.context import AppContext
from winnow.rubric.anchor_pool import anchor_episodes
from winnow.rubric.compile import compile_rubric
from winnow.rubric.edits import apply_edit
from winnow.rubric.manifest import capabilities_manifest
from winnow.rubric.models import AnchorPreview, DraftEdit, RubricDraft, RubricVersion
from winnow.rubric.preview import anchor_labels, anchor_preview, revealed_anchor_facts
from winnow.rubric.seed import SEEDED_SETTINGS


class MetaUnavailableError(RuntimeError):
    pass


class NoDraftError(LookupError):
    pass


async def compile_draft(ctx: AppContext, description: str) -> RubricDraft:
    """Compiles `description` against the anchor pool and saves it as the draft. The Rubric
    settings start at their assumed defaults, for the curator to confirm."""
    if ctx.meta is None:
        raise MetaUnavailableError("Compiling needs the Meta API: set MODEL_API_KEY in .env")
    manifest = capabilities_manifest(ctx, anchor_episodes(ctx), SEEDED_SETTINGS)
    draft = await compile_rubric(ctx.meta, description, manifest, SEEDED_SETTINGS)
    return ctx.drafts.save(draft)


def _draft(ctx: AppContext) -> RubricDraft:
    draft = ctx.drafts.get()
    if draft is None:
        raise NoDraftError("There's no Rubric draft yet: compile a Description first")
    return draft


def edit_draft(ctx: AppContext, edit: DraftEdit) -> RubricDraft:
    """Applies direct edits to the draft and saves it, with no model call."""
    return ctx.drafts.save(apply_edit(_draft(ctx), edit))


def preview_draft(ctx: AppContext, edit: DraftEdit) -> AnchorPreview:
    """The draft, with `edit` applied but not saved, scored on the anchor pool."""
    draft = apply_edit(_draft(ctx), edit)
    facts = revealed_anchor_facts(ctx)
    labels = anchor_labels(ctx, list(facts))
    return anchor_preview(facts, draft.rubric(), draft.criteria, None, labels)


def preview_version(ctx: AppContext, version: RubricVersion) -> AnchorPreview:
    rubric = version.rubric
    facts = revealed_anchor_facts(ctx)
    labels = anchor_labels(ctx, list(facts))
    return anchor_preview(facts, rubric, rubric.criteria, version.version, labels)


def run_draft(ctx: AppContext) -> RubricVersion:
    """Freezes the draft into the next Rubric version, which every Episode is then scored
    against. Never waits for unconfirmed assumptions."""
    return ctx.rubrics.add(_draft(ctx).rubric())
