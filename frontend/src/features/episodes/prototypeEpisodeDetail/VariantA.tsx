// PROTOTYPE (throwaway): Variant A, "Workstation". One big video, a lane per Criterion on a
// shared timeline under it, robot-data plots on the same x axis, results list on the right.
import { useState } from "react";

import {
  cameras,
  duration,
  episode,
  fmt,
  results,
  statusColor,
  triageColor,
  type CameraId,
  type CriterionResult,
} from "./fixture";
import { SignalPlot, VideoWithBox, usePlayhead, type Playhead } from "./shared";

export const name = "Workstation";

const bg = "#0e1117";
const panel = "#161b24";
const ink = "#e6e9ef";
const dim = "#8b93a3";

export function VariantA() {
  const playhead = usePlayhead();
  const [camera, setCamera] = useState<CameraId>("exterior_image_1_left");
  const [open, setOpen] = useState<string | null>("first-grasp");
  const cam = cameras.find((c) => c.id === camera) ?? cameras[0]!;

  const focus = (r: CriterionResult) => {
    setOpen(r.id);
    setCamera(r.camera);
    const first = r.moments[0];
    if (first) playhead.seek(first.t - 0.5);
  };

  return (
    <div style={{ background: bg, color: ink, minHeight: "100vh", font: "13px system-ui" }}>
      <header style={{ display: "flex", gap: 16, alignItems: "baseline", padding: "12px 20px" }}>
        <strong style={{ fontSize: 15 }}>Episode {episode.index}</strong>
        <span style={{ color: dim }}>{episode.dataset}</span>
        <span style={{ color: dim }}>"{episode.instruction}"</span>
      </header>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 380px", gap: 16 }}>
        <section style={{ padding: "0 0 24px 20px" }}>
          <div style={{ display: "flex", gap: 4, marginBottom: 6 }}>
            {cameras.map((c) => (
              <button key={c.id} onClick={() => setCamera(c.id)} style={tab(c.id === camera)}>
                {c.label}
                {c.id === "exterior_image_1_left" ? " · SAM" : ""}
              </button>
            ))}
          </div>
          <VideoWithBox
            key={cam.id}
            src={cam.src}
            playhead={playhead}
            showBox={cam.id === "exterior_image_1_left"}
          />
          <Transport playhead={playhead} />
          <Lanes playhead={playhead} onFocus={focus} />
          <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
            <SignalPlot signal="gripper" playhead={playhead} threshold={0.5} dark color="#ffb454" />
            <SignalPlot signal="z" playhead={playhead} dark color="#7aa2ff" />
            <SignalPlot signal="speed" playhead={playhead} threshold={0.02} dark color="#9be28f" />
          </div>
        </section>
        <aside style={{ background: panel, padding: 16, borderLeft: "1px solid #232a36" }}>
          <div
            style={{
              display: "inline-block",
              background: triageColor[episode.triage],
              color: "#fff",
              padding: "4px 10px",
              borderRadius: 4,
              fontWeight: 600,
            }}
          >
            {episode.triage}
          </div>
          <p style={{ fontSize: 15, lineHeight: 1.45, margin: "10px 0 18px" }}>{episode.reason}</p>
          <div style={{ color: dim, fontSize: 11, textTransform: "uppercase", marginBottom: 6 }}>
            Criterion results
          </div>
          {results.map((r) => (
            <ResultRow
              key={r.id}
              r={r}
              open={open === r.id}
              onToggle={() => setOpen(open === r.id ? null : r.id)}
              onSeek={(t) => {
                setCamera(r.camera);
                playhead.seek(t - 0.5);
              }}
              onFocus={() => focus(r)}
            />
          ))}
        </aside>
      </div>
    </div>
  );
}

function tab(active: boolean): React.CSSProperties {
  return {
    background: active ? "#2a3242" : "transparent",
    color: active ? ink : dim,
    border: "1px solid #2a3242",
    borderRadius: 4,
    padding: "4px 10px",
    cursor: "pointer",
  };
}

function Transport({ playhead }: { playhead: Playhead }) {
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "center", margin: "8px 0" }}>
      <button onClick={playhead.toggle} style={tab(true)}>
        {playhead.playing ? "Pause" : "Play"}
      </button>
      <input
        type="range"
        min={0}
        max={duration}
        step={1 / 15}
        value={playhead.t}
        onChange={(e) => playhead.seek(Number(e.target.value))}
        style={{ flex: 1 }}
      />
      <span style={{ fontVariantNumeric: "tabular-nums", color: dim, width: 90 }}>
        {fmt(playhead.t)} / {fmt(duration)}
      </span>
    </div>
  );
}

function Lanes(props: { playhead: Playhead; onFocus: (r: CriterionResult) => void }) {
  const pct = (t: number) => `${(t / duration) * 100}%`;
  return (
    <div style={{ display: "grid", gap: 3 }}>
      {results.map((r) => (
        <div
          key={r.id}
          onClick={() => props.onFocus(r)}
          style={{ display: "grid", gridTemplateColumns: "190px 1fr", gap: 8, cursor: "pointer" }}
        >
          <span style={{ color: dim, whiteSpace: "nowrap", overflow: "hidden", fontSize: 12 }}>
            {r.hard ? "" : "(soft) "}
            {r.name}
          </span>
          <div style={{ position: "relative", height: 16, background: "#1b212c" }}>
            <div
              style={{
                position: "absolute",
                left: pct(r.window[0]),
                width: pct(r.window[1] - r.window[0]),
                top: 6,
                height: 4,
                background: statusColor[r.status],
                opacity: 0.35,
              }}
            />
            {r.moments.map((m) => (
              <div
                key={m.t}
                title={`${m.label} · ${fmt(m.t)}`}
                style={{
                  position: "absolute",
                  left: pct(m.t),
                  top: 1,
                  width: 3,
                  height: 14,
                  background: statusColor[r.status],
                }}
              />
            ))}
            <div
              style={{
                position: "absolute",
                left: pct(props.playhead.t),
                top: 0,
                bottom: 0,
                width: 1,
                background: "#fff",
              }}
            />
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
  onFocus: () => void;
}) {
  const { r, open } = props;
  return (
    <div style={{ borderTop: "1px solid #232a36", padding: "10px 0" }}>
      <div onClick={props.onToggle} style={{ display: "flex", gap: 8, cursor: "pointer" }}>
        <span style={{ color: statusColor[r.status], fontWeight: 700, width: 52 }}>
          {r.status.toUpperCase()}
        </span>
        <span style={{ flex: 1 }}>{r.name}</span>
        <span style={{ color: dim, fontSize: 11 }}>
          {r.kind} · {r.hard ? "hard" : "soft"}
        </span>
      </div>
      <div style={{ color: dim, marginLeft: 60, marginTop: 2 }}>{r.measurement}</div>
      {open && (
        <div style={{ marginLeft: 60, marginTop: 8, lineHeight: 1.45 }}>
          <div>{r.evidence}</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
            {r.moments.map((m) => (
              <button key={m.t} onClick={() => props.onSeek(m.t)} style={tab(false)}>
                ▶ {m.label} {fmt(m.t)}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
