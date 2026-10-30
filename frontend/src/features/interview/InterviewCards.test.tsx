import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";

import { AnsweredCard } from "./AnsweredCard";
import { QuestionCard } from "./QuestionCard";
import type { InterviewAnswer, PhraseQuestion, ThresholdQuestion } from "./useInterview";

const threshold: ThresholdQuestion = {
  kind: "threshold",
  key: "threshold:longest-still-s",
  prompt: "Is 1.8 s fine for “no long pauses”?",
  options: [
    { answer: "pass", label: "Fine: “no long pauses” passes" },
    { answer: "fail", label: "Not fine: “no long pauses” fails" },
    { answer: "skip", label: "Skip: leave this threshold assumed" },
  ],
  criterion_id: "longest-still-s",
  phrase: "no long pauses",
  english: "Longest stretch with the arm under 0.01 m/s < 1 s",
  episode_id: "droid_100:6",
  value: 1.8,
  measurement: "1.8 s",
  camera: "exterior_1_left",
  clip: { start: 1.2, end: 4.0 },
  asked: 1,
  max_questions: 3,
  near: 2,
};

const unsupported: PhraseQuestion = {
  kind: "phrase",
  key: "phrase:40",
  prompt: "Nothing checks “never drops it”. Nothing tracks the object yet. What should …",
  options: [
    { answer: "accept", label: "Leave it unchecked: it never fails an Episode" },
    { answer: "context", label: "Mark it Context: it describes, it doesn't require" },
  ],
  text: "never drops it",
  start: 40,
  end: 54,
  reason: "Nothing tracks the object yet.",
};

test("a threshold card plays the measured stretch with its value, and its options say which passes", () => {
  const onAnswer = vi.fn();
  render(<QuestionCard question={threshold} pending={false} onAnswer={onAnswer} />);

  expect(screen.getByLabelText("Episode clip")).toHaveAttribute(
    "src",
    "/api/episodes/droid_100%3A6/clips/exterior_1_left#t=1.2,4",
  );
  expect(screen.getByTestId("clip-value")).toHaveTextContent("1.8 s");
  expect(screen.getByText(/^Question 2 of at most 3/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Not fine: “no long pauses” fails" }));
  expect(onAnswer).toHaveBeenCalledWith("fail");
});

test("a Phrase card can send the curator to edit the sentence instead", () => {
  const onEditSentence = vi.fn();
  render(
    <QuestionCard
      question={unsupported}
      pending={false}
      onAnswer={vi.fn()}
      onEditSentence={onEditSentence}
    />,
  );

  fireEvent.click(screen.getByRole("button", { name: "Edit the sentence" }));
  expect(onEditSentence).toHaveBeenCalledWith(40, 54);
});

test("an answered card shows its answer and effect, and undoes it", () => {
  const answer: InterviewAnswer = {
    id: 7,
    key: "threshold:longest-still-s",
    kind: "threshold",
    subject: "no long pauses",
    episode_id: "droid_100:6",
    measurement: "1.8 s",
    answer: "fail",
    effect: "Labelled droid_100:6 fail on “no long pauses”. Threshold 2 s → 1.5 s, margin ± 0.3 s.",
    changed_criterion: "longest-still-s",
    label_id: 3,
    resolution: "set",
    answered_at: "2026-10-29T12:00:00Z",
  };
  const onUndo = vi.fn();
  render(<AnsweredCard answer={answer} pending={false} onUndo={onUndo} onShow={vi.fn()} />);

  expect(screen.getByRole("article")).toHaveTextContent("1.8 s on droid_100:6: not fine");
  expect(screen.getByRole("article")).toHaveTextContent("Threshold 2 s → 1.5 s");
  fireEvent.click(screen.getByRole("button", { name: "Undo" }));
  expect(onUndo).toHaveBeenCalledWith(7);
});
