"""The Rubric version every Project starts from, seeded from the frozen Description by hand until
compile exists: its measured Criteria. "never drops it" waits for the tracked primitives, and
"places it ..." gets its conclusive Criteria (target-box overlap, a visual question) with them;
until then its release height can only send an Episode to review."""

from winnow.baseline.prompts import FROZEN
from winnow.criteria.models import Criterion, RubricSettings, Setting
from winnow.rubric.models import Rubric

FIRST_TRY, _NEVER_DROPS, PLACES, NO_PAUSES = FROZEN.phrases

SEEDED_SETTINGS = RubricSettings(
    gripper_closed_level=Setting(
        value=0.2,
        margin=0.1,
        assumption="Closed above 0.2 of the gripper's range (0 open, 1 closed); droid_100's "
        "grasps close to 0.5-1.0.",
    ),
    grasp_rise_m=Setting(
        value=0.02,
        margin=0.01,
        assumption="The grasp is the last closure during which the arm rises 2 cm; earlier "
        "closures are failed attempts.",
    ),
)

SEEDED = Rubric(
    description=FROZEN.text,
    phrases=list(FROZEN.phrases),
    settings=SEEDED_SETTINGS,
    criteria=[
        Criterion(
            id="grasp-attempts",
            phrase=FIRST_TRY,
            primitive="grasp_attempts",
            comparator="<=",
            threshold=1,
            unit="attempts",
        ),
        Criterion(
            id="release-height",
            phrase=PLACES,
            primitive="release_height_m",
            comparator="<=",
            threshold=0.05,
            unit="m",
            assumptions=[
                "Placed, not dropped: released within 5 cm above where it was picked up. "
                "Inconclusive, since placing on top of something is a high release."
            ],
        ),
        Criterion(
            id="longest-pause",
            phrase=NO_PAUSES,
            primitive="longest_still_s",
            params={"speed_below_m_s": 0.01},
            comparator="<",
            threshold=2.0,
            unit="s",
            assumptions=["A pause is the arm under 1 cm/s; a long one lasts 2 s or more."],
        ),
    ],
)
