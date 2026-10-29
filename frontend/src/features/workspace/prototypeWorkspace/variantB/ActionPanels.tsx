// PROTOTYPE (throwaway): Variant B contextual panels for the Workstation's actions/footer slots:
// review (unsure Phrases only), audit (good / bad naming a Phrase), override, Spark-alone contrast.
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type { EpisodeResult } from "../fixture/evaluate";
import { phrases } from "../fixture/rubric";
import type { Workspace } from "../fixture/useWorkspace";
import { TriageBadge } from "../shared/bits";
import { auditTally, wilson } from "./inbox";

const phraseText = (id: string) => phrases.find((p) => p.id === id)?.text ?? id;

function isTyping(e: KeyboardEvent) {
  return (e.target as HTMLElement | null)?.closest("input, textarea, [contenteditable]") != null;
}

export function ReviewPanel(props: { ws: Workspace; r: EpisodeResult; onNext: () => void }) {
  const unsure = props.r.phrases.filter((p) => p.status === "unsure" && !p.labelled);
  const [answers, setAnswers] = useState<Record<string, "pass" | "fail">>({});
  const focus = unsure.find((p) => !answers[p.phraseId]);
  const submit = () => {
    for (const [phraseId, value] of Object.entries(answers)) {
      props.ws.addLabel({ episodeId: props.r.episode.id, phraseId, value, source: "review" });
    }
    setAnswers({});
    props.onNext();
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e)) return;
      if (focus && (e.key === "1" || e.key === "2")) {
        setAnswers((a) => ({ ...a, [focus.phraseId]: e.key === "1" ? "pass" : "fail" }));
      }
      if (e.key === "Enter" && Object.keys(answers).length > 0) submit();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  return (
    <Panel title="Review" note="Answer only the unsure Phrases · 1 pass · 2 fail · Enter submits">
      {unsure.length === 0 && <p className="text-xs text-muted-foreground">Nothing unsure left.</p>}
      {unsure.map((p) => (
        <div
          key={p.phraseId}
          className={cn("rounded p-1.5", focus?.phraseId === p.phraseId && "bg-amber-50")}
        >
          <div className="text-sm">“{phraseText(p.phraseId)}”</div>
          <div className="mb-1 text-[11px] text-amber-700">{p.signals.join(" · ")}</div>
          <PassFail
            value={answers[p.phraseId]}
            onChange={(v) => setAnswers((a) => ({ ...a, [p.phraseId]: v }))}
          />
        </div>
      ))}
      <Button size="sm" className="mt-2 w-full" onClick={submit}>
        Submit &amp; next
      </Button>
    </Panel>
  );
}

export function AuditPanel(props: { ws: Workspace; r: EpisodeResult; onNext: () => void }) {
  const [bad, setBad] = useState(false);
  const { good, n } = auditTally(props.ws);
  const [lo, hi] = wilson(good, n);
  const id = props.r.episode.id;
  const audited = props.ws.labels.some((l) => l.episodeId === id && l.source === "audit");
  const checked = props.r.phrases.map((p) => p.phraseId);
  const markGood = () => {
    for (const phraseId of checked) {
      props.ws.addLabel({ episodeId: id, phraseId, value: "pass", source: "audit" });
    }
    props.onNext();
  };
  const markBad = (phraseId: string) => {
    props.ws.addLabel({ episodeId: id, phraseId, value: "fail", source: "audit" });
    setBad(false);
    props.onNext();
  };
  return (
    <Panel
      title="Audit this Keep"
      note={`Precision so far: ${good}/${n} good · 95% CI ${lo.toFixed(2)}–${hi.toFixed(2)}`}
    >
      {audited && <p className="text-xs text-muted-foreground">Already audited.</p>}
      <div className="flex gap-1.5">
        <Button size="sm" variant="outline" className="flex-1" onClick={markGood}>
          Good
        </Button>
        <Button size="sm" variant="outline" className="flex-1" onClick={() => setBad(!bad)}>
          Bad…
        </Button>
      </div>
      {bad && (
        <div className="mt-2 grid gap-1">
          <span className="text-[11px] text-muted-foreground">Which Phrase fails?</span>
          {checked.map((phraseId) => (
            <Button
              key={phraseId}
              size="xs"
              variant="ghost"
              className="justify-start"
              onClick={() => markBad(phraseId)}
            >
              “{phraseText(phraseId)}”
            </Button>
          ))}
        </div>
      )}
    </Panel>
  );
}

