// The droid_1.0.1 selection pass: confirm or exclude each sampled Episode by task type only.
// The Dataset outcome is never shown here, so it can't steer which Episodes get in.
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { JobProgress } from "../jobs/JobProgress";
import { useIngestProgress } from "../jobs/useIngestProgress";
import { CandidateReview } from "./CandidateReview";
import { sheetUrl, useCandidates, useIngestConfirmed, type Candidate } from "./useSelection";

type Tab = Candidate["status"];
const TABS: Tab[] = ["pending", "confirmed", "excluded"];

export function SelectionPage() {
  const candidates = useCandidates();
  const ingest = useIngestConfirmed();
  const job = useIngestProgress();
  const [tab, setTab] = useState<Tab>("pending");
  const [focusId, setFocusId] = useState<string | null>(null);
  const all = candidates.data ?? [];
  const shown = all.filter((c) => c.status === tab);
  const focused = shown.find((c) => c.episode_id === focusId) ?? shown[0];
  const toIngest = all.filter((c) => c.status === "confirmed" && !c.ingested).length;
  const next = () => {
    const i = shown.findIndex((c) => c.episode_id === focused?.episode_id);
    setFocusId(shown[i + 1]?.episode_id ?? null);
  };

  return (
    <div className="mx-auto max-w-6xl p-8">
      <div className="text-xs text-muted-foreground">Dataset</div>
      <h1 className="text-xl font-semibold">droid_1.0.1 selection</h1>
      <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
        A fixed-seed sample, mostly flagged failures, chosen by task type only: confirm each
        pick-and-place Episode, or exclude it as not pick-and-place or with an object too small to
        see. Whether the Episode succeeded is hidden here on purpose.
      </p>
      {all.length === 0 && !candidates.isPending && (
        <p className="mt-6 rounded-lg border p-4 text-sm">
          No sample yet. Draw one with{" "}
          <code className="font-mono">winnow select droid_1.0.1 --size 300 --seed 0</code>.
        </p>
      )}
      {all.length > 0 && (
        <>
          <div className="mt-6 flex items-center gap-1">
            {TABS.map((t) => (
              <Button
                key={t}
                size="sm"
                variant={t === tab ? "secondary" : "ghost"}
                aria-pressed={t === tab}
                onClick={() => {
                  setTab(t);
                  setFocusId(null);
                }}
              >
                {t[0]?.toUpperCase()}
                {t.slice(1)} ({all.filter((c) => c.status === t).length})
              </Button>
            ))}
            <Button
              size="sm"
              className="ml-auto"
              disabled={toIngest === 0 || ingest.isPending}
              onClick={() => {
                ingest.mutate();
              }}
            >
              Ingest confirmed ({toIngest})
            </Button>
          </div>
          {job.data && (
            <div className="mt-3">
              <JobProgress job={job.data} />
            </div>
          )}
          <div className="mt-4 grid grid-cols-[minmax(0,1fr)_260px] gap-4">
            {focused ? (
              <CandidateReview key={focused.episode_id} candidate={focused} onDone={next} />
            ) : (
              <p className="text-sm text-muted-foreground">Nothing {tab}.</p>
            )}
            <CandidateList candidates={shown} focusId={focused?.episode_id} onFocus={setFocusId} />
          </div>
        </>
      )}
    </div>
  );
}

function CandidateList(props: {
  candidates: Candidate[];
  focusId: string | undefined;
  onFocus: (id: string) => void;
}) {
  return (
    <ul className="max-h-[70vh] space-y-2 overflow-y-auto">
      {props.candidates.map((c) => (
        <li key={c.episode_id}>
          <button
            type="button"
            onClick={() => {
              props.onFocus(c.episode_id);
            }}
            className={cn(
              "w-full rounded border p-1.5 text-left text-xs",
              c.episode_id === props.focusId ? "ring-2 ring-primary" : "hover:bg-muted",
            )}
          >
            <img src={sheetUrl(c.episode_id)} alt="" loading="lazy" className="w-full rounded" />
            <div className="mt-1 font-medium">Episode {c.index}</div>
            <div className="truncate text-muted-foreground">
              {c.object && c.target ? `${c.object} → ${c.target}` : (c.error ?? "—")}
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}
