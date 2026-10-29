// The Describe page: write a Description on the left and compile it; the live Rubric draft is
// on the right. Every number here comes from the anchor pool (the Dev set), never the Test set.
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

import { RubricPanel } from "./RubricPanel";
import { useAnchorPool, useCompile, useDraft } from "./useDraft";
import { useRubric } from "./useRubric";

function plural(n: number, word: string): string {
  return `${String(n)} ${word}${n === 1 ? "" : "s"}`;
}

function AnchorPoolLine() {
  const pool = useAnchorPool().data;
  if (!pool) return null;
  return (
    <p className="text-xs text-muted-foreground" data-testid="anchor-pool">
      Anchor pool: <span className="font-medium text-foreground">Dev set</span> ·{" "}
      {plural(pool.episode_ids.length, "Episode")} ·{" "}
      {plural(pool.hidden_test_episodes, "Test set Episode")} hidden
    </p>
  );
}

function DescriptionForm() {
  const draft = useDraft().data;
  const latest = useRubric().data;
  const compile = useCompile();
  const [edited, setEdited] = useState<string | null>(null);
  // Starts from the draft, or else the Rubric in use.
  const text = edited ?? draft?.description ?? latest?.rubric.description ?? "";
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        compile.mutate(text.trim());
      }}
    >
      <label htmlFor="description" className="text-sm font-medium">
        Description
      </label>
      <p className="mt-0.5 text-xs text-muted-foreground">
        What an expert Episode looks like, in plain English. Spark compiles it into Criteria.
      </p>
      <Textarea
        id="description"
        className="mt-2 min-h-32 text-[15px] leading-6"
        value={text}
        onChange={(e) => {
          setEdited(e.target.value);
        }}
      />
      <div className="mt-2 flex items-center gap-3">
        <Button type="submit" size="sm" disabled={compile.isPending || !text.trim()}>
          {compile.isPending ? "Compiling…" : "Compile"}
        </Button>
        {compile.isPending && (
          <span className="text-xs text-muted-foreground">
            Spark is reading it against the catalog; this can take a minute.
          </span>
        )}
      </div>
      {compile.error && <p className="mt-2 text-sm text-destructive">{compile.error.message}</p>}
    </form>
  );
}

export function DescribePage() {
  const draft = useDraft();
  return (
    <div>
      <header className="sticky top-0 z-10 border-b bg-background/95 px-8 py-3 backdrop-blur">
        <div className="text-xs text-muted-foreground">Project</div>
        <h1 className="text-xl font-semibold">Describe</h1>
        <AnchorPoolLine />
      </header>
      <div className="grid grid-cols-[minmax(0,5fr)_minmax(0,6fr)] gap-8 px-8 py-5">
        <div className="sticky top-28 self-start">
          <DescriptionForm />
        </div>
        <div aria-label="Rubric draft" role="region">
          {draft.data ? (
            <RubricPanel draft={draft.data} />
          ) : (
            <p className="text-sm text-muted-foreground">
              {draft.isPending ? "Loading…" : "Compile a Description to see its Rubric draft."}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
