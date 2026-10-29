// One Criterion result in the Workstation panel: status, the rendered English, kind and hard or
// soft, the measurement; expanded, its Phrase, Evidence, window and moment chips.
import { ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { SeekableText } from "./SeekableText";
import { STATUS_TEXT } from "./TriageBadge";
import type { CriterionResult } from "./useTriage";

function windowText(r: CriterionResult): string {
  if (!r.window) return `${r.window_name}: empty`;
  return `${r.window_name}, ${r.window.start.toFixed(1)}–${r.window.end.toFixed(1)} s`;
}

export function CriterionResultRow(props: {
  result: CriterionResult;
  open: boolean;
  onToggle: () => void;
  onSeek: (t: number) => void;
}) {
  const r = props.result;
  return (
    <div className="border-t py-2" data-testid={`criterion-${r.criterion_id}`}>
      <button
        type="button"
        aria-expanded={props.open}
        onClick={props.onToggle}
        className="flex w-full items-baseline gap-2 text-left"
      >
        <ChevronRight
          className={cn(
            "size-3 shrink-0 self-center transition-transform",
            props.open && "rotate-90",
          )}
        />
        <span className={cn("w-12 shrink-0 text-xs font-medium", STATUS_TEXT[r.status])}>
          {r.status}
        </span>
        <span className="flex-1 text-sm leading-snug">{r.english}</span>
      </button>
      <div className="mt-0.5 ml-[4.75rem] flex flex-wrap gap-x-2 text-xs text-muted-foreground">
        <span className="font-medium text-foreground tabular-nums">{r.measurement}</span>
        <span>
          {r.kind} · {r.hard ? "hard" : "soft"}
        </span>
        <span className="tabular-nums" title="How likely this Criterion passes">
          p {r.p_pass.toFixed(2)}
        </span>
        {r.uncertainty && <span className={STATUS_TEXT.unsure}>{r.uncertainty}</span>}
      </div>
      {props.open && (
        <div className="mt-2 ml-[4.75rem] grid gap-1.5 text-sm leading-snug">
          <div className="text-xs text-muted-foreground">“{r.phrase}”</div>
          <p>
            <SeekableText spans={r.evidence} onSeek={props.onSeek} />
          </p>
          <div className="text-xs text-muted-foreground">Window: {windowText(r)}</div>
          {r.moments.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {r.moments.map((m) => (
                <Button
                  key={`${m.label}-${String(m.t)}`}
                  size="xs"
                  variant="outline"
                  aria-label={`${m.label} ${m.t.toFixed(1)} s`}
                  onClick={() => {
                    props.onSeek(m.t);
                  }}
                >
                  {m.label} · {m.t.toFixed(1)} s
                </Button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
