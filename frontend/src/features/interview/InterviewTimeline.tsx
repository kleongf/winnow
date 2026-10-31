// The Describe interview, under the Description: answered cards collapsed to their effect, then
// the one question code asks next. It is done once every Phrase is covered; assumed thresholds,
// hard or soft, and assumed grasp settings can still be asked after that, and Run never waits
// for them.
import { AnsweredCard } from "./AnsweredCard";
import { QuestionCard } from "./QuestionCard";
import { type Interview, useAnswer, useInterview, useUndo } from "./useInterview";

function plural(n: number, word: string): string {
  return `${String(n)} ${word}${n === 1 ? "" : "s"}`;
}

function stillAsked(interview: Interview): string {
  const left = [
    [interview.thresholds_left, "assumed threshold"],
    [interview.hard_soft_left, "hard-or-soft question"],
    [interview.settings_left, "assumed grasp setting"],
  ] as const;
  const counts = left.filter(([n]) => n > 0).map(([n, word]) => plural(n, word));
  return counts.length > 0 ? ` Can still be asked: ${counts.join(", ")}.` : "";
}

function Status(props: { interview: Interview }) {
  const { covered, phrases_left: phrases } = props.interview;
  const left = stillAsked(props.interview);
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
              const onEpisode = question.kind === "threshold" || question.kind === "setting";
              const episodeId = onEpisode ? question.episode_id : null;
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
