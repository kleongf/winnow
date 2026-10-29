// One playhead drives the video, the plots and (later) the Criterion lanes. It is plain state:
// the <video> follows `playing` and each `seekTarget`, and reports its time back via `onTime`.
import { useCallback, useState } from "react";

export interface Playhead {
  t: number;
  playing: boolean;
  /** A new object per seek, so seeking to the same time twice still moves the video. */
  seekTarget: { t: number };
  seek: (t: number) => void;
  toggle: () => void;
  onTime: (t: number) => void;
  onEnded: () => void;
}

export function usePlayhead(duration: number, initialT = 0): Playhead {
  const clamp = useCallback((t: number) => Math.max(0, Math.min(duration, t)), [duration]);
  const [t, setT] = useState(() => clamp(initialT));
  const [playing, setPlaying] = useState(false);
  const [seekTarget, setSeekTarget] = useState(() => ({ t: clamp(initialT) }));

  const seek = useCallback(
    (next: number) => {
      setT(clamp(next));
      setSeekTarget({ t: clamp(next) });
    },
    [clamp],
  );
  const toggle = useCallback(() => {
    setPlaying((was) => !was);
  }, []);
  const onEnded = useCallback(() => {
    setPlaying(false);
  }, []);

  return { t, playing, seekTarget, seek, toggle, onTime: setT, onEnded };
}
