// PROTOTYPE (throwaway): Variant A, "Pipeline sidebar". A classic app shell: Dataset switcher and
// its Projects in a left sidebar, one page per pipeline stage (Prepare, Describe, Episodes,
// Review, Audit, Evaluation). The Spark-alone contrast appears only on the Evaluation page.
import { useState } from "react";

import type { Workspace } from "../fixture/useWorkspace";
import { datasets, projects } from "../fixture/workspace";
import { AuditPage, auditSample } from "./AuditPage";
import { DescribePage } from "./DescribePage";
import { EpisodePage } from "./EpisodePage";
import { EpisodesPage } from "./EpisodesPage";
import { EvaluationPage } from "./EvaluationPage";
import { PreparePage } from "./PreparePage";
import { ReviewPage, reviewQueue } from "./ReviewPage";
import { Sidebar } from "./Sidebar";
import { readPage, writePage, type Page } from "./util";

export const name = "Pipeline sidebar";

export function VariantA(props: { ws: Workspace }) {
  const { ws } = props;
  const [datasetId, setDatasetId] = useState("droid-pnp");
  const [page, setPageState] = useState<Page>(readPage);
  const [openId, setOpenId] = useState<string | null>(null);
  const [visibleIds, setVisibleIds] = useState<string[]>([]);
  const dataset = datasets.find((d) => d.id === datasetId) ?? datasets[0]!;
  const project = projects.find((p) => p.id === ws.projectId && p.datasetId === datasetId) ?? null;

  const setPage = (p: Page) => {
    writePage(p);
    setPageState(p);
    setOpenId(null);
  };
  const openEpisode = (id: string, list: string[]) => {
    setVisibleIds(list);
    setOpenId(id);
    writePage("episodes");
    setPageState("episodes");
  };

  const missingBoxes = [...ws.boxes.values()].filter((b) => b === null).length;
  const queue = reviewQueue(ws);
  const sample = auditSample(ws);
  const audited = sample.filter((r) =>
    ws.labels.some((l) => l.episodeId === r.episode.id && l.source === "audit"),
  ).length;
  const counts: Record<Page, string> = {
    prepare: missingBoxes ? `${String(missingBoxes)} to box` : "✓",
    describe: `v${String(ws.rubric.version)}`,
    episodes: String(ws.results.length),
    review: String(queue.length),
    audit: `${String(audited)}/${String(sample.length)}`,
    evaluation: "",
  };

  const body = () => {
    if (page === "prepare") return <PreparePage ws={ws} dataset={dataset} />;
    if (!project)
      return (
        <div className="p-10 text-sm text-muted-foreground">
          No Project selected. A Project applies one Description to this Dataset.
        </div>
      );
    if (page === "describe") return <DescribePage ws={ws} project={project} />;
    if (page === "episodes" && openId)
      return (
        <EpisodePage
          ws={ws}
          project={project}
          id={openId}
          ids={visibleIds}
          onOpen={setOpenId}
          onBack={() => {
            setOpenId(null);
          }}
        />
      );
    if (page === "episodes") return <EpisodesPage ws={ws} onOpen={openEpisode} />;
    if (page === "review") return <ReviewPage ws={ws} />;
    if (page === "audit") return <AuditPage ws={ws} />;
    return <EvaluationPage ws={ws} onOpen={openEpisode} />;
  };

  return (
    <div className="flex h-screen bg-background text-foreground">
      <Sidebar
        dataset={dataset}
        onDataset={(id) => {
          setDatasetId(id);
          const first = projects.find((p) => p.datasetId === id);
          if (first) ws.setProjectId(first.id);
        }}
        projectId={project?.id ?? null}
        onProject={(id) => {
          ws.setProjectId(id);
          if (page === "prepare") setPage("describe");
        }}
        page={page}
        onPage={setPage}
        counts={counts}
      />
      <main className="min-w-0 flex-1 overflow-y-auto pb-20">{body()}</main>
    </div>
  );
}
