// The Describe page: write a Description on the left and compile it; the live Rubric draft is
// on the right, edited directly on its cards. Every number here comes from the anchor pool (the
// Dev set), never the Test set. `?version=` shows a frozen Rubric version instead.
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

import { useSearchParams } from "../core/url";
import { DescribeHeader } from "./DescribeHeader";
import { RubricPanel } from "./RubricPanel";
import { useCompile, useDraft } from "./useDraft";
import { useDraftEditor } from "./useDraftEditor";
import { useVersionPreview } from "./useDraftEdits";
import { useRubric, useVersions } from "./useRubric";
import { VersionPanel } from "./VersionPanel";

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

function shownVersion(params: URLSearchParams): number | null {
  const version = Number(params.get("version"));
  return Number.isInteger(version) && version > 0 ? version : null;
}

export function DescribePage() {
  const version = shownVersion(useSearchParams());
  const draft = useDraft();
  const { editing, preview, error } = useDraftEditor(draft.data);
  const frozen = useVersions().data?.find((v) => v.version === version);
  const frozenPreview = useVersionPreview(version).data;
  return (
    <div>
      <DescribeHeader
        version={version}
        draft={draft.data}
        preview={version === null ? preview : frozenPreview}
      />
      <div className="grid grid-cols-[minmax(0,5fr)_minmax(0,6fr)] gap-8 px-8 py-5">
        <div className="sticky top-32 self-start">
          <DescriptionForm />
        </div>
        <div aria-label={version === null ? "Rubric draft" : "Rubric version"} role="region">
          {error && <p className="mb-2 text-sm text-destructive">{error.message}</p>}
          {version !== null ? (
            frozen ? (
              <VersionPanel version={frozen} preview={frozenPreview} />
            ) : (
              <p className="text-sm text-muted-foreground">Loading v{version}…</p>
            )
          ) : draft.data ? (
            <RubricPanel draft={draft.data} editing={editing} />
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
