// SAM's box over the video, following the playhead. Positioned in percent of the frame, so it
// scales with the video, which keeps the clip's 16:9 aspect.
import type { Playhead } from "../episodes/usePlayhead";
import { boxAt } from "./trackBoxes";
import type { Track } from "./useTracks";

export function TrackOverlay(props: { track: Track; playhead: Playhead }) {
  const { track } = props;
  const box = boxAt(track, props.playhead.t);
  if (!box) return null;
  const percent = (value: number, of: number) => `${String((value / of) * 100)}%`;
  return (
    <div
      data-testid="track-box"
      aria-label={`${track.kind} track box`}
      className="pointer-events-none absolute rounded-sm border-2 border-amber-400 shadow-[0_0_0_1px_rgba(0,0,0,0.5)]"
      style={{
        left: percent(box.left, track.width),
        top: percent(box.top, track.height),
        width: percent(box.right - box.left, track.width),
        height: percent(box.bottom - box.top, track.height),
      }}
    />
  );
}
