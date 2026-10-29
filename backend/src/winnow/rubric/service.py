"""Compiling the Project's Description into its Rubric draft."""

from winnow.core.context import AppContext
from winnow.rubric.anchor_pool import anchor_episodes
from winnow.rubric.compile import compile_rubric
from winnow.rubric.manifest import capabilities_manifest
from winnow.rubric.models import RubricDraft
from winnow.rubric.seed import SEEDED_SETTINGS


class MetaUnavailableError(RuntimeError):
    pass


async def compile_draft(ctx: AppContext, description: str) -> RubricDraft:
    """Compiles `description` against the anchor pool and saves it as the draft. The Rubric
    settings start at their assumed defaults, for the curator to confirm."""
    if ctx.meta is None:
        raise MetaUnavailableError("Compiling needs the Meta API: set MODEL_API_KEY in .env")
    manifest = capabilities_manifest(ctx, anchor_episodes(ctx), SEEDED_SETTINGS)
    draft = await compile_rubric(ctx.meta, description, manifest, SEEDED_SETTINGS)
    return ctx.drafts.save(draft)
