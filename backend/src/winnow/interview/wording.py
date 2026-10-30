"""The interview's words, from templates: no model call."""

from winnow.criteria.english import format_value
from winnow.criteria.models import Criterion
from winnow.interview.bisection import Resolution
from winnow.interview.models import AnswerValue, Option

PHRASE_OPTIONS = [
    Option(answer="accept", label="Leave it unchecked: it never fails an Episode"),
    Option(answer="context", label="Mark it Context: it describes, it doesn't require"),
]


def phrase_prompt(text: str, reason: str | None) -> str:
    why = f" {reason.rstrip('.')}." if reason else ""
    return f"Nothing checks “{text}”.{why} What should Winnow do with it?"


def words_prompt(text: str) -> str:
    return f"“{text}” is in no Phrase, so nothing checks it. What should Winnow do with it?"


def threshold_prompt(measurement: str, phrase: str) -> str:
    return f"Is {measurement} fine for “{phrase}”?"


def threshold_options(phrase: str) -> list[Option]:
    return [
        Option(answer="pass", label=f"Fine: “{phrase}” passes"),
        Option(answer="fail", label=f"Not fine: “{phrase}” fails"),
        Option(answer="skip", label="Skip: leave this threshold assumed"),
    ]


def phrase_effect(answer: AnswerValue, text: str) -> str:
    if answer == "context":
        return f"Marked Context: “{text}” checks nothing, by design."
    return f"Left unchecked: nothing checks “{text}”."


def label_effect(episode_id: str, answer: AnswerValue, phrase: str) -> str:
    return f"Labelled {episode_id} {answer} on “{phrase}”."


def resolution_effect(resolution: Resolution, before: Criterion) -> str:
    unit = before.unit
    if resolution.outcome == "confirmed":
        return f"Threshold confirmed at {format_value(before.threshold, unit)}."
    if resolution.outcome == "unbracketed":
        return (
            "No anchor Episode on the other side brackets it, so the threshold stays assumed; "
            "the labels hold for these Episodes."
        )
    margin = format_value(resolution.margin or 0.0, unit)
    return (
        f"Threshold {format_value(before.threshold, unit)} → "
        f"{format_value(resolution.threshold, unit)}, margin ± {margin}."
    )
