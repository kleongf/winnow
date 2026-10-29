// PROTOTYPE (throwaway): Variant A "Episodes": every Episode with its Triage decision and Reason in a
// dense table, filtered by Triage decision, Phrase, Uncertainty signal and split.
import { ArrowDownUp } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

import type { EpisodeResult } from "../fixture/evaluate";
import type { Triage } from "../fixture/rubric";
import type { Workspace } from "../fixture/useWorkspace";
import { TriageBadge, statusClass } from "../shared/bits";
import { phraseShort } from "./util";

type TriageFilter = "all" | Triage;

const signalKinds = [
  "near threshold",
  "samples split",
  "Spark said unsure",
  "track lost",
  "no hand-drawn box",
  "unconfirmed fail",
];

function matches(
  r: EpisodeResult,
  f: { triage: TriageFilter; phrase: string; signal: string; split: string },
) {
  if (f.triage !== "all" && r.triage !== f.triage) return false;
  if (f.split !== "all" && r.episode.split !== f.split) return false;
  if (f.phrase !== "all" && !r.phrases.some((p) => p.phraseId === f.phrase && p.status !== "pass"))
    return false;
  if (f.signal !== "all" && !r.signals.some((s) => s.includes(f.signal))) return false;
  return true;
}

function FilterSelect(props: {
  value: string;
  onChange: (v: string) => void;
  all: string;
  items: [string, string][];
}) {
  return (
    <Select value={props.value} onValueChange={props.onChange}>
      <SelectTrigger size="sm" className="w-52">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{props.all}</SelectItem>
        {props.items.map(([v, l]) => (
          <SelectItem key={v} value={v}>
            {l}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function EpisodesPage(props: {
  ws: Workspace;
  onOpen: (id: string, list: string[]) => void;
}) {
  const { ws } = props;
  const [triage, setTriage] = useState<TriageFilter>("all");
  const [phrase, setPhrase] = useState("all");
  const [signal, setSignal] = useState("all");
  const [split, setSplit] = useState("all");
  const [asc, setAsc] = useState(true);
  const count = (t: Triage) => ws.results.filter((r) => r.triage === t).length;
  const rows = ws.results
    .filter((r) => matches(r, { triage, phrase, signal, split }))
    .sort((a, b) => (asc ? a.confidence - b.confidence : b.confidence - a.confidence));
  const ids = rows.map((r) => r.episode.id);
  return (
    <div className="px-8 py-6">
      <h1 className="text-xl font-semibold">Episodes</h1>
      <p className="text-sm text-muted-foreground">
        {ws.results.length} Episodes · Rubric v{ws.rubric.version} ·{" "}
        {ws.results.length - count("Needs review")} of {ws.results.length} decided automatically ·{" "}
        {count("Needs review")} Needs review
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Tabs
          value={triage}
          onValueChange={(v) => {
            setTriage(v as TriageFilter);
          }}
        >
          <TabsList>
            <TabsTrigger value="all">All {ws.results.length}</TabsTrigger>
            <TabsTrigger value="Keep">Keep {count("Keep")}</TabsTrigger>
            <TabsTrigger value="Reject">Reject {count("Reject")}</TabsTrigger>
            <TabsTrigger value="Needs review">Needs review {count("Needs review")}</TabsTrigger>
          </TabsList>
        </Tabs>
        <FilterSelect
          value={phrase}
          onChange={setPhrase}
          all="Any Phrase"
          items={Object.entries(phraseShort).map(([k, v]) => [k, `Fails/unsure: ${v}`])}
        />
        <FilterSelect
          value={signal}
          onChange={setSignal}
          all="Any Uncertainty signal"
          items={signalKinds.map((s) => [s, s])}
        />
        <FilterSelect
          value={split}
          onChange={setSplit}
          all="Dev + Test"
          items={[
            ["dev", "Dev set"],
            ["test", "Test set"],
          ]}
        />
        <span className="ml-auto text-xs text-muted-foreground">{rows.length} shown</span>
      </div>
      <Table className="mt-3 text-[13px]">
        <TableHeader>
          <TableRow>
            <TableHead className="w-24">Episode</TableHead>
            <TableHead>Instruction</TableHead>
            <TableHead className="w-12">Split</TableHead>
            <TableHead className="w-28">Triage decision</TableHead>
            <TableHead className="w-24">
              <Button
                variant="ghost"
                size="xs"
                className="-ml-2"
                onClick={() => {
                  setAsc(!asc);
                }}
              >
                Confidence <ArrowDownUp className="size-3" />
              </Button>
            </TableHead>
            <TableHead>Reason</TableHead>
            <TableHead className="w-56">Phrases not passing</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow
              key={r.episode.id}
              className="cursor-pointer"
              onClick={() => {
                props.onOpen(r.episode.id, ids);
              }}
            >
              <TableCell className="font-medium tabular-nums">
                {r.episode.source === "droid_100" ? "" : "1.0.1/"}
                {r.episode.index}
              </TableCell>
              <TableCell className="max-w-64 truncate text-muted-foreground">
                {r.episode.instruction}
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {r.episode.split === "dev" ? "Dev" : "Test"}
              </TableCell>
              <TableCell>
                <TriageBadge triage={r.triage} />
              </TableCell>
              <TableCell className="tabular-nums">{r.confidence.toFixed(2)}</TableCell>
              <TableCell className="max-w-96 truncate" title={r.reason}>
                {r.reason}
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1">
                  {r.phrases
                    .filter((p) => p.status !== "pass")
                    .map((p) => (
                      <span
                        key={p.phraseId}
                        className={cn("rounded border px-1 text-[11px]", statusClass[p.status])}
                      >
                        {phraseShort[p.phraseId]}
                      </span>
                    ))}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
