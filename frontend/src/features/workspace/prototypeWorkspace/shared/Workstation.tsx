// PROTOTYPE (throwaway): the winning "Workstation" Episode detail view from #8, ported to
// shadcn/Tailwind and made embeddable. Only Episode 42 has real clips and signals; other Episodes
// show their real frame 0 with the hand-drawn box and lanes from simulated moments.
import { useState, type ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { cameras } from "../../../episodes/prototypeEpisodeDetail/fixture";
import {
  SignalPlot,
  VideoWithBox,
  usePlayhead,
} from "../../../episodes/prototypeEpisodeDetail/shared";
import type { CriterionResult, EpisodeResult } from "../fixture/evaluate";
import { phrases } from "../fixture/rubric";
import { StatusText, TriageBadge } from "./bits";

type Cam = "ext1" | "ext2" | "wrist";
const camIds: Record<Cam, (typeof cameras)[number]["id"]> = {
  ext1: "exterior_image_1_left",
  ext2: "exterior_image_2_left",
  wrist: "wrist_image_left",
};

function usePseudoPlayhead() {
  const [t, setT] = useState(0);
  return { t, seek: setT };
}

export function Workstation(props: {
  result: EpisodeResult;
  /** Rendered at the top of the right panel, e.g. review or label controls. */
  actions?: ReactNode;
  /** Rendered under the Criterion results, e.g. the Spark-alone contrast. */
  footer?: ReactNode;
  /** Hide Triage decision, Reason and Criterion results (Reference label mode). */
  hideOutputs?: boolean;
  /** Stack the panel under the video instead of beside it. */
  stacked?: boolean;
  className?: string;
}) {
  const { result, actions, footer, hideOutputs = false, stacked = false } = props;
  const ep = result.episode;
  const real = usePlayhead();
  const pseudo = usePseudoPlayhead();
  const playhead = ep.hasClips ? real : { ...real, t: pseudo.t, seek: pseudo.seek };
  const [cam, setCam] = useState<Cam>(ep.box?.view ?? "ext1");
  const [open, setOpen] = useState<string | null>(null);

  const focus = (r: CriterionResult) => {
    setOpen(r.criterion.id);
    if (r.criterion.view !== "robot") setCam(r.criterion.view);
    const m = r.moments[0];
    if (m) playhead.seek(Math.max(0, m.t - 0.5));
  };

  return (
    <div
      className={cn(
        "grid gap-4",
        stacked ? "grid-cols-1" : "grid-cols-[minmax(0,1fr)_360px]",
        props.className,
      )}
    >
      <section className="min-w-0">
        <div className="mb-1.5 flex items-center gap-1">
          {(["ext1", "ext2", "wrist"] as Cam[]).map((c) => (
            <Button
              key={c}
              size="sm"
              variant={c === cam ? "secondary" : "ghost"}
              onClick={() => setCam(c)}
            >
              {c === "ext1" ? "Exterior 1" : c === "ext2" ? "Exterior 2" : "Wrist"}
              {ep.box?.view === c ? " · box" : ""}
            </Button>
          ))}
          <span className="ml-auto text-xs text-muted-foreground">
            {ep.source} · Episode {ep.index} · {ep.duration.toFixed(1)} s
          </span>
        </div>
        <Media result={result} cam={cam} playhead={playhead} real={real} />
        <Transport
          t={playhead.t}
          duration={ep.duration}
          onSeek={playhead.seek}
          onToggle={ep.hasClips ? real.toggle : undefined}
          playing={real.playing}
        />
        {!hideOutputs && <Lanes result={result} t={playhead.t} onFocus={focus} />}
        {ep.hasClips ? (
          <div className="mt-3 grid gap-2.5">
            <SignalPlot signal="gripper" playhead={real} threshold={0.35} color="#d97706" />
            <SignalPlot signal="z" playhead={real} color="#2563eb" />
            <SignalPlot signal="speed" playhead={real} threshold={0.02} color="#16a34a" />
          </div>
        ) : (
          <p className="mt-3 text-xs text-muted-foreground">
            Robot-data plots and clips are loaded for Episode 42 only in this prototype.
          </p>
        )}
      </section>
      <aside className="min-w-0 rounded-lg border bg-card p-4">
        {actions}
        {!hideOutputs && (
          <>
            <TriageBadge triage={result.triage} />
            <span className="ml-2 text-xs text-muted-foreground">
              confidence {result.confidence.toFixed(2)}
            </span>
            <p className="mt-2.5 mb-4 text-[15px] leading-snug">{result.reason}</p>
            <div className="mb-1.5 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
              Criterion results
            </div>
            {result.results.map((r) => (
              <ResultRow
                key={r.criterion.id}
                r={r}
                open={open === r.criterion.id}
                onToggle={() => setOpen(open === r.criterion.id ? null : r.criterion.id)}
                onSeek={(t) => {
                  focus(r);
                  playhead.seek(Math.max(0, t - 0.5));
                }}
              />
            ))}
            {footer}
          </>
        )}
        {hideOutputs && (
          <p className="text-sm text-muted-foreground">Outputs hidden while labelling.</p>
        )}
      </aside>
    </div>
  );
}

function Media(props: {
  result: EpisodeResult;
  cam: Cam;
  playhead: { t: number };
  real: ReturnType<typeof usePlayhead>;
}) {
  const ep = props.result.episode;
  if (ep.hasClips) {
    const c = cameras.find((x) => x.id === camIds[props.cam]) ?? cameras[0]!;
    return (
      <VideoWithBox key={c.id} src={c.src} playhead={props.real} showBox={props.cam === "ext1"} />
    );
  }
  const src = props.cam === "wrist" ? null : ep.frames[props.cam];
  return (
    <div className="relative aspect-video w-full overflow-hidden rounded bg-black">
      {src ? (
        <img src={src} alt="" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <div className="grid h-full place-items-center text-sm text-white/60">
          Wrist clip not loaded in the prototype
        </div>
      )}
      {ep.box && ep.box.view === props.cam && (
        <svg viewBox="0 0 320 180" className="absolute inset-0 h-full w-full">
          <rect
            x={ep.box.rect[0]}
            y={ep.box.rect[1]}
            width={ep.box.rect[2] - ep.box.rect[0]}
            height={ep.box.rect[3] - ep.box.rect[1]}
            fill="rgba(80,200,255,0.18)"
            stroke="#50c8ff"
          />
        </svg>
      )}
      <span className="absolute top-1.5 left-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[11px] text-white">
        frame 0 · clip not loaded
      </span>
    </div>
  );
}

function Transport(props: {
  t: number;
  duration: number;
  onSeek: (t: number) => void;
  onToggle: (() => void) | undefined;
  playing: boolean;
}) {
  return (
    <div className="my-2 flex items-center gap-2.5">
      <Button size="sm" variant="outline" disabled={!props.onToggle} onClick={props.onToggle}>
        {props.playing ? "Pause" : "Play"}
      </Button>
      <input
        type="range"
        min={0}
        max={props.duration}
        step={1 / 15}
        value={props.t}
        onChange={(e) => props.onSeek(Number(e.target.value))}
        className="flex-1 accent-foreground"
      />
      <span className="w-24 text-right text-xs text-muted-foreground tabular-nums">
        {props.t.toFixed(1)} / {props.duration.toFixed(1)} s
      </span>
    </div>
  );
}

const laneColor = { pass: "bg-emerald-600", fail: "bg-orange-600", unsure: "bg-amber-500" };

function Lanes(props: { result: EpisodeResult; t: number; onFocus: (r: CriterionResult) => void }) {
  const d = props.result.episode.duration;
  const pct = (t: number) => `${Math.max(0, Math.min(100, (t / d) * 100))}%`;
  return (
    <div className="grid gap-[3px]">
      {props.result.results.map((r) => (
        <div
          key={r.criterion.id}
          onClick={() => props.onFocus(r)}
          className="grid cursor-pointer grid-cols-[170px_1fr] gap-2"
        >
          <span className="truncate text-xs text-muted-foreground">{r.criterion.primitive}</span>
          <div className="relative h-4 bg-muted">
            <div
              className={cn("absolute top-1.5 h-1 opacity-40", laneColor[r.status])}
              style={{
                left: pct(r.window[0]),
                width: `calc(${pct(r.window[1])} - ${pct(r.window[0])})`,
              }}
            />
            {r.moments.map((m) => (
              <div
                key={m.t}
                title={`${m.label} · ${m.t.toFixed(1)} s`}
                className={cn("absolute top-px h-3.5 w-[3px]", laneColor[r.status])}
                style={{ left: pct(m.t) }}
              />
            ))}
            <div className="absolute inset-y-0 w-px bg-foreground" style={{ left: pct(props.t) }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function ResultRow(props: {
  r: CriterionResult;
  open: boolean;
  onToggle: () => void;
  onSeek: (t: number) => void;
}) {
  const { r, open } = props;
  const phrase = phrases.find((p) => p.id === r.criterion.phraseId);
  return (
    <div className="border-t py-2.5">
      <div onClick={props.onToggle} className="flex cursor-pointer items-baseline gap-2">
        <StatusText status={r.status} className="w-14" />
        <span className="flex-1 text-sm">{r.criterion.primitive}</span>
        <span className="text-[11px] text-muted-foreground">
          {r.criterion.kind} · {r.criterion.hard ? "hard" : "soft"}
        </span>
      </div>
      <div className="ml-16 text-xs text-muted-foreground">
        {r.measurement}
        {r.signal && (
          <Badge variant="outline" className="ml-1.5 border-amber-500 text-amber-700">
            {r.signal}
          </Badge>
        )}
      </div>
      {open && (
        <div className="mt-2 ml-16 text-sm leading-snug">
          <div className="text-xs text-muted-foreground">“{phrase?.text}”</div>
          <div className="mt-1">{r.evidence}</div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {r.moments.map((m) => (
              <Button key={m.t} size="xs" variant="outline" onClick={() => props.onSeek(m.t)}>
                ▶ {m.label} {m.t.toFixed(1)} s
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
