// An answered question, collapsed to the answer and its effect. Clicking it shows the Criterion it
// changed; Undo takes it back, with the later answers on the same question.
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type { AnswerValue, InterviewAnswer } from "./useInterview";

const ANSWER_LABELS: Record<AnswerValue, string> = {
  accept: "left unchecked",
  context: "marked Context",
  pass: "fine",
  fail: "not fine",
  skip: "skipped",
};

function heading(answer: InterviewAnswer): string {
  if (answer.measurement && answer.episode_id) {
    return `${answer.measurement} on ${answer.episode_id}: ${ANSWER_LABELS[answer.answer]}`;
  }
  return `“${answer.subject}”: ${ANSWER_LABELS[answer.answer]}`;
}

export function AnsweredCard(props: {
  answer: InterviewAnswer;
  pending: boolean;
  onUndo: (answerId: number) => void;
  onShow: (criterionId: string) => void;
}) {
  const { answer, pending, onUndo, onShow } = props;
  const changed = answer.changed_criterion;
  return (
    <article
      aria-label={`Answer: ${answer.subject}`}
      className={cn(
        "rounded-lg border bg-muted/40 px-3 py-2 text-xs",
        changed && "cursor-pointer hover:bg-muted",
      )}
      onClick={() => {
        if (changed) onShow(changed);
      }}
    >
      <div className="flex items-start gap-2">
        <p className="min-w-0 flex-1 font-medium">{heading(answer)}</p>
        <Button
          size="xs"
          variant="ghost"
          disabled={pending}
          onClick={(event) => {
            event.stopPropagation();
            onUndo(answer.id);
          }}
        >
          Undo
        </Button>
      </div>
      <p className="mt-0.5 text-muted-foreground" data-testid="answer-effect">
        {answer.effect}
      </p>
    </article>
  );
}