export function OverridePanel(props: { ws: Workspace; r: EpisodeResult }) {
  const [open, setOpen] = useState(false);
  const id = props.r.episode.id;
  return (
    <div className="mb-3">
      <Button size="xs" variant="ghost" onClick={() => setOpen(!open)}>
        {open ? "▾" : "▸"} Override a Phrase
      </Button>
      {open &&
        props.r.phrases.map((p) => (
          <div key={p.phraseId} className="mt-1.5 flex items-center gap-2">
            <span className="flex-1 truncate text-xs">“{phraseText(p.phraseId)}”</span>
            <PassFail
              value={p.labelled?.value}
              onChange={(value) =>
                props.ws.addLabel({ episodeId: id, phraseId: p.phraseId, value, source: "review" })
              }
            />
            {p.labelled && (
              <button
                className="text-[10px] text-muted-foreground underline"
                onClick={() => props.ws.removeLabel(id, p.phraseId)}
              >
                clear {p.labelled.source}
              </button>
            )}
          </div>
        ))}
    </div>
  );
}

function PassFail(props: {
  value: "pass" | "fail" | undefined;
  onChange: (v: "pass" | "fail") => void;
}) {
  return (
    <div className="flex gap-1">
      {(["pass", "fail"] as const).map((v) => (
        <Button
          key={v}
          size="xs"
          variant={props.value === v ? "default" : "outline"}
          className={cn(
            props.value === v && v === "pass" && "bg-emerald-600",
            props.value === v && v === "fail" && "bg-orange-600",
          )}
          onClick={() => props.onChange(v)}
        >
          {v === "pass" ? "Pass" : "Fail"}
        </Button>
      ))}
    </div>
  );
}

function Panel(props: { title: string; note: string; children: React.ReactNode }) {
  return (
    <div className="mb-4 rounded-md border border-dashed bg-muted/40 p-2.5">
      <div className="text-xs font-semibold">{props.title}</div>
      <div className="mb-2 text-[11px] text-muted-foreground">{props.note}</div>
      {props.children}
    </div>
  );
}

export function SparkFooter(props: { r: EpisodeResult }) {
  const { r } = props;
  const s = r.episode.spark;
  const winnowFails = r.phrases.filter((p) => p.status === "fail").map((p) => p.phraseId);
  const disagrees = r.triage !== "Needs review" && s.decision !== r.triage;
  const wrongReason =
    r.triage === "Reject" &&
    s.decision === "Reject" &&
    s.failurePhrase !== null &&
    !winnowFails.includes(s.failurePhrase);
  let note: string | null = null;
  if (r.episode.index === 42 && r.episode.source === "droid_100") {
    note =
      "Robot data contradicts “lifted empty”: the gripper held at 0.59 for 2.8 s while rising 10 cm.";
  } else if (disagrees && r.triage === "Reject") {
    const first = r.results.find((x) => x.status === "fail" && x.crisp);
    if (first) note = `Winnow's evidence: ${first.criterion.primitive} = ${first.measurement}.`;
  } else if (wrongReason) {
    note = `Spark blames “${phraseText(s.failurePhrase!)}”; Winnow's Criterion results don't.`;
  }
  return (
    <div
      className={cn(
        "mt-3 rounded-md border p-2.5 text-xs",
        disagrees || wrongReason ? "border-violet-400 bg-violet-50" : "bg-muted/40",
      )}
    >
      <div className="flex items-center gap-1.5">
        <span className="font-semibold">Spark alone</span>
        <TriageBadge triage={s.decision} className="px-1.5 text-[10px]" />
        <span className="text-muted-foreground">{s.agree}/3 agree</span>
        {(disagrees || wrongReason) && (
          <span className="ml-auto font-medium text-violet-700">
            {disagrees ? "disagrees with Winnow" : "right decision, other reason"}
          </span>
        )}
      </div>
      <p className="mt-1">
        {s.reason}
        {s.t !== null && <span className="text-muted-foreground"> ({s.t.toFixed(1)} s)</span>}
      </p>
      {note && <p className="mt-1 text-violet-800">{note}</p>}
    </div>
  );
}
