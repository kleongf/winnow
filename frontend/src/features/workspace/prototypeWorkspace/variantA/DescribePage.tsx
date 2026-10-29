// PROTOTYPE (throwaway): Variant A "Describe": interview thread on the left, the live Rubric on the
// right. Every number on this page comes from the anchor pool, never the whole Dataset.
import { AlertTriangle, Play } from "lucide-react";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { assumptionCount } from "../fixture/rubric";
import type { Workspace } from "../fixture/useWorkspace";
import type { InterviewTurn, Project } from "../fixture/workspace";
import { Interview } from "./Interview";
import { RubricPanel } from "./RubricPanel";

export function DescribePage(props: { ws: Workspace; project: Project }) {
  const { ws, project } = props;
  const [version, setVersion] = useState(String(ws.rubric.version));
  const [flash, setFlash] = useState<string | null>(null);
  const [ran, setRan] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  const anchor = ws.results.filter((r) => ws.anchorIds.has(r.episode.id));
  const open = assumptionCount(ws.rubric);

  const onAnswer = (t: InterviewTurn) => {
    const key = t.target?.criterionId ?? t.target?.setting ?? null;
    setFlash(key);
    if (key)
      document
        .getElementById(`crit-${key}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      setFlash(null);
    }, 1800);
  };

  return (
    <div>
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b bg-background/95 px-8 py-3 backdrop-blur">
        <div>
          <div className="text-xs text-muted-foreground">{project.name} · Describe</div>
          <div className="text-xs text-muted-foreground">
            Anchor pool:{" "}
            <span className="font-medium text-foreground">{project.anchorPool.kind}</span> ·{" "}
            {anchor.length} Episodes
            {project.heldOut &&
              ` · ${String(project.heldOut.episodeIds.length)} Test set Episodes hidden`}
          </div>
        </div>
        <Select value={version} onValueChange={setVersion}>
          <SelectTrigger size="sm" className="ml-auto w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {project.rubricVersions.map((v) => (
              <SelectItem key={v.version} value={String(v.version)}>
                Rubric v{v.version} {v.draft ? "(draft)" : `· ${v.note}`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          size="sm"
          onClick={() => {
            setRan(true);
          }}
        >
          <Play className="size-3.5" /> Run v{ws.rubric.version}
          {open > 0 && (
            <span className="ml-1 flex items-center gap-1 rounded bg-amber-400 px-1.5 text-[11px] text-black">
              <AlertTriangle className="size-3" />
              {open} assumption{open === 1 ? "" : "s"} unconfirmed
            </span>
          )}
        </Button>
      </header>
      {ran && (
        <div className="mx-8 mt-3 rounded border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
          Rubric v{ws.rubric.version} frozen and running on all {ws.results.length} Episodes (from
          cache where possible). Results land on the Episodes page.
        </div>
      )}
      <div className="grid grid-cols-[minmax(0,5fr)_minmax(0,6fr)] gap-8 px-8 py-5">
        <div className="sticky top-20 self-start">
          <Interview ws={ws} onAnswer={onAnswer} />
        </div>
        <RubricPanel ws={ws} anchor={anchor} flash={flash} />
      </div>
    </div>
  );
}
