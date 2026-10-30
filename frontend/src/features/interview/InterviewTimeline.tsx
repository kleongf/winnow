// The Describe interview, under the Description: answered cards collapsed to their effect, then
// the one question code asks next. It is done once every Phrase is covered; assumed thresholds
// can still be asked after that, and Run never waits for them.
import { AnsweredCard } from "./AnsweredCard";
import { QuestionCard } from "./QuestionCard";
import { type Interview, useAnswer, useInterview, useUndo } from "./useInterview";

function plural(n: number, word: string): string {
  return `${String(n)} ${word}${n === 1 ? "" : "s"}`;
}

function Status(props: { interview: Interview }) {
  const { covered, phrases_left: phrases, thresholds_left: thresholds } = props.interview;
  const left =
    thresholds > 0 ? ` ${plural(thresholds, "assumed threshold")} can still be asked.` : "";
  return (
    <p className="text-xs text-muted-foreground" data-testid="interview-status">
      {covered
        ? `Every Phrase is covered: the interview is done.${left}`
        : `${plural(phrases, "Phrase")} to cover before the interview is done.`}
    </p>
  );
}

export function InterviewTimeline(props: {
  onShowCriterion: (criterionId: string) => void;
  onUndone: () => void;
  onEditSentence: (start: number, end: number) => void;
}) {
  const { onShowCriterion, onUndone, onEditSentence } = props;
  const interview = useInterview();
  const answer = useAnswer();
  const undo = useUndo();
  const pending = answer.isPending || undo.isPending;
  const data = interview.data;
  if (!data) return null;
  const error = answer.error ?? undo.error;
  return (
    <section aria-label="Interview" className="mt-6">
      <h2 className="text-sm font-medium">Interview</h2>
      <Status interview={data} />
      <ol className="mt-2 grid gap-1.5">
        {data.answered.map((a) => (
          <li key={a.id}>
            <AnsweredCard
              answer={a}
              pending={pending}
              onShow={onShowCriterion}
              onUndo={(id) => {
                undo.mutate(id, { onSuccess: onUndone });
              }}
            />
          </li>
        ))}
      </ol>
      {error && <p className="mt-2 text-sm text-destructive">{error.message}</p>}
      {data.question && (
        <div className="mt-2">
          <QuestionCard
            key={`${data.question.key}:${String(data.answered.length)}`}
            question={data.question}
            pending={pending}
            onEditSentence={onEditSentence}
            onAnswer={(value) => {
              const question = data.question;
              if (!question) return;
              const episodeId = question.kind === "threshold" ? question.episode_id : null;
              answer.mutate(
                { key: question.key, episode_id: episodeId, answer: value },
                {
                  onSuccess: (next) => {
                    const changed = next.answered.at(-1)?.changed_criterion;
                    if (changed) onShowCriterion(changed);
                  },
                },
              );
            }}
          />
        </div>
      )}
    </section>
  );
}
