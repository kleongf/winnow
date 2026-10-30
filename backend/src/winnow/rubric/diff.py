"""What a Description edit changed: the draft's Phrases it left alone, and the stretches of new
text compile must ask Spark about.

The two Descriptions are compared word by word (punctuation counts as a word, spacing doesn't).
A Phrase is kept only when no edit falls inside it or adds words at its edges and its text is
still there character for character; every other Phrase the edit touched is asked about again,
with the new words around it. Words added after punctuation at a Phrase's edge (a new sentence
or clause beside it) don't touch it, and are asked about on their own.
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


def _is_word(token: _Token) -> bool:
    return WORD.fullmatch(token.text) is not None


def _touches(edit: _Edit, phrase: range, after: list[_Token]) -> bool:
    if edit.old:
        return edit.old.start < phrase.stop and phrase.start < edit.old.stop
    # Text only added: inside the Phrase, or at an edge with no punctuation between them.
    at = edit.old.start
    if at == phrase.stop:
        return _is_word(after[edit.new.start])
    if at == phrase.start:
        return _is_word(after[edit.new.stop - 1])
    return phrase.start < at < phrase.stop


def _meaningful(run: list[int], tokens: list[_Token]) -> bool:
    words = [tokens[i].text for i in run if _is_word(tokens[i])]
    return any(w.lower() not in FILLER for w in words)


def _stretches(changed: set[int], tokens: list[_Token], new: str) -> list[TextRange]:
    """Changed tokens, joined into runs across punctuation; runs with no meaningful word go."""
    runs: list[list[int]] = []
    for i in sorted(changed):
        between = range(runs[-1][-1] + 1, i) if runs else range(0)
        if runs and not any(_is_word(tokens[j]) for j in between):
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
    # The words an edit added; punctuation it added at their edges stays out of the stretches.
    changed = {j for edit in edits for j in edit.new if _is_word(after[j])}
    kept: list[DraftPhrase] = []
    for phrase in phrases:
        span = _span(before, phrase.start, phrase.end)
        here = [moved[i] for i in span if i in moved]
        start = after[here[0]].start if here else 0
        end = after[here[-1]].end if here else 0
        if (
            here
            and not any(_touches(e, span, after) for e in edits)
            and new[start:end] == phrase.text
        ):
            kept.append(phrase.model_copy(update={"start": start, "end": end}))
        else:
            changed.update(here)
    return DescriptionDiff(kept, _stretches(changed, after, new))
