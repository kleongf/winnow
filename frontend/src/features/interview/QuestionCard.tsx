// The question code is asking now, worded from a template. A Phrase card asks what to do with an
// Unsupported Phrase or words in no Phrase; a threshold card asks whether one anchor Episode's
// measured value is fine, one step of bisecting an assumed threshold.
import { Button } from "@/components/ui/button";

import { ThresholdClip } from "./ThresholdClip";
import type { AnswerValue, Question, ThresholdQuestion } from "./useInterview";

const KIND_LABELS: Record<Question["kind"], string> = {
  phrase: "Unsupported Phrase",
  words: "In no Phrase",
  threshold: "Assumed threshold",
};

function ThresholdDetails(props: { question: ThresholdQuestion }) {
  const { question } = props;
  return (
    <>
      <p className="mt-1 text-xs text-muted-foreground">
        {question.episode_id} · {question.english}
      </p>
      <ThresholdClip question={question} />
      <p className="mt-1 text-[11px] text-muted-foreground">
        Question {question.asked + 1} of at most {question.max_questions}
        {question.near > 0 && ` · ${String(question.near)} anchor Episodes sit near it`}
      </p>
    </>
  );
}

export function QuestionCard(props: {
  question: Question;
  pending: boolean;
  onAnswer: (answer: AnswerValue) => void;
  onEditSentence?: (start: number, end: number) => void;
}) {
  const { question, pending, onAnswer, onEditSentence } = props;
  return (
    <section
      aria-label="Question"
      className="rounded-lg border-2 border-sky-300 bg-card p-3 dark:border-sky-800"
    >
      <div className="text-[11px] font-medium tracking-wide text-sky-800 uppercase dark:text-sky-300">
        {KIND_LABELS[question.kind]}
      </div>
      <p className="mt-1 text-sm font-medium">{question.prompt}</p>
      {question.kind === "threshold" && <ThresholdDetails question={question} />}
      <div className="mt-2 flex flex-wrap gap-1.5">
        {question.options.map((option) => (
          <Button
            key={option.answer}
            size="sm"
            variant={option.answer === "skip" ? "ghost" : "outline"}
            disabled={pending}
            onClick={() => {
              onAnswer(option.answer);
            }}
          >
            {option.label}
          </Button>
        ))}
        {question.kind !== "threshold" && onEditSentence && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              onEditSentence(question.start, question.end);
            }}
          >
            Edit the sentence
          </Button>
        )}
      </div>
    </section>
  );
}
