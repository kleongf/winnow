"""The words of the compile call and its one repair turn."""

import json
from collections.abc import Sequence

from winnow.rubric.examples import EXAMPLES


def _examples() -> str:
    return "\n\n".join(
        f"Example {i + 1}. Description:\n{json.dumps(e.description)}\nAnswer:\n"
        f"{json.dumps(e.answer)}"
        for i, e in enumerate(EXAMPLES)
    )


def compile_prompt(description: str, manifest: str) -> str:
    return f"""You turn a curator's Description of an expert robot Episode into a Rubric: typed \
Criteria that code measures on every Episode. You never measure anything yourself.

{manifest}

How to answer:
1. Split the Description into Phrases, in order. Each Phrase is one requirement (or one piece of \
framing), copied from the Description exactly, character for character, as one contiguous \
stretch of it. Phrases never overlap. Every meaningful word should fall inside some Phrase.
2. For each Phrase, first restate precisely what it requires of an Episode ("restatement"), \
then give it a status:
   - "checked": the primitives above can check it. Give one or more Criteria; most Phrases need \
one.
   - "context": it frames the Description and asks nothing checkable of an Episode (e.g. it \
names the task). Give a one-line reason. No Criteria.
   - "unsupported": it asks something of an Episode, but no primitive above can check it. Give a \
one-line reason naming what is missing. No Criteria. Never stretch a primitive to cover a \
Phrase it doesn't measure.
3. A Criterion is one primitive compared with one threshold, in the primitive's unit:
   - "params": every parameter the primitive takes; null for the parameters it doesn't take.
   - "window": where in the Episode it looks; "seconds" only for last_n_s, else null.
   - "views", "question" and "paraphrases" are for tracked and visual primitives only: use [], \
null and [] for measured ones.
   - "hard": true, unless the Phrase says ideally, preferably or similar; a soft Criterion is \
shown but never rejects an Episode.
   - "assumptions": one sentence for each value the Description doesn't state that you had to \
choose (a threshold, a speed, a window), saying what you assumed. Use the anchor-pool ranges to \
choose values that separate good Episodes from bad ones. No assumption for a value the \
Description states.

{_examples()}

Now the curator's Description:
{json.dumps(description)}"""


def repair_prompt(errors: Sequence[str], whole: bool) -> str:
    """The follow-up after an answer failed code's checks: fix the listed Phrases, or the whole
    answer when it couldn't be read at all."""
    listed = "\n".join(f"- {e}" for e in errors)
    if whole:
        scope = "Answer again in full, following the schema."
    else:
        scope = (
            "Answer again with only these Phrases, corrected, in the order listed. If a Phrase "
            'truly can\'t be checked with the primitives above, mark it "unsupported" with a '
            "reason."
        )
    return f"Your answer above failed these checks:\n{listed}\n\n{scope}"
