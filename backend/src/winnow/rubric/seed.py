"""The Rubric version every Project starts from, seeded from the frozen Description by hand until
compile exists. Phrases with no Criterion yet are not checked."""

from winnow.baseline.prompts import FROZEN
from winnow.criteria.models import Criterion, RubricSettings, Setting
from winnow.rubric.models import Rubric

FIRST_TRY = FROZEN.phrases[0]

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
        )
    ],
)
