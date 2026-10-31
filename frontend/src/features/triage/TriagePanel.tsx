// The top of the Workstation's right panel: the Triage decision, its confidence and quality, its
// Reason (times in it seek, marked when Spark wrote it), and the Criterion results, expandable to
// their Evidence and moments.
import { Sparkles } from "lucide-react";

import { CriterionResultRow } from "./CriterionResultRow";
import { formatQuality, QUALITY_TITLE } from "./formatQuality";
import { SeekableText } from "./SeekableText";
import { TriageBadge } from "./TriageBadge";
import { useQuality, type CriterionResult, type EpisodeTriage } from "./useTriage";

export function TriagePanel(props: {
  triage: EpisodeTriage;
  openId: string | null;
  onOpen: (id: string | null) => void;
  /** Open a result on its camera and seek to `t`, or to its own moment. */
  onFocus: (result: CriterionResult, t?: number) => void;
  onSeek: (t: number) => void;
}) {
  const { triage, openId } = props;
  const unchecked = triage.phrases.filter((p) => p.status === null);
  const quality = useQuality(triage.episode_id);
  return (
    <section aria-label="Triage" className="mb-5">
      <div className="flex items-center gap-2">
        <TriageBadge decision={triage.decision} />
        <span className="text-xs text-muted-foreground tabular-nums" data-testid="confidence">
          Confidence {triage.confidence.toFixed(2)}
        </span>
        {quality !== null && (
          <span
            className="text-xs text-muted-foreground tabular-nums"
            data-testid="quality"
            title={QUALITY_TITLE}
          >
            Quality {formatQuality(quality)}
          </span>
        )}
        <span className="ml-auto text-xs text-muted-foreground">
          Rubric v{triage.rubric_version}
        </span>
      </div>
      <p className="mt-2 text-[15px] leading-snug" data-testid="reason">
        <SeekableText spans={triage.reason} onSeek={props.onSeek} />
      </p>
      {triage.reason_source === "spark" && (
        <p
          className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground"
          data-testid="reason-source"
          title="Spark rewrote the template Reason from this Episode's Evidence"
        >
          <Sparkles aria-hidden className="size-3" />
          written by Spark
        </p>
      )}
      <div className="mt-4 mb-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
        Criterion results
      </div>
      {triage.criteria.map((r) => (
        <CriterionResultRow
          key={r.criterion_id}
          episodeId={triage.episode_id}
          result={r}
          open={openId === r.criterion_id}
          onToggle={() => {
            props.onOpen(openId === r.criterion_id ? null : r.criterion_id);
          }}
          onSeek={(t) => {
            props.onFocus(r, t);
          }}
        />
      ))}
      {unchecked.length > 0 && (
        <p className="border-t pt-2 text-xs text-muted-foreground">
          Not checked yet: {unchecked.map((p) => `“${p.phrase}”`).join(", ")}
        </p>
      )}
    </section>
  );
}
