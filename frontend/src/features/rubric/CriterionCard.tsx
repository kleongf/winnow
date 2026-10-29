// One Criterion of the draft, in the English rendered from its typed fields, with each value
// Spark had to assume marked in amber for the curator to confirm.
import { AlertTriangle } from "lucide-react";

import { ASSUMED } from "./phraseTones";
import type { Criterion } from "./useDraft";

export function CriterionCard(props: { criterion: Criterion; english: string }) {
  const { criterion } = props;
  return (
    <article
      id={`criterion-${criterion.id}`}
      aria-label={props.english}
      className="rounded-lg border bg-card p-3"
    >
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <code className="font-semibold text-foreground">{criterion.primitive}</code>
        <span className="rounded border px-1">{criterion.kind}</span>
        <span className="ml-auto">{criterion.hard ? "hard" : "soft · never rejects"}</span>
      </div>
      <p className="mt-1 text-sm">{props.english}</p>
      {criterion.assumptions.map((assumption) => (
        <p
          key={assumption}
          className={`mt-2 flex items-start gap-1.5 px-2 py-1 text-xs ${ASSUMED}`}
          data-testid="assumption"
        >
          <AlertTriangle className="mt-0.5 size-3 shrink-0" />
          <span>Assumed: {assumption}</span>
        </p>
      ))}
    </article>
  );
}
