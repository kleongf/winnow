// Each tracked Criterion's track plot on the Workstation's time axis: the signal it is decided on
// (e.g. the object's distance from the fingers), with the line it is judged against. The line
// breaks where SAM had no box. Clicking a plot opens its result on its view, at that time.
import { useState, type MouseEvent } from "react";

import type { Playhead } from "../episodes/usePlayhead";
import { plotDomain, plotRuns, plotValueAt } from "./trackPlot";
import type { CriterionResult, TrackPlot } from "./useTriage";

const SERIES = "#2a78d6"; // categorical slot 1, as the robot-data plots
const LEVEL = "#d97706"; // the Rubric's levels, amber like its assumed values
const WIDTH = 1000;
const HEIGHT = 56;

export function TrackPlots(props: {
  results: CriterionResult[];
  playhead: Playhead;
  duration: number;
  onFocus: (result: CriterionResult, t: number) => void;
}) {
  const plotted = props.results.flatMap((r) => (r.track_plot ? [{ r, plot: r.track_plot }] : []));
  if (!plotted.length) return null;
  return (
    <div className="mt-3 grid gap-2.5" aria-label="Track plots">
      {plotted.map(({ r, plot }) => (
        <PlotRow
          key={r.criterion_id}
          result={r}
          plot={plot}
          playhead={props.playhead}
          duration={props.duration}
          onFocus={props.onFocus}
        />
      ))}
    </div>
  );
}

function PlotRow(props: {
  result: CriterionResult;
  plot: TrackPlot;
  playhead: Playhead;
  duration: number;
  onFocus: (result: CriterionResult, t: number) => void;
}) {
  const { plot, result } = props;
  const [hoverT, setHoverT] = useState<number | null>(null);
  const timeAt = (event: MouseEvent<SVGSVGElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    return ((event.clientX - box.left) / box.width) * props.duration;
  };
  const x = (t: number) => (t / props.duration) * WIDTH;
  const [lo, hi] = plotDomain(plot);
  const y = (v: number) => HEIGHT - 2 - ((v - lo) / (hi - lo)) * (HEIGHT - 4);
  const readT = hoverT ?? props.playhead.t;
  const value = plotValueAt(plot, readT);
  return (
    <div data-testid={`track-plot-${result.criterion_id}`}>
      <div className="mb-0.5 flex items-baseline gap-1.5 text-[11px]">
        <span className="truncate text-muted-foreground">
          {plot.label} · {result.primitive}
        </span>
        <span className="ml-auto font-medium tabular-nums" data-testid="track-plot-readout">
          {value === null ? "—" : value.toFixed(2)}
        </span>
        <span className="text-muted-foreground">
          {plot.unit} · {readT.toFixed(1)} s
        </span>
      </div>
      <svg
        role="img"
        aria-label={`${plot.label}, for ${result.english}`}
        viewBox={`0 0 ${String(WIDTH)} ${String(HEIGHT)}`}
        preserveAspectRatio="none"
        className="block h-14 w-full cursor-crosshair rounded-sm bg-muted/50"
        onPointerMove={(event) => {
          setHoverT(timeAt(event));
        }}
        onPointerLeave={() => {
          setHoverT(null);
        }}
        onClick={(event) => {
          props.onFocus(result, timeAt(event));
        }}
      >
        {plotRuns(plot.points).map((run) => (
          <polyline
            key={run[0]?.t}
            points={run.map((p) => `${String(x(p.t))},${String(y(p.value ?? 0))}`).join(" ")}
            fill="none"
            stroke={SERIES}
            strokeWidth={2}
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        ))}
        <line
          x1={0}
          x2={WIDTH}
          y1={y(plot.level)}
          y2={y(plot.level)}
          stroke={LEVEL}
          strokeDasharray="6 4"
          vectorEffect="non-scaling-stroke"
        >
          <title>{`Judged against ${String(plot.level)} ${plot.unit}`}</title>
        </line>
        {hoverT !== null && (
          <line
            x1={x(hoverT)}
            x2={x(hoverT)}
            y1={0}
            y2={HEIGHT}
            className="stroke-muted-foreground"
            strokeDasharray="3 3"
            vectorEffect="non-scaling-stroke"
          />
        )}
        <line
          x1={x(props.playhead.t)}
          x2={x(props.playhead.t)}
          y1={0}
          y2={HEIGHT}
          className="stroke-foreground"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  );
}
