// PROTOTYPE (throwaway): Variant C top bar: Dataset ▸ Project, Rubric version, mode, Run, Report.
import { Play, Table2, FileBarChart } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

import { assumptionCount } from "../fixture/rubric";
import type { Workspace } from "../fixture/useWorkspace";
import { datasets, projects } from "../fixture/workspace";
import type { Mode } from "./model";

export function TopBar(props: {
  ws: Workspace;
  mode: Mode;
  setMode: (m: Mode) => void;
  view: "matrix" | "report";
  setView: (v: "matrix" | "report") => void;
}) {
  const { ws, mode } = props;
  const project = projects.find((p) => p.id === ws.projectId) ?? projects[0]!;
  const dataset = datasets.find((d) => d.id === project.datasetId) ?? datasets[0]!;
  const version = project.rubricVersions[project.rubricVersions.length - 1];
  const unconfirmed = assumptionCount(ws.rubric);
  const anchor = ws.results.filter((r) => ws.anchorIds.has(r.episode.id));
  const decided = ws.results.filter((r) => r.triage !== "Needs review").length;
  const review = ws.results.length - decided;

  return (
    <header className="flex h-12 items-center gap-3 border-b bg-background px-4 text-sm">
      <span className="font-semibold tracking-tight">Winnow</span>
      <span className="whitespace-nowrap text-muted-foreground" title="Dataset">
        {dataset.name}
      </span>
      <span className="text-muted-foreground">▸</span>
      <Select value={ws.projectId} onValueChange={ws.setProjectId}>
        <SelectTrigger size="sm" className="h-7 w-56">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {projects.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              {p.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <span className="font-mono text-xs whitespace-nowrap text-muted-foreground">
        Rubric v{version?.version}
        {version?.draft ? " (draft)" : ""}
      </span>

      <div className="ml-2 flex rounded-md border p-0.5">
        {(["describe", "results"] as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => {
              props.setMode(m);
              props.setView("matrix");
            }}
            className={cn(
              "rounded px-2.5 py-0.5 text-xs",
              mode === m && props.view === "matrix"
                ? "bg-foreground text-background"
                : "text-muted-foreground",
            )}
          >
            {m === "describe" ? "Describe" : "Results"}
          </button>
        ))}
      </div>

      <span className="font-mono text-xs whitespace-nowrap text-muted-foreground">
        {mode === "describe"
          ? `${anchor.length} anchor Episodes (${project.anchorPool.kind})`
          : `${decided} of ${ws.results.length} decided · ${review} Needs review`}
      </span>

      <div className="ml-auto flex items-center gap-2">
        <Button
          size="sm"
          variant={props.view === "report" ? "secondary" : "ghost"}
          onClick={() => props.setView(props.view === "report" ? "matrix" : "report")}
        >
          {props.view === "report" ? <Table2 /> : <FileBarChart />}
          {props.view === "report" ? "Matrix" : "Report"}
        </Button>
        <Button
          size="sm"
          onClick={() => {
            props.setMode("results");
            props.setView("matrix");
          }}
        >
          <Play />
          Run v{version?.version}
          {unconfirmed > 0 && (
            <span className="ml-1 rounded bg-amber-400 px-1.5 text-[11px] font-semibold text-black">
              {unconfirmed} unconfirmed
            </span>
          )}
        </Button>
      </div>
    </header>
  );
}
