// PROTOTYPE (throwaway): Variant B, "Reason-first report". Reads like a document: the Triage
// decision and Reason lead, with clickable moments. Each Criterion result is its own section with
// the plot zoomed in on its Evidence. A small sticky player follows every click. No global timeline.
import {
  cameras,
  episode,
  fmt,
  results,
  sparkAlone,
  statusColor,
  triageColor,
  type CriterionResult,
} from "./fixture";
import { SignalPlot, VideoWithBox, usePlayhead, type Playhead } from "./shared";

export const name = "Reason-first report";

const serif = "Georgia, 'Times New Roman', serif";

export function VariantB() {
  const playhead = usePlayhead();
  const go = (t: number) => playhead.seek(Math.max(0, t - 0.5));
  const ordered = [...results].sort((a, b) => rank(a) - rank(b));

  return (
    <div style={{ background: "#fbfaf7", color: "#1d1d1b", minHeight: "100vh" }}>
      <div
        style={{
          maxWidth: 1080,
          margin: "0 auto",
          padding: "32px 24px 80px",
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) 300px",
          gap: 32,
        }}
      >
        <main>
          <div style={{ font: "12px system-ui", color: "#77736a" }}>
            Episode {episode.index} · {episode.dataset} · "{episode.instruction}"
          </div>
          <h1
            style={{
              font: `600 44px/1.1 ${serif}`,
              color: triageColor[episode.triage],
              margin: "10px 0 12px",
            }}
          >
            {episode.triage}
          </h1>
          <p style={{ font: `22px/1.45 ${serif}`, margin: 0 }}>
            {episode.reasonParts.map((p, i) =>
              p.t === undefined ? (
                <span key={i}>{p.text}</span>
              ) : (
                <a
                  key={i}
                  onClick={() => go(p.t ?? 0)}
                  style={{
                    color: "inherit",
                    textDecoration: "underline",
                    textDecorationColor: triageColor[episode.triage],
                    textUnderlineOffset: 4,
                    cursor: "pointer",
                  }}
                >
                  {p.text}
                </a>
              ),
            )}
          </p>
          <Tally />
          {ordered.map((r, i) => (
            <Section key={r.id} n={i + 1} r={r} playhead={playhead} go={go} />
          ))}
          <SparkNote go={go} />
        </main>
        <aside>
          <div style={{ position: "sticky", top: 24, display: "grid", gap: 6 }}>
            <VideoWithBox
              src={cameras[0]!.src}
              playhead={playhead}
              showBox
              label="Exterior 1 · SAM"
            />
            <VideoWithBox src={cameras[2]!.src} playhead={playhead} label="Wrist" />
            <div style={{ display: "flex", gap: 8, alignItems: "center", font: "12px system-ui" }}>
              <button onClick={playhead.toggle}>{playhead.playing ? "Pause" : "Play"}</button>
              <span style={{ fontVariantNumeric: "tabular-nums" }}>{fmt(playhead.t)}</span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function rank(r: CriterionResult): number {
  return { fail: 0, unsure: 1, pass: 2 }[r.status] + (r.hard ? 0 : 3);
}

function Tally() {
  const count = (s: string) => results.filter((r) => r.status === s).length;
  return (
    <div style={{ font: "13px system-ui", color: "#77736a", margin: "18px 0 8px" }}>
      {count("fail")} failed · {count("unsure")} unsure · {count("pass")} passed, against the
      Rubric: <em>{episode.rubricDescription}</em>
    </div>
  );
}

function Section(props: {
  n: number;
  r: CriterionResult;
  playhead: Playhead;
  go: (t: number) => void;
}) {
  const { n, r, playhead, go } = props;
  return (
    <section style={{ borderTop: "1px solid #e4e1d9", padding: "22px 0", marginTop: 8 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
        <span style={{ font: `14px ${serif}`, color: "#a39e92" }}>{n}.</span>
        <h2 style={{ font: `600 20px ${serif}`, margin: 0, flex: 1 }}>{r.name}</h2>
        <span
          style={{
            font: "600 11px system-ui",
            color: "#fff",
            background: statusColor[r.status],
            padding: "3px 8px",
            borderRadius: 10,
          }}
        >
          {r.status}
        </span>
      </div>
      <div style={{ font: "12px system-ui", color: "#77736a", margin: "4px 0 10px 24px" }}>
        {r.hard ? "Hard" : "Soft"} · {r.kind} · {r.measurement}
      </div>
      <p style={{ font: `16px/1.5 ${serif}`, margin: "0 0 12px 24px" }}>{r.evidence}</p>
      {r.signal !== "none" && (
        <div style={{ marginLeft: 24 }}>
          <SignalPlot
            signal={r.signal}
            playhead={playhead}
            window={r.window}
            height={90}
            threshold={r.threshold}
            markers={r.moments.map((m) => ({ ...m, color: statusColor[r.status] }))}
            color="#3b5bdb"
          />
          <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
            {r.moments.map((m) => (
              <button key={m.t} onClick={() => go(m.t)} style={{ font: "12px system-ui" }}>
                {m.label} · {fmt(m.t)}
              </button>
            ))}
            <span style={{ font: "11px system-ui", color: "#a39e92", alignSelf: "center" }}>
              window {fmt(r.window[0])} to {fmt(r.window[1])}; click the plot to scrub
            </span>
          </div>
        </div>
      )}
    </section>
  );
}

function SparkNote({ go }: { go: (t: number) => void }) {
  return (
    <section
      style={{
        marginTop: 24,
        padding: 16,
        background: "#f1efe8",
        borderLeft: "3px solid #a39e92",
        font: `15px/1.5 ${serif}`,
      }}
    >
      <div style={{ font: "600 12px system-ui", color: "#77736a", marginBottom: 6 }}>
        WHAT SPARK ALONE WOULD HAVE SAID
      </div>
      <p style={{ margin: "0 0 8px" }}>
        <s>"{sparkAlone.reason}"</s>{" "}
        <a onClick={() => go(sparkAlone.failureT)} style={{ cursor: "pointer" }}>
          ({fmt(sparkAlone.failureT)})
        </a>
      </p>
      <p style={{ margin: 0 }}>{sparkAlone.contradiction}</p>
    </section>
  );
}
