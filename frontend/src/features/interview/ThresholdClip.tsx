// The anchor Episode's clip trimmed to the stretch the Criterion measured, looping, with the
// measured value labelled on it.
import { clipUrl } from "../episodes/useEpisodes";
import type { ThresholdQuestion } from "./useInterview";

export function ThresholdClip(props: { question: ThresholdQuestion }) {
  const { episode_id: episodeId, camera, clip, measurement } = props.question;
  if (!camera) return null;
  const src = `${clipUrl(episodeId, camera)}#t=${String(clip.start)},${String(clip.end)}`;
  return (
    <div className="relative mt-2">
      <video
        key={src}
        src={src}
        aria-label="Episode clip"
        muted
        autoPlay
        playsInline
        preload="auto"
        className="block aspect-video max-h-44 w-full rounded bg-black object-contain"
        onTimeUpdate={(event) => {
          const video = event.currentTarget;
          if (video.currentTime >= clip.end) {
            video.currentTime = clip.start;
            void video.play();
          }
        }}
        onEnded={(event) => {
          event.currentTarget.currentTime = clip.start;
          void event.currentTarget.play();
        }}
      />
      <span
        className="absolute top-2 left-2 rounded bg-black/70 px-1.5 py-0.5 text-xs font-semibold text-white tabular-nums"
        data-testid="clip-value"
      >
        {measurement}
      </span>
      <span className="absolute right-2 bottom-2 rounded bg-black/70 px-1.5 py-0.5 text-[11px] text-white tabular-nums">
        {clip.start.toFixed(1)}–{clip.end.toFixed(1)} s
      </span>
    </div>
  );
}
