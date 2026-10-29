// Every ingested Episode in a dense table; a row opens the full-page Workstation. The open
// Episode and its start time live in `?episode=` and `?t=`.
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { navigate, useSearchParams } from "../core/url";
import { EpisodePage } from "./EpisodePage";
import { useEpisodes } from "./useEpisodes";

export function EpisodesPage() {
  const params = useSearchParams();
  const episodes = useEpisodes();
  const openId = params.get("episode");
  const list = episodes.data ?? [];
  const open = (id: string | null) => {
    navigate({ episode: id, t: null });
  };

  const openEpisode = list.find((e) => e.id === openId);
  if (openEpisode) {
    const t = Number(params.get("t") ?? 0);
    return (
      <EpisodePage
        key={openEpisode.id}
        episode={openEpisode}
        ids={list.map((e) => e.id)}
        initialT={Number.isFinite(t) ? t : 0}
        onOpen={open}
      />
    );
  }

  return (
    <div className="mx-auto max-w-6xl p-8">
      <div className="text-xs text-muted-foreground">Project</div>
      <h1 className="text-xl font-semibold">Episodes</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {list.length} Episodes in the Dataset. Open one to watch it with its robot data.
      </p>
      {list.length === 0 && !episodes.isPending && (
        <p className="mt-6 text-sm text-muted-foreground">
          No Episodes yet: ingest some on the Prepare page.
        </p>
      )}
      {list.length > 0 && (
        <Table className="mt-6">
          <TableHeader>
            <TableRow>
              <TableHead className="w-32">Episode</TableHead>
              <TableHead>Instruction</TableHead>
              <TableHead className="w-24 text-right">Length</TableHead>
              <TableHead className="w-28">Source</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.map((e) => (
              <TableRow
                key={e.id}
                className="cursor-pointer"
                onClick={() => {
                  open(e.id);
                }}
              >
                <TableCell className="font-medium tabular-nums">{e.index}</TableCell>
                <TableCell className="max-w-md truncate">
                  {e.instruction ?? <span className="text-muted-foreground">None recorded</span>}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {e.duration_s.toFixed(1)} s
                </TableCell>
                <TableCell className="text-muted-foreground">{e.source}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
