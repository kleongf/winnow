// Robot-data plots on the Workstation's shared time axis. One series each, so no legend: the
// header names it and reads out its value at the hovered time (else at the playhead).
// Hovering one plot draws the crosshair on all of them; clicking seeks.
import { useState, type MouseEvent } from "react";

import type { Playhead } from "./usePlayhead";
import type { Signals } from "./useEpisodes";

type Key = "gripper" | "z" | "speed";

const PLOTS: { key: Key; label: string; unit: string; digits: number; fixed?: [number, number] }[] =
  [
    { key: "gripper", label: "Gripper", unit: "0 open · 1 closed", digits: 2, fixed: [0, 1] },
    { key: "z", label: "Height", unit: "m", digits: 3 },
    { key: "speed", label: "Speed", unit: "m/s", digits: 3 },
  ];

const SERIES = "#2a78d6"; // categorical slot 1 (dataviz reference palette)
const LEVEL = "#d97706"; // the Rubric's levels, amber like its assumed values
const WIDTH = 1000;
const HEIGHT = 56;

function domain(values: number[], fixed?: [number, number]): [number, number] {
  if (fixed) return fixed;
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const pad = (hi - lo) * 0.1 || 0.01;
  return [lo - pad, hi + pad];
}

export function valueAt(signals: Signals, key: Key, t: number): number | undefined {
  const step = signals.t[1] ?? 0;
  const index = step > 0 ? Math.round(t / step) : 0;
  return signals[key][Math.max(0, Math.min(signals[key].length - 1, index))];
}

export function SignalPlots(props: {
  signals: Signals;
  playhead: Playhead;
  duration: number;
  /** A dashed reference line per plot, e.g. the Rubric's gripper-closed level. */
  levels?: Partial<Record<Key, number>>;
}) {
  const [hoverT, setHoverT] = useState<number | null>(null);
  const timeAt = (event: MouseEvent<SVGSVGElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    return ((event.clientX - box.left) / box.width) * props.duration;
  };
  const x = (t: number) => (t / props.duration) * WIDTH;
  const readT = hoverT ?? props.playhead.t;
  return (
    <div className="mt-3 grid gap-2.5">
      {PLOTS.map((plot) => {
        const values = props.signals[plot.key];
        const [lo, hi] = domain(values, plot.fixed);
        const y = (v: number) => HEIGHT - 2 - ((v - lo) / (hi - lo)) * (HEIGHT - 4);
        const points = values
          .map((v, i) => `${String(x(props.signals.t[i] ?? 0))},${String(y(v))}`)
          .join(" ");
        const value = valueAt(props.signals, plot.key, readT);
        const level = props.levels?.[plot.key];
        return (
          <div key={plot.key}>
            <div className="mb-0.5 flex items-baseline gap-1.5 text-[11px]">
              <span className="text-muted-foreground">{plot.label}</span>
              <span
                className="ml-auto font-medium tabular-nums"
                data-testid={`readout-${plot.key}`}
              >
                {value?.toFixed(plot.digits)}
              </span>
              <span className="text-muted-foreground">
                {plot.unit} · {readT.toFixed(1)} s
              </span>
            </div>
            <svg
              role="img"
              aria-label={`${plot.label} over the Episode`}
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
                props.playhead.seek(timeAt(event));
              }}
            >
              <polyline
                points={points}
                fill="none"
                stroke={SERIES}
                strokeWidth={2}
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
              {level !== undefined && (
                <line
                  data-testid={`level-${plot.key}`}
                  x1={0}
                  x2={WIDTH}
                  y1={y(level)}
                  y2={y(level)}
                  stroke={LEVEL}
                  strokeDasharray="6 4"
                  vectorEffect="non-scaling-stroke"
                >
                  <title>{`${plot.label} level ${String(level)}`}</title>
                </line>
              )}
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
      })}
    </div>
  );
}
