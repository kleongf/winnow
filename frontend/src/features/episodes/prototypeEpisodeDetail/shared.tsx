// PROTOTYPE (throwaway): playhead, video-with-SAM-box, and signal plot primitives shared by variants.
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";

import { duration, fps, sig, type Moment } from "./fixture";

export interface Playhead {
  t: number;
  playing: boolean;
  seek: (t: number) => void;
  toggle: () => void;
  register: (el: HTMLVideoElement | null) => (() => void) | undefined;
}

export function usePlayhead(): Playhead {
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const videos = useRef(new Set<HTMLVideoElement>());

  const register = useCallback((el: HTMLVideoElement | null) => {
    if (!el) return undefined;
    videos.current.add(el);
    return () => {
      videos.current.delete(el);
    };
  }, []);

  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    const tick = () => {
      const [master, ...rest] = [...videos.current];
      if (master) {
        const now = master.currentTime;
        setT(now);
        for (const v of rest) if (Math.abs(v.currentTime - now) > 0.15) v.currentTime = now;
        if (master.ended || now >= duration - 0.05) {
          setPlaying(false);
          return;
        }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing]);

  const seek = useCallback((next: number) => {
    const clamped = Math.max(0, Math.min(duration, next));
    for (const v of videos.current) v.currentTime = clamped;
    setT(clamped);
  }, []);

  const toggle = useCallback(() => {
    setPlaying((was) => {
      for (const v of videos.current) {
        if (was) v.pause();
        else void v.play();
      }
      return !was;
    });
  }, []);

  return { t, playing, seek, toggle, register };
}

export function VideoWithBox(props: {
  src: string;
  playhead: Playhead;
  showBox?: boolean;
  label?: string;
  style?: CSSProperties;
}) {
  const { src, playhead, showBox = false, label, style } = props;
  const box = sig.objectBoxes[Math.min(sig.objectBoxes.length - 1, Math.round(playhead.t * fps))];
  return (
    <div style={{ position: "relative", background: "#000", lineHeight: 0, ...style }}>
      <video
        ref={playhead.register}
        src={src}
        muted
        playsInline
        preload="auto"
        onLoadedMetadata={(e) => {
          e.currentTarget.currentTime = playhead.t;
          if (playhead.playing) void e.currentTarget.play();
        }}
        style={{ width: "100%", aspectRatio: "16 / 9", display: "block" }}
      />
      {showBox && box && (
        <svg
          viewBox="0 0 320 180"
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
        >
          <rect
            x={box[1]}
            y={box[2]}
            width={box[3] - box[1]}
            height={box[4] - box[2]}
            fill="rgba(80,200,255,0.18)"
            stroke="#50c8ff"
            strokeWidth={1}
          />
          <text x={box[1]} y={box[2] - 3} fill="#50c8ff" fontSize={8} fontFamily="monospace">
            remote {box[5].toFixed(2)}
          </text>
        </svg>
      )}
      {label && (
        <span
          style={{
            position: "absolute",
            left: 6,
            top: 6,
            font: "11px/1 system-ui",
            color: "#fff",
            background: "rgba(0,0,0,0.55)",
            padding: "3px 6px",
            borderRadius: 3,
          }}
        >
          {label}
        </span>
      )}
    </div>
  );
}

export type SignalKey = "gripper" | "z" | "speed" | "objectY";

const signalMeta: Record<SignalKey, { label: string; domain: [number, number]; invert?: boolean }> =
  {
    gripper: { label: "Gripper (0 open, 1 closed)", domain: [0, 1] },
    z: { label: "End-effector height z (m)", domain: [-0.05, 0.42] },
    speed: { label: "End-effector speed (m/s)", domain: [0, 0.3] },
    objectY: { label: "Remote box centre y (px, up is up)", domain: [110, 160], invert: true },
  };

export function SignalPlot(props: {
  signal: SignalKey;
  playhead: Playhead;
  window?: [number, number];
  height?: number;
  threshold?: number | undefined;
  markers?: (Moment & { color?: string; dashed?: boolean })[];
  color?: string;
  dark?: boolean;
  showLabel?: boolean;
}) {
  const { signal, playhead, window = [0, duration], height = 70, threshold, markers = [] } = props;
  const { color = "#7aa2ff", dark = false, showLabel = true } = props;
  const meta = signalMeta[signal];
  const [t0, t1] = window;
  const values = sig[signal];
  const x = (t: number) => ((t - t0) / (t1 - t0)) * 1000;
  const yRaw = (v: number) => (v - meta.domain[0]) / (meta.domain[1] - meta.domain[0]);
  const y = (v: number) => height - (meta.invert ? 1 - yRaw(v) : yRaw(v)) * (height - 4) - 2;
  const points = sig.t
    .map((t, i) => [t, values[i] ?? 0] as const)
    .filter(([t]) => t >= t0 && t <= t1)
    .map(([t, v]) => `${x(t).toFixed(1)},${y(v).toFixed(1)}`)
    .join(" ");
  const ink = dark ? "#9aa3b2" : "#666";
  const onClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    playhead.seek(t0 + ((e.clientX - r.left) / r.width) * (t1 - t0));
  };
  return (
    <div style={{ position: "relative" }}>
      {showLabel && (
        <div style={{ font: "11px system-ui", color: ink, marginBottom: 2 }}>{meta.label}</div>
      )}
      <svg
        viewBox={`0 0 1000 ${height}`}
        preserveAspectRatio="none"
        onClick={onClick}
        style={{ width: "100%", height, display: "block", cursor: "crosshair" }}
      >
        <rect width={1000} height={height} fill={dark ? "#141821" : "#f6f6f4"} />
        {threshold !== undefined && (
          <line
            x1={0}
            x2={1000}
            y1={y(threshold)}
            y2={y(threshold)}
            stroke={ink}
            strokeDasharray="4 4"
            vectorEffect="non-scaling-stroke"
          />
        )}
        {markers.map((m) => (
          <line
            key={`${m.t}-${m.label}`}
            x1={x(m.t)}
            x2={x(m.t)}
            y1={0}
            y2={height}
            stroke={m.color ?? "#d9480f"}
            strokeWidth={2}
            strokeDasharray={m.dashed ? "3 3" : undefined}
            vectorEffect="non-scaling-stroke"
          />
        ))}
        <polyline
          points={points}
          fill="none"
          stroke={color}
          strokeWidth={1.75}
          vectorEffect="non-scaling-stroke"
        />
        {playhead.t >= t0 && playhead.t <= t1 && (
          <line
            x1={x(playhead.t)}
            x2={x(playhead.t)}
            y1={0}
            y2={height}
            stroke={dark ? "#fff" : "#111"}
            vectorEffect="non-scaling-stroke"
          />
        )}
      </svg>
    </div>
  );
}
