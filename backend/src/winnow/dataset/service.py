from winnow.baseline.prompts import FROZEN_DESCRIPTION
from winnow.core.context import AppContext
from winnow.dataset.models import DatasetStatus, SourceCount
from winnow.meta.costs import CostLog

# One Dataset this week; more Datasets and Projects are a nice-to-have.
DATASET_NAME = "Pick-and-place"


def dataset_status(ctx: AppContext) -> DatasetStatus:
    counts = ctx.episodes.count_by_source()
    costs = CostLog(ctx.settings.cost_log_path, ctx.settings.meta_budget_usd)
    return DatasetStatus(
        name=DATASET_NAME,
        sources=[SourceCount(name=name, episodes=n) for name, n in sorted(counts.items())],
        episodes=sum(counts.values()),
        boxes=ctx.boxes.count(),
        baseline=ctx.baseline.complete_count(FROZEN_DESCRIPTION) if ctx.meta else None,
        cost_usd=round(costs.spent_usd(), 4),
    )
