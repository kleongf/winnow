"""The `crop` and `visual` steps: per visual Criterion and Episode, cut one clip, then ask Spark the
frozen question and each paraphrase about it, every sample every time (no short-circuit).

Each step records its failure against the Criterion before failing its item, so the result is
unsure with the error as Evidence.
"""

import asyncio
from collections.abc import Mapping
from dataclasses import dataclass

from pydantic import ValidationError

from winnow.boxes.store import BoxStore
from winnow.criteria.grasps import find_grasps
from winnow.criteria.models import Criterion, RubricSettings
from winnow.criteria.windows import resolve_window
from winnow.episodes.clips import probe
from winnow.episodes.models import Episode
from winnow.episodes.store import EpisodeStore, clip_path
from winnow.jobs.models import Step, WorkItem
from winnow.meta.client import MetaClient
from winnow.meta.models import SparkCall, SparkRequest, Text, Video
from winnow.meta.pricing import SPARK_CONTRIBUTOR
from winnow.rubric.models import RubricVersion
from winnow.rubric.store import RubricStore
from winnow.tracking.store import TrackStore
from winnow.tracking.target_store import TargetBoxStore
from winnow.visual.crop import Placement, clips_folder, cut, plan_crop
from winnow.visual.keys import ask_key, prompts
from winnow.visual.models import VisualReply, VisualSample
from winnow.visual.prompts import VISUAL_SCHEMA, visual_prompt
from winnow.visual.store import VisualStore

MAX_OUTPUT_TOKENS = 4000


@dataclass(frozen=True)
class VisualSources:
    """What the steps read: the Rubric, the Episode and its clips, its box, tracks and target
    box, and where answers go."""

    rubrics: RubricStore
    episodes: EpisodeStore
    boxes: BoxStore
    tracks: TrackStore
    targets: TargetBoxStore
    answers: VisualStore


def visual_items(version: RubricVersion, episode_ids: list[str]) -> list[WorkItem]:
    """A crop, then a visual item after it, per visual Criterion and Episode."""
    items: list[WorkItem] = []
    for episode_id in episode_ids:
        for criterion in version.rubric.criteria:
            if criterion.kind != "visual":
                continue
            args = {
                "episode_id": episode_id,
                "rubric_version": version.version,
                "criterion_id": criterion.id,
            }
            label = f"{episode_id} {criterion.id}"
            items.append(WorkItem("crop", args, label))
            items.append(WorkItem("visual", args, label, after=len(items) - 1))
    return items


@dataclass(frozen=True)
class _Asked:
    episode: Episode
    criterion: Criterion
    settings: RubricSettings
    key: str


def _asked(sources: VisualSources, args: Mapping[str, object]) -> _Asked:
    episode = sources.episodes.get(str(args["episode_id"]))
    if episode is None:
        raise LookupError(f"No Episode {args['episode_id']}")
    version = sources.rubrics.get(int(str(args["rubric_version"])))
    criteria = version.rubric.criteria if version else []
    criterion = next((c for c in criteria if c.id == args["criterion_id"]), None)
    if version is None or criterion is None:
        raise LookupError(f"No Criterion {args['criterion_id']} in v{args['rubric_version']}")
    settings = version.rubric.settings
    return _Asked(episode, criterion, settings, ask_key(criterion, settings))


def _placement(sources: VisualSources, episode: Episode) -> Placement | None:
    box = sources.boxes.get(episode.id)
    if box is None:
        return None
    track = next(
        (t for t in sources.tracks.for_episode(episode.id)
         if t.kind == "exterior" and t.status == "tracked" and t.camera == box.camera),
        None,
    )  # fmt: skip
    found = [t for t in sources.targets.for_episode(episode.id) if t.camera == box.camera]
    target = next((t for t in found if t.origin == "hand"), found[0] if found else None)
    return Placement(box.camera, track, target)


async def _crop(sources: VisualSources, asked: _Asked) -> str | None:
    episode, criterion = asked.episode, asked.criterion
    signals = sources.episodes.load_signals(episode)
    grasps = find_grasps(signals, asked.settings)
    window = resolve_window(criterion.window, grasps, signals.fps)
    if window is None:
        return "window empty: nothing to ask"
    start = float(signals.timestamps[0])
    t = [float(v) - start for v in signals.timestamps]
    plan = plan_crop(criterion, t, window, _placement(sources, episode))
    folder = sources.episodes.episode_folder(episode)
    source = clip_path(folder, plan.camera)
    _, width, height = await asyncio.to_thread(probe, source)
    clip, made = await asyncio.to_thread(
        cut, episode.id, plan, source, (width, height), clips_folder(folder)
    )
    sources.answers.save_clip(episode.id, asked.key, clip)
    return None if made else "clip already cut"


def crop_step(sources: VisualSources) -> Step:
    async def step(args: Mapping[str, object]) -> str | None:
        asked = _asked(sources, args)
        try:
            return await _crop(sources, asked)
        except Exception as error:
            sources.answers.save_error(asked.episode.id, asked.key, f"crop: {error}")
            raise

    return step


def _sample(prompt: str, result: SparkCall | BaseException) -> VisualSample:
    if isinstance(result, BaseException):
        return VisualSample(prompt=prompt, reply=None, error=f"{type(result).__name__}: {result}")
    try:
        reply = VisualReply.model_validate_json(result.text)
    except ValidationError as error:
        why = f"malformed answer: {error.errors()[0]['msg']}"
        return VisualSample(prompt=prompt, reply=None, error=why)
    return VisualSample(prompt=prompt, reply=reply, error=None)


async def _ask(meta: MetaClient, sources: VisualSources, asked: _Asked) -> str | None:
    found = sources.answers.get(asked.episode.id, asked.key)
    if found is None or found.clip is None:
        return "no clip to ask about"
    clip = found.clip
    video = Video(clips_folder(sources.episodes.episode_folder(asked.episode)) / clip.name)
    asking = prompts(asked.criterion)
    requests = [
        SparkRequest(
            SPARK_CONTRIBUTOR,
            (Text(visual_prompt(p, asked.episode.instruction, clip)), video),
            VISUAL_SCHEMA,
            f"visual:{asked.episode.id}:{asked.criterion.id}",
            max_output_tokens=MAX_OUTPUT_TOKENS,
            schema_name="visual",
        )
        for p in asking
    ]
    results = await asyncio.gather(*(meta.spark(r) for r in requests), return_exceptions=True)
    samples = [_sample(p, r) for p, r in zip(asking, results, strict=True)]
    sources.answers.save_samples(asked.episode.id, asked.key, samples)
    errors = [s.error for s in samples if s.error]
    if len(errors) == len(samples):
        raise RuntimeError(f"every sample failed; first: {errors[0]}")
    return f"{len(errors)} of {len(samples)} samples failed" if errors else None


def visual_step(meta: MetaClient, sources: VisualSources) -> Step:
    async def step(args: Mapping[str, object]) -> str | None:
        return await _ask(meta, sources, _asked(sources, args))

    return step
