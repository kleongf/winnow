import { useState, type SyntheticEvent } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

import { parseIndices } from "./parseIndices";
import { useStartIngest } from "./useStartIngest";

export function IngestForm(props: { disabled: boolean }) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const start = useStartIngest();

  const submit = (event: SyntheticEvent) => {
    event.preventDefault();
    const parsed = parseIndices(text);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    setError(null);
    start.mutate(parsed.indices, {
      onSuccess: () => {
        setText("");
      },
    });
  };

  return (
    <form onSubmit={submit} className="rounded-lg border p-4">
      <label htmlFor="ingest-indices" className="text-sm font-medium">
        Ingest from droid_100
      </label>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Episode indices, separated by spaces or commas; ranges like 40-45 work. Episodes already in
        the Dataset are skipped.
      </p>
      <Textarea
        id="ingest-indices"
        className="mt-2 font-mono"
        rows={2}
        placeholder="3 16 42 48 49"
        value={text}
        onChange={(event) => {
          setText(event.target.value);
        }}
      />
      {(error ?? start.error) && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {error ?? start.error?.message}
        </p>
      )}
      <Button type="submit" size="sm" className="mt-3" disabled={props.disabled || start.isPending}>
        Ingest
      </Button>
    </form>
  );
}
