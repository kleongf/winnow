// PROTOTYPE (throwaway): Variant C evaluation report. The table numbers are INVENTED placeholders
// in the shape the `evaluation` module will produce; the live counts at the top are computed.
import type { Workspace } from "../fixture/useWorkspace";
import { evaluationReport } from "../fixture/workspace";
import { auditSample, sparkDisagrees, wilson } from "./model";

export function Report(props: { ws: Workspace }) {
  const { ws } = props;
  const test = ws.results.filter((r) => ws.heldOutIds.has(r.episode.id));
  const disagree = test.filter(sparkDisagrees).length;
  const audit = auditSample(ws.results);
  const audited = ws.results.filter(
    (r) => audit.has(r.episode.id) && r.phrases.some((p) => p.labelled?.source === "audit"),
  );
  const good = audited.filter((r) => r.phrases.every((p) => p.labelled?.value !== "fail")).length;
  const [lo, hi] = wilson(good, audited.length);
  const rep = evaluationReport;

  return (
    <div className="mx-auto max-w-5xl px-6 py-6 text-sm">
      <h2 className="text-lg font-semibold">
        Evaluation · Rubric v{rep.rubricVersion} on the Test set
      </h2>
      <div className="mt-3 grid grid-cols-3 gap-3">
        <Stat label="Test set Episodes in this Dataset" value={`${test.length}`} />
        <Stat
          label="Spark alone disagrees with Winnow (live)"
          value={`${disagree} of ${test.length}`}
        />
        <Stat
          label="Audit precision (live)"
          value={audited.length ? `${good}/${audited.length} good` : "no audit labels yet"}
          sub={
            audited.length
              ? `95% CI ${lo.toFixed(2)}–${hi.toFixed(2)} (Wilson)`
              : `sample of ${audit.size} auto-Keeps`
          }
        />
      </div>

      <div className="mt-6 rounded border border-amber-400 bg-amber-50 px-3 py-2 text-xs text-amber-900">
        Placeholder numbers, invented for the prototype. They show the shape of the report, not
        results.
      </div>

      <h3 className="mt-4 font-medium">
        Winnow vs baselines · {rep.testSet} Episodes, {rep.descriptionFailures} description failures
      </h3>
      <Table
        head={["System", "False keeps", "95% CI", "Right reason", "Coverage", "False rejects"]}
        rows={rep.rows.map((r) => [
          r.system,
          r.falseKeeps,
          r.falseKeepsCI,
          r.rightReason,
          r.coverage,
          r.falseRejects,
        ])}
      />

      <h3 className="mt-6 font-medium">Source ablation (re-scored from the cache, $0)</h3>
      <Table
        head={["Sources", "False keeps", "Right reason", "Coverage"]}
        rows={rep.ablation.map((r) => [r.sources, r.falseKeeps, r.rightReason, r.coverage])}
      />
    </div>
  );
}

function Stat(props: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-md border p-3">
      <div className="text-xs text-muted-foreground">{props.label}</div>
      <div className="mt-1 font-mono text-xl">{props.value}</div>
      {props.sub && <div className="font-mono text-[11px] text-muted-foreground">{props.sub}</div>}
    </div>
  );
}

function Table(props: { head: string[]; rows: string[][] }) {
  return (
    <table className="mt-2 w-full border-collapse text-xs">
      <thead>
        <tr>
          {props.head.map((h) => (
            <th
              key={h}
              className="border-b px-2 py-1.5 text-left font-medium text-muted-foreground"
            >
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {props.rows.map((row) => (
          <tr key={row[0]}>
            {row.map((c, i) => (
              <td
                key={i}
                className={i === 0 ? "border-b px-2 py-1.5" : "border-b px-2 py-1.5 font-mono"}
              >
                {c}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
