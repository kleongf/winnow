// One candidate at a time: its contact sheet, Spark's reading, and the decision keys.
import { useEffect } from "react";

import { Button } from "@/components/ui/button";

import { sheetUrl, useDecide, type Candidate, type ExclusionReason } from "./useSelection";

const EXCLUSIONS: { reason: ExclusionReason; label: string; key: string }[] = [
  { reason: "not pick-and-place", label: "Not pick-and-place", key: "n" },
  { reason: "object too small to see", label: "Object too small to see", key: "s" },
];

function SparkReading(props: { candidate: Candidate }) {
  const c = props.candidate;
  if (c.error) return <p className="text-sm text-destructive">Spark's call failed: {c.error}</p>;
  if (!c.pick_and_place) return <p className="text-sm">Spark: not pick-and-place</p>;
  return (
    <p className="text-sm">
      Spark: pick-and-place · object <span className="font-medium">{c.object ?? "?"}</span> · target{" "}
      <span className="font-medium">{c.target ?? "?"}</span>
    </p>
  );
}

export function CandidateReview(props: { candidate: Candidate; onDone: () => void }) {
  const { candidate, onDone } = props;
  const decide = useDecide();
  const send = (reason: ExclusionReason | null) => {
    if (decide.isPending) return;
    const decision = reason
      ? { decision: "exclude" as const, reason }
      : { decision: "confirm" as const };
    decide.mutate({ episodeId: candidate.episode_id, decision }, { onSuccess: onDone });
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey) return;
      if (event.key === "y" || event.key === "Enter") send(null);
      const exclusion = EXCLUSIONS.find((e) => e.key === event.key);
      if (exclusion) send(exclusion.reason);
    };
    globalThis.addEventListener("keydown", onKey);
    return () => {
      globalThis.removeEventListener("keydown", onKey);
    };
  });

  return (
    <div className="rounded-lg border p-4" data-testid="candidate">
      <div className="flex items-baseline gap-2">
        <h2 className="text-base font-semibold">Episode {candidate.index}</h2>
        <span className="text-xs text-muted-foreground">
          {candidate.source} · {candidate.status}
          {candidate.exclusion_reason ? `: ${candidate.exclusion_reason}` : ""}
        </span>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        {candidate.task ? `Recorded task: “${candidate.task}”` : "No recorded task"}
      </p>
      <img
        src={sheetUrl(candidate.episode_id)}
        alt={`Contact sheet for Episode ${String(candidate.index)}`}
        className="mt-3 w-full rounded bg-muted"
      />
      <p className="mt-1 text-[11px] text-muted-foreground">
        Top: exterior 1 · bottom: exterior 2 · time runs left to right
      </p>
      <div className="mt-3">
        <SparkReading candidate={candidate} />
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          size="sm"
          onClick={() => {
            send(null);
          }}
        >
          Confirm (Y)
        </Button>
        {EXCLUSIONS.map((e) => (
          <Button
            key={e.reason}
            size="sm"
            variant="outline"
            onClick={() => {
              send(e.reason);
            }}
          >
            {e.label} ({e.key.toUpperCase()})
          </Button>
        ))}
      </div>
    </div>
  );
}
