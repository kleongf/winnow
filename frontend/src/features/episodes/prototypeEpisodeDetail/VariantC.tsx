// PROTOTYPE (throwaway): Variant C, "Triptych + event spine". All three cameras play in sync on
// top. One wide spine below carries robot events detected from the data, Criterion result pins,
// and Spark's claimed failure time. The bottom puts Spark's account against the robot data.
import {
  cameras,
  duration,
  episode,
  fmt,
  results,
  robotEvents,
  sparkAlone,
  statusColor,
  triageColor,
} from "./fixture";
import { SignalPlot, VideoWithBox, usePlayhead, type Playhead } from "./shared";

export const name = "Triptych + event spine";

const bg = "#101010";
const ink = "#ededed";
const dim = "#8a8a8a";

export function VariantC() {
  const playhead = usePlayhead();
  return (
    <div style={{ background: bg, color: ink, minHeight: "100vh", font: "13px system-ui" }}>
      <div style={{ padding: "14px 20px", display: "flex", alignItems: "center", gap: 14 }}>
        <span
          style={{
            border: `2px solid ${triageColor[episode.triage]}`,
            color: triageColor[episode.triage],
            padding: "3px 10px",
            fontWeight: 700,
            letterSpacing: 1,
            textTransform: "uppercase",
          }}
        >
          {episode.triage}
        </span>
        <span style={{ fontSize: 15, flex: 1 }}>{episode.reason}</span>
        <span style={{ color: dim }}>Ep {episode.index}</span>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 4,
          padding: "0 20px",
        }}
      >
        {cameras.map((c) => (
          <VideoWithBox
            key={c.id}
            src={c.src}
            playhead={playhead}
            showBox={c.id === "exterior_image_1_left"}
            label={c.label + (c.id === "exterior_image_1_left" ? " · SAM remote" : "")}
          />
        ))}
      </div>
      <div style={{ padding: "10px 20px 0" }}>
        <Spine playhead={playhead} />
        <div style={{ marginTop: 6 }}>
          <SignalPlot
            signal="gripper"
            playhead={playhead}
            threshold={0.5}
            dark
            height={44}
            color="#ffb454"
            markers={[{ t: sparkAlone.failureT, label: "Spark", color: "#c084fc", dashed: true }]}
          />
          <SignalPlot
            signal="z"
            playhead={playhead}
            dark
            height={44}
            color="#7aa2ff"
            markers={[{ t: sparkAlone.failureT, label: "Spark", color: "#c084fc", dashed: true }]}
          />
        </div>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 20,
          padding: "16px 20px 32px",
        }}
      >
        <Disagreement playhead={playhead} />
        <Matrix playhead={playhead} />
      </div>
    </div>
  );
}

function Spine({ playhead }: { playhead: Playhead }) {
  const pct = (t: number) => `${(t / duration) * 100}%`;
  const seekTo = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    playhead.seek(((e.clientX - r.left) / r.width) * duration);
  };
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "stretch" }}>
      <button onClick={playhead.toggle} style={{ width: 64 }}>
        {playhead.playing ? "Pause" : "Play"}
      </button>
      <div
        onClick={seekTo}
        style={{
          position: "relative",
          flex: 1,
          height: 74,
          background: "#1a1a1a",
          cursor: "pointer",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 36,
            height: 2,
            background: "#333",
          }}
        />
        {robotEvents.map((ev, i) => (
          <div key={ev.t} style={{ position: "absolute", left: pct(ev.t), top: i % 2 ? 4 : 16 }}>
            <div
              style={{
                fontSize: 10,
                color: dim,
                whiteSpace: "nowrap",
                transform: "translateX(-50%)",
              }}
            >
              {ev.label}
            </div>
          </div>
        ))}
        {robotEvents.map((ev) => (
          <div
            key={`d${ev.t}`}
            style={{
              position: "absolute",
              left: pct(ev.t),
              top: 31,
              width: 2,
              height: 12,
              background: "#bbb",
            }}
          />
        ))}
        {results.flatMap((r) =>
          r.moments.map((m) => (
            <div
              key={`${r.id}${m.t}`}
              title={`${r.name}: ${r.status}`}
              style={{
                position: "absolute",
                left: pct(m.t),
                top: 48,
                transform: "translateX(-50%)",
                width: 10,
                height: 10,
                borderRadius: 5,
                background: statusColor[r.status],
              }}
            />
          )),
        )}
        <div
          style={{
            position: "absolute",
            left: pct(sparkAlone.failureT),
            top: 0,
            bottom: 0,
            borderLeft: "2px dashed #c084fc",
          }}
        >
          <span
            style={{ position: "absolute", bottom: 2, left: 4, fontSize: 10, color: "#c084fc" }}
          >
            Spark: "lifted empty"
          </span>
        </div>
        <div
          style={{
            position: "absolute",
            left: pct(playhead.t),
            top: 0,
            bottom: 0,
            width: 1,
            background: "#fff",
          }}
        />
      </div>
      <span
        style={{ width: 54, color: dim, fontVariantNumeric: "tabular-nums", alignSelf: "center" }}
      >
        {fmt(playhead.t)}
      </span>
    </div>
  );
}

function Disagreement({ playhead }: { playhead: Playhead }) {
  return (
    <div style={{ border: "1px solid #2a2a2a", padding: 14 }}>
      <div style={{ color: dim, fontSize: 11, textTransform: "uppercase", marginBottom: 10 }}>
        Video and robot data disagree at {fmt(sparkAlone.failureT)}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, lineHeight: 1.45 }}>
        <div>
          <div style={{ color: "#c084fc", fontWeight: 600, marginBottom: 4 }}>
            Spark alone (video)
          </div>
          <div>"{sparkAlone.reason}"</div>
        </div>
        <div>
          <div style={{ color: "#7aa2ff", fontWeight: 600, marginBottom: 4 }}>
            Robot data + SAM track
          </div>
          <div>{sparkAlone.contradiction}</div>
        </div>
      </div>
      <button onClick={() => playhead.seek(16)} style={{ marginTop: 12 }}>
        Watch the lift, 16.0 to 18.5 s
      </button>
    </div>
  );
}

function Matrix({ playhead }: { playhead: Playhead }) {
  return (
    <table style={{ width: "100%", borderCollapse: "collapse" }}>
      <thead>
        <tr style={{ color: dim, fontSize: 11, textAlign: "left" }}>
          <th style={{ padding: 6 }}>Criterion</th>
          <th>Kind</th>
          <th>Result</th>
          <th>Measured</th>
        </tr>
      </thead>
      <tbody>
        {results.map((r) => (
          <tr
            key={r.id}
            onClick={() => r.moments[0] && playhead.seek(r.moments[0].t - 0.5)}
            title={r.evidence}
            style={{ borderTop: "1px solid #2a2a2a", cursor: "pointer" }}
          >
            <td style={{ padding: 6 }}>
              {r.name}
              {r.hard ? "" : <span style={{ color: dim }}> (soft)</span>}
            </td>
            <td style={{ color: dim }}>{r.kind}</td>
            <td style={{ color: statusColor[r.status], fontWeight: 700 }}>{r.status}</td>
            <td style={{ color: dim }}>{r.measurement}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
