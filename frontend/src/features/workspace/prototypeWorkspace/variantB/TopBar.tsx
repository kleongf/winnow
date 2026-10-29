// PROTOTYPE (throwaway): Variant B top bar: Dataset ▸ Project switchers, Rubric version, coverage,
// Describe / Report / Run. Run never blocks; unconfirmed assumptions only add a count.
import { ChevronDown, MessageSquareText, Play, Table2 } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { assumptionCount } from "../fixture/rubric";
import type { Workspace } from "../fixture/useWorkspace";
import { datasets, projects } from "../fixture/workspace";

export function TopBar(props: {
  ws: Workspace;
  describeOpen: boolean;
  onDescribe: () => void;
  onReport: () => void;
}) {
  const { ws } = props;
  const project = projects.find((p) => p.id === ws.projectId) ?? projects[0]!;
  const dataset = datasets.find((d) => d.id === project.datasetId) ?? datasets[0]!;
  const review = ws.results.filter((r) => r.triage === "Needs review").length;
  const assumptions = assumptionCount(ws.rubric);
  const [ran, setRan] = useState(false);
  return (
    <header className="flex h-12 items-center gap-2 border-b px-3">
      <span className="mr-1 text-sm font-bold tracking-tight">Winnow</span>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="ghost">
            {dataset.name}
            <span className="text-muted-foreground">· {dataset.episodeIds.length} Episodes</span>
            <ChevronDown />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-72">
          <DropdownMenuLabel>Datasets</DropdownMenuLabel>
          {datasets.map((d) => (
            <DropdownMenuItem key={d.id} disabled={d.id !== dataset.id}>
              {d.name}
              <span className="ml-auto text-xs text-muted-foreground">
                {d.sources.map((s) => s.name.replace("lerobot/", "")).join(" + ")}
              </span>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem>+ Import a Dataset</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <span className="text-muted-foreground">▸</span>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="ghost" className="font-semibold">
            {project.name}
            <ChevronDown />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-80">
          <DropdownMenuLabel>Projects on {dataset.name}</DropdownMenuLabel>
          {projects
            .filter((p) => p.datasetId === dataset.id)
            .map((p) => (
              <DropdownMenuItem key={p.id} onSelect={() => ws.setProjectId(p.id)}>
                <div>
                  <div>{p.name}</div>
                  <div className="line-clamp-1 text-xs text-muted-foreground">{p.description}</div>
                </div>
              </DropdownMenuItem>
            ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem>+ New Project on this Dataset</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Badge variant="outline">
        Rubric v{ws.rubric.version}
        {ws.rubric.draft ? " · draft" : ""}
      </Badge>
      <span
        className="ml-3 truncate text-xs whitespace-nowrap text-muted-foreground tabular-nums"
        title={project.lastRun ? `last run v${project.lastRun.version} ${project.lastRun.at}` : ""}
      >
        <b className="text-foreground">{ws.results.length - review}</b> of {ws.results.length}{" "}
        decided automatically · <b className="text-amber-700">{review}</b> Needs review
      </span>
      <div className="ml-auto flex items-center gap-1.5">
        <Button
          size="sm"
          variant={props.describeOpen ? "secondary" : "outline"}
          onClick={props.onDescribe}
        >
          <MessageSquareText /> Describe
        </Button>
        <Button size="sm" variant="outline" onClick={props.onReport}>
          <Table2 /> Report
        </Button>
        <Button size="sm" onClick={() => setRan(true)}>
          <Play /> {ran ? "Queued" : `Run v${ws.rubric.version}`}
          {assumptions > 0 && (
            <span className="rounded bg-amber-400 px-1 text-[10px] text-black">
              {assumptions} unconfirmed
            </span>
          )}
        </Button>
      </div>
    </header>
  );
}
