"""What a Description edit changed: the draft's Phrases it left alone, and the stretches of new
text compile must ask Spark about.

The two Descriptions are compared word by word (punctuation counts as a word, spacing doesn't).
A Phrase is kept only when no edit falls inside it or adds words at its edges and its text is
still there character for character; every other Phrase the edit touched is asked about again,
with the new words around it.
"""

import difflib
import re
from collections.abc import Sequence
from dataclasses import dataclass

from winnow.rubric.models import DraftPhrase
from winnow.rubric.phrases import FILLER, WORD, TextRange

TOKEN = re.compile(rf"{WORD.pattern}|\S")


@dataclass(frozen=True)
class _Token:
    text: str
    start: int
    end: int


@dataclass(frozen=True)
class _Edit:
    old: range  # token positions in the old Description; empty where words were only added
    new: range  # and in the new


@dataclass(frozen=True)
class DescriptionDiff:
    kept: list[DraftPhrase]  # unchanged, moved to where each now sits
    stretches: list[TextRange]  # the changed text, in Description order


def _tokens(text: str) -> list[_Token]:
    return [_Token(m.group(), m.start(), m.end()) for m in TOKEN.finditer(text)]


def _span(tokens: list[_Token], start: int, end: int) -> range:
    """The positions of the tokens inside characters [start, end)."""
    inside = [i for i, t in enumerate(tokens) if start <= t.start and t.end <= end]
    return range(inside[0], inside[-1] + 1) if inside else range(0)


def _touches(edit: _Edit, phrase: range) -> bool:
    if not edit.old:  # words added: inside the Phrase or at either edge
        return phrase.start <= edit.old.start <= phrase.stop
    return edit.old.start < phrase.stop and phrase.start < edit.old.stop


def _meaningful(run: list[int], tokens: list[_Token]) -> bool:
    words = [tokens[i].text for i in run if WORD.fullmatch(tokens[i].text)]
    return any(w.lower() not in FILLER for w in words)


def _stretches(changed: set[int], tokens: list[_Token], new: str) -> list[TextRange]:
    """Changed tokens, joined into runs across punctuation; runs with no meaningful word go."""
    runs: list[list[int]] = []
    for i in sorted(changed):
        between = range(runs[-1][-1] + 1, i) if runs else range(0)
        if runs and not any(WORD.fullmatch(tokens[j].text) for j in between):
            runs[-1].append(i)
        else:
            runs.append([i])
    spans = [(tokens[r[0]].start, tokens[r[-1]].end) for r in runs if _meaningful(r, tokens)]
    return [TextRange(start=start, end=end, text=new[start:end]) for start, end in spans]


def diff_description(old: str, phrases: Sequence[DraftPhrase], new: str) -> DescriptionDiff:
    """`phrases` are the draft's, in `old`."""
    before, after = _tokens(old), _tokens(new)
    matcher = difflib.SequenceMatcher(
        None, [t.text for t in before], [t.text for t in after], autojunk=False
    )
    moved: dict[int, int] = {}  # old token position -> new, for unchanged tokens
    edits: list[_Edit] = []
    for tag, i1, i2, j1, j2 in matcher.get_opcodes():
        if tag == "equal":
            moved |= {i1 + k: j1 + k for k in range(i2 - i1)}
        else:
            edits.append(_Edit(range(i1, i2), range(j1, j2)))
    changed = {j for edit in edits for j in edit.new}
    kept: list[DraftPhrase] = []
    for phrase in phrases:
        span = _span(before, phrase.start, phrase.end)
        here = [moved[i] for i in span if i in moved]
        start = after[here[0]].start if here else 0
        end = after[here[-1]].end if here else 0
        if here and not any(_touches(e, span) for e in edits) and new[start:end] == phrase.text:
            kept.append(phrase.model_copy(update={"start": start, "end": end}))
        else:
            changed.update(here)
    return DescriptionDiff(kept, _stretches(changed, after, new))
