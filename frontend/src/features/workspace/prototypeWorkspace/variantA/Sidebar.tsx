// PROTOTYPE (throwaway): Variant A left sidebar: Dataset switcher, its Projects, pipeline stages.
import {
  BarChart3,
  CheckCheck,
  Database,
  FolderKanban,
  ListChecks,
  MessageSquareText,
  Plus,
  ScanSearch,
  SquareDashedMousePointer,
} from "lucide-react";
import type { ComponentType } from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

import { datasets, projects, type Dataset } from "../fixture/workspace";
import type { Page } from "./util";

const icons: Record<Page, ComponentType<{ className?: string }>> = {
  prepare: SquareDashedMousePointer,
  describe: MessageSquareText,
  episodes: ListChecks,
  review: ScanSearch,
  audit: CheckCheck,
  evaluation: BarChart3,
};

const labels: Record<Page, string> = {
  prepare: "Prepare",
  describe: "Describe",
  episodes: "Episodes",
  review: "Review",
  audit: "Audit",
  evaluation: "Evaluation",
};

export function Sidebar(props: {
  dataset: Dataset;
  onDataset: (id: string) => void;
  projectId: string | null;
  onProject: (id: string) => void;
  page: Page;
  onPage: (p: Page) => void;
  counts: Record<Page, string>;
}) {
  const own = projects.filter((p) => p.datasetId === props.dataset.id);
  const projectPages: Page[] = ["describe", "episodes", "review", "audit", "evaluation"];
  return (
    <aside className="flex h-screen w-60 shrink-0 flex-col border-r bg-muted/30">
      <div className="flex items-center gap-2 px-4 pt-4 pb-3 text-sm font-semibold">
        <span className="grid size-6 place-items-center rounded bg-foreground text-[11px] text-background">
          W
        </span>
        Winnow
      </div>
      <div className="px-3">
        <div className="mb-1 px-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
          Dataset
        </div>
        <Select value={props.dataset.id} onValueChange={props.onDataset}>
          <SelectTrigger className="w-full" size="sm">
            <Database className="size-3.5 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {datasets.map((d) => (
              <SelectItem key={d.id} value={d.id}>
                {d.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="mt-1 px-1 text-[11px] text-muted-foreground">
          {props.dataset.sources
            .map((s) => `${s.name.replace("lerobot/", "")} ${String(s.count)}`)
            .join(" · ")}
        </div>
      </div>
      <nav className="mt-3 px-3">
        <NavItem
          icon={icons.prepare}
          label={labels.prepare}
          count={props.counts.prepare}
          active={props.page === "prepare"}
          onClick={() => {
            props.onPage("prepare");
          }}
          hint="Dataset"
        />
      </nav>
      <div className="mt-4 mb-1 px-4 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
        Projects
      </div>
      <div className="flex-1 overflow-y-auto px-3">
        {own.length === 0 && (
          <p className="px-1 text-xs text-muted-foreground">No Projects on this Dataset yet.</p>
        )}
        {own.map((p) => (
          <div key={p.id} className="mb-2">
            <button
              type="button"
              onClick={() => {
                props.onProject(p.id);
              }}
              className={cn(
                "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm",
                p.id === props.projectId ? "font-medium" : "text-muted-foreground hover:bg-muted",
              )}
            >
              <FolderKanban className="size-3.5" />
              <span className="truncate">{p.name}</span>
            </button>
            {p.id === props.projectId && (
              <div className="ml-3 border-l pl-2">
                {projectPages.map((k) => (
                  <NavItem
                    key={k}
                    icon={icons[k]}
                    label={labels[k]}
                    count={props.counts[k]}
                    active={props.page === k}
                    onClick={() => {
                      props.onPage(k);
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        ))}
        <button
          type="button"
          className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm text-muted-foreground hover:bg-muted"
        >
          <Plus className="size-3.5" /> New Project
        </button>
      </div>
    </aside>
  );
}

function NavItem(props: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  count: string;
  active: boolean;
  onClick: () => void;
  hint?: string;
}) {
  const Icon = props.icon;
  return (
    <button
      type="button"
      onClick={props.onClick}
      className={cn(
        "flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm",
        props.active ? "bg-background font-medium shadow-sm ring-1 ring-border" : "hover:bg-muted",
      )}
    >
      <Icon className="size-3.5 text-muted-foreground" />
      <span>{props.label}</span>
      {props.hint && <span className="text-[10px] text-muted-foreground">{props.hint}</span>}
      <span className="ml-auto text-xs text-muted-foreground tabular-nums">{props.count}</span>
    </button>
  );
}
