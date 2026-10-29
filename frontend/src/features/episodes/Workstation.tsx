// The Workstation (#8, Variant A): one large video with camera tabs, one playhead driving the
// video and the robot-data plots, and a right panel. Review and Reference label mode put their
// controls in `actions`; Criterion lanes and results arrive with scoring. `blind` (Reference
// label mode) hides every Winnow and baseline output, tracks included.
import { useEffect, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";

import { SET_LABELS, setsByEpisode, useSets } from "../sets/useSets";
import { TrackOverlay } from "../tracking/TrackOverlay";
import { TrackStatus } from "../tracking/TrackStatus";
import { useTracks, type Track } from "../tracking/useTracks";
import { EpisodeVideo } from "./EpisodeVideo";
import { SignalPlots } from "./SignalPlots";
import { clipUrl, useSignals, type Episode } from "./useEpisodes";
import { usePlayhead, type Playhead } from "./usePlayhead";

const CAMERA_LABELS: Record<string, string> = {
  exterior_image_1_left: "Exterior 1",
  exterior_image_2_left: "Exterior 2",
  wrist_image_left: "Wrist",
};

export function Workstation(props: {
  episode: Episode;
  initialT?: number;
  actions?: Actions;
  blind?: boolean;
}) {
  const { episode } = props;
  const playhead = usePlayhead(episode.duration_s, props.initialT);
  const [camera, setCamera] = useState(episode.cameras[0] ?? null);
  const signals = useSignals(episode.id);
  const set = setsByEpisode(useSets().data).get(episode.id);
  const tracks = useShownTracks(episode.id, props.blind ?? false);
  const shownTrack = tracks.find((t) => t.camera === camera && t.status === "tracked");
  const { toggle } = playhead;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const typing =
        event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement;
      if (event.key !== " " || typing) return;
      event.preventDefault();
      toggle();
    };
    globalThis.addEventListener("keydown", onKey);
    return () => {
      globalThis.removeEventListener("keydown", onKey);
    };
  }, [toggle]);

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_340px] gap-4">
      <section className="min-w-0">
        <div className="mb-1.5 flex items-center gap-1" role="tablist" aria-label="Camera">
          {episode.cameras.map((c) => (
            <Button
              key={c}
              size="sm"
              role="tab"
              aria-selected={c === camera}
              variant={c === camera ? "secondary" : "ghost"}
              onClick={() => {
                setCamera(c);
              }}
            >
              {CAMERA_LABELS[c] ?? c}
            </Button>
          ))}
          <span className="ml-auto text-xs text-muted-foreground">
            {episode.source} · Episode {episode.index} · {episode.duration_s.toFixed(1)} s
          </span>
        </div>
        {camera ? (
          <div className="relative">
            <EpisodeVideo key={camera} src={clipUrl(episode.id, camera)} playhead={playhead} />
            {shownTrack && <TrackOverlay track={shownTrack} playhead={playhead} />}
          </div>
        ) : (
          <div className="grid aspect-video w-full place-items-center rounded bg-black text-sm text-white/60">
            No clips for this Episode
          </div>
        )}
        <Transport playhead={playhead} duration={episode.duration_s} canPlay={camera !== null} />
        {signals.data && (
          <SignalPlots signals={signals.data} playhead={playhead} duration={episode.duration_s} />
        )}
      </section>
      <aside className="min-w-0 rounded-lg border bg-card p-4">
        {renderActions(props.actions, playhead)}
        <div className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
          Instruction
        </div>
        <p className="mt-1 text-[15px] leading-snug">
          {episode.instruction ?? <span className="text-muted-foreground">None recorded</span>}
        </p>
        <dl className="mt-4 grid grid-cols-2 gap-y-1 text-xs">
          <dt className="text-muted-foreground">Frames</dt>
          <dd className="tabular-nums">
            {episode.frames} at {episode.fps} Hz
          </dd>
          <dt className="text-muted-foreground">Source</dt>
          <dd>{episode.source}</dd>
          <dt className="text-muted-foreground">Set</dt>
          <dd data-testid="episode-set">{set ? SET_LABELS[set] : "None"}</dd>
          {tracks.map((track) => (
            <TrackStatus key={track.kind} track={track} />
          ))}
        </dl>
        {!props.blind && (
          <p className="mt-6 text-xs text-muted-foreground">
            The Triage decision, Reason and Criterion results appear here once the Episode is
            scored.
          </p>
        )}
      </aside>
    </div>
  );
}

type Actions = ReactNode | ((playhead: Playhead) => ReactNode);

function renderActions(actions: Actions, playhead: Playhead): ReactNode {
  return typeof actions === "function" ? actions(playhead) : actions;
}

/** None while blind: tracks are what tracked Criteria read. */
function useShownTracks(episodeId: string, blind: boolean): Track[] {
  const fetched = useTracks(episodeId, !blind).data; // cached data outlives `enabled: false`
  return blind ? [] : (fetched ?? []);
}

function Transport(props: { playhead: Playhead; duration: number; canPlay: boolean }) {
  const { playhead } = props;
  return (
    <div className="my-2 flex items-center gap-2.5">
      <Button size="sm" variant="outline" disabled={!props.canPlay} onClick={playhead.toggle}>
        {playhead.playing ? "Pause" : "Play"}
      </Button>
      <input
        type="range"
        aria-label="Playhead"
        min={0}
        max={props.duration}
        step={1 / 15}
        value={playhead.t}
        onChange={(event) => {
          playhead.seek(Number(event.target.value));
        }}
        className="flex-1 accent-foreground"
      />
      <span className="w-24 text-right text-xs text-muted-foreground tabular-nums">
        {playhead.t.toFixed(1)} / {props.duration.toFixed(1)} s
      </span>
    </div>
  );
}
