// PROTOTYPE (throwaway): Variant B, "Triage inbox". One persistent three-pane screen like a mail
// client: folders + Episode list on the left, the Workstation in the middle, and a non-modal
// Describe drawer that docks on the right and drives the Workstation with its anchored questions.
import { useEffect, useState } from "react";

import type { Workspace } from "../fixture/useWorkspace";
import type { InterviewTurn } from "../fixture/workspace";
import { Workstation } from "../shared/Workstation";
import { AuditPanel, OverridePanel, ReviewPanel, SparkFooter } from "./ActionPanels";
import { BoxQueue } from "./BoxQueue";
import { DescribeDrawer } from "./DescribeDrawer";
import { applyFilters, folderItems, folders, type Filters, type FolderId } from "./inbox";
import { InboxPane } from "./InboxPane";
import { ReportDialog } from "./ReportDialog";
import { TopBar } from "./TopBar";

export const name = "Triage inbox";

export function VariantB(props: { ws: Workspace }) {
  const { ws } = props;
  const [folder, setFolder] = useState<FolderId>("review");
  const [filters, setFilters] = useState<Filters>({ query: "", phraseId: null, signal: null });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [describeOpen, setDescribeOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [activeTurn, setActiveTurn] = useState<InterviewTurn | null>(null);

  const counts = Object.fromEntries(
    folders.map((f) => [f.id, folderItems(ws, f.id).length]),
  ) as Record<FolderId, number>;
  const items = applyFilters(folderItems(ws, folder), filters);
  const selected = (selectedId && ws.resultById.get(selectedId)) || items[0];
  const index = selected ? items.findIndex((r) => r.episode.id === selected.episode.id) : -1;

  const move = (d: number) => {
    const next = items[index + d] ?? (d > 0 ? items[index - 1] : undefined);
    if (next) setSelectedId(next.episode.id);
  };
  const advance = () => {
    const next = items[index + 1] ?? items[index - 1];
    setSelectedId(next && next.episode.id !== selected?.episode.id ? next.episode.id : null);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement | null)?.closest("input, textarea, [contenteditable]")) return;
      if (e.key === "j") move(1);
      if (e.key === "k") move(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const activate = (turn: InterviewTurn) => {
    setActiveTurn(turn);
    if (turn.anchor) setSelectedId(turn.anchor.episodeId);
  };
  const anchored =
    activeTurn?.anchor && selected?.episode.id === activeTurn.anchor.episodeId ? activeTurn : null;
  const boxing = folder === "unboxed" && selected && !ws.boxes.get(selected.episode.id);

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <TopBar
        ws={ws}
        describeOpen={describeOpen}
        onDescribe={() => setDescribeOpen(!describeOpen)}
        onReport={() => setReportOpen(true)}
      />
      <div className="grid min-h-0 flex-1 grid-cols-[300px_minmax(0,1fr)]">
        <InboxPane
          folder={folder}
          counts={counts}
          onFolder={(f) => {
            setFolder(f);
            setSelectedId(null);
          }}
          filters={filters}
          onFilters={setFilters}
          items={items}
          selectedId={selected?.episode.id ?? null}
          onSelect={setSelectedId}
          anchorIds={ws.anchorIds}
        />
        <main className={describeOpen ? "overflow-y-auto p-4 pr-[476px]" : "overflow-y-auto p-4"}>
          {!selected && <p className="text-sm text-muted-foreground">Folder is empty.</p>}
          {selected && boxing && (
            <BoxQueue
              key={selected.episode.id}
              ws={ws}
              r={selected}
              remaining={counts.unboxed}
              onNext={advance}
            />
          )}
          {selected && !boxing && (
            <>
              <EpisodeHeader
                index={selected.episode.index}
                instruction={selected.episode.instruction}
                anchor={ws.anchorIds.has(selected.episode.id)}
                heldOut={ws.heldOutIds.has(selected.episode.id)}
              />
              {anchored?.anchor && (
                <div className="mb-2 rounded-md border border-sky-300 bg-sky-50 px-3 py-1.5 text-xs text-sky-900">
                  Interview anchor · clip {anchored.anchor.clip[0].toFixed(1)}–
                  {anchored.anchor.clip[1].toFixed(1)} s · {anchored.anchor.value} · “
                  {anchored.text}”
                </div>
              )}
              <Workstation
                key={`${selected.episode.id}-${anchored?.id ?? ""}`}
                result={selected}
                stacked={describeOpen}
                {...(anchored?.anchor ? { initialT: anchored.anchor.clip[0] } : {})}
                actions={
                  folder === "review" && selected.triage === "Needs review" ? (
                    <ReviewPanel key={selected.episode.id} ws={ws} r={selected} onNext={advance} />
                  ) : folder === "audit" ? (
                    <AuditPanel key={selected.episode.id} ws={ws} r={selected} onNext={advance} />
                  ) : (
                    <OverridePanel key={selected.episode.id} ws={ws} r={selected} />
                  )
                }
                footer={<SparkFooter r={selected} />}
              />
            </>
          )}
        </main>
      </div>
      {describeOpen && (
        <DescribeDrawer
          ws={ws}
          activeTurnId={activeTurn?.id ?? null}
          onActivate={activate}
          onClose={() => setDescribeOpen(false)}
        />
      )}
      <ReportDialog open={reportOpen} onOpenChange={setReportOpen} />
    </div>
  );
}

function EpisodeHeader(props: {
  index: number;
  instruction: string;
  anchor: boolean;
  heldOut: boolean;
}) {
  return (
    <div className="mb-2 flex items-baseline gap-2">
      <h2 className="text-base font-semibold">Episode {props.index}</h2>
      <span className="truncate text-sm text-muted-foreground">“{props.instruction}”</span>
      <span className="ml-auto text-[11px] text-muted-foreground">
        {props.anchor ? "anchor pool (Dev set)" : props.heldOut ? "Test set (held out)" : ""}
      </span>
    </div>
  );
}
