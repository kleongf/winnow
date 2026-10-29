// The <video> under the playhead: it seeks on each seek request, plays and pauses with the
// playhead, and reports its time every frame while playing.
import { useEffect, useRef } from "react";

import type { Playhead } from "./usePlayhead";

export function EpisodeVideo(props: { src: string; playhead: Playhead }) {
  const { t, playing, seekTarget, onTime, onEnded } = props.playhead;
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (ref.current) ref.current.currentTime = seekTarget.t;
  }, [seekTarget]);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    if (!playing) {
      video.pause();
      return;
    }
    if (video.ended) video.currentTime = 0;
    void video.play();
    let frame = requestAnimationFrame(function tick() {
      onTime(video.currentTime);
      frame = requestAnimationFrame(tick);
    });
    return () => {
      cancelAnimationFrame(frame);
    };
  }, [playing, onTime]);

  return (
    <video
      ref={ref}
      src={props.src}
      muted
      playsInline
      preload="auto"
      aria-label="Episode video"
      className="block aspect-video w-full rounded bg-black"
      onLoadedMetadata={(event) => {
        event.currentTarget.currentTime = t; // a new camera picks up where the last one was
      }}
      onEnded={onEnded}
    />
  );
}
