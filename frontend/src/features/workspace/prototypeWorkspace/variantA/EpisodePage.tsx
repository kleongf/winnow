// PROTOTYPE (throwaway): Variant A Episode page: the Workstation full-page, with a breadcrumb and
// prev/next through the filtered Episodes list (J/K).
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect } from "react";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";

import type { Workspace } from "../fixture/useWorkspace";
import type { Project } from "../fixture/workspace";
import { Workstation } from "../shared/Workstation";
import { phraseShort } from "./util";

export function EpisodePage(props: {
  ws: Workspace;
  project: Project;
  id: string;
  ids: string[];
  onOpen: (id: string) => void;
  onBack: () => void;
}) {
  const { ws, id, ids } = props;
  const result = ws.resultById.get(id);
  const at = ids.indexOf(id);
  const prev = at > 0 ? ids[at - 1] : undefined;
  const next = at >= 0 && at < ids.length - 1 ? ids[at + 1] : undefined;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement | null)?.closest("input, textarea")) return;
      if (e.key === "j" && next) props.onOpen(next);
      if (e.key === "k" && prev) props.onOpen(prev);
      if (e.key === "Escape") props.onBack();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  });

  if (!result) return null;
  const ep = result.episode;
  const labels = ws.labels.filter((l) => l.episodeId === id);
  return (
    <div className="px-8 py-5">
      <div className="mb-4 flex items-center gap-3">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>{props.project.name}</BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  props.onBack();
                }}
              >
                Episodes
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbPage>Episode {ep.index}</BreadcrumbPage>
          </BreadcrumbList>
        </Breadcrumb>
        <span className="truncate text-sm text-muted-foreground">“{ep.instruction}”</span>
        <span className="ml-auto text-xs text-muted-foreground tabular-nums">
          {at + 1} of {ids.length} · J/K
        </span>
        <Button
          size="icon-xs"
          variant="outline"
          disabled={!prev}
          onClick={() => {
            if (prev) props.onOpen(prev);
          }}
        >
          <ChevronLeft />
        </Button>
        <Button
          size="icon-xs"
          variant="outline"
          disabled={!next}
          onClick={() => {
            if (next) props.onOpen(next);
          }}
        >
          <ChevronRight />
        </Button>
      </div>
      <Workstation
        key={id}
        result={result}
        footer={
          labels.length > 0 && (
            <div className="mt-3 border-t pt-3 text-xs text-muted-foreground">
              Human labels:{" "}
              {labels
                .map((l) => `${phraseShort[l.phraseId] ?? l.phraseId} ${l.value} (${l.source})`)
                .join(" · ")}
            </div>
          )
        }
      />
    </div>
  );
}
