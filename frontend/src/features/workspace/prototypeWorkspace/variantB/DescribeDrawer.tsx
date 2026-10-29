// PROTOTYPE (throwaway): Variant B Describe drawer. Non-modal: it docks over the right edge so the
// Workstation's video stays visible, and the active question selects its anchor Episode there.
import { X } from "lucide-react";
import { Fragment, useState } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import type { Phrase } from "../fixture/rubric";
import type { Workspace } from "../fixture/useWorkspace";
import { projects, type InterviewTurn } from "../fixture/workspace";
import { CriterionCard, SettingsEditor } from "./CriterionCard";

const phraseTone: Record<Phrase["status"], string> = {
  Checked: "bg-emerald-100 text-emerald-900 border-emerald-300",
  Context: "bg-slate-100 text-slate-700 border-slate-300",
  Unsupported: "bg-rose-100 text-rose-900 border-rose-300",
};

function DescriptionChips(props: {
  ws: Workspace;
  open: string | null;
  onOpen: (id: string | null) => void;
}) {
  const { rubric } = props.ws;
  let rest = rubric.description;
  const parts: { text: string; phrase?: Phrase }[] = [];
  for (const p of rubric.phrases) {
    const i = rest.indexOf(p.text);
    if (i < 0) continue;
    if (i > 0) parts.push({ text: rest.slice(0, i) });
    parts.push({ text: p.text, phrase: p });
    rest = rest.slice(i + p.text.length);
  }
  if (rest) parts.push({ text: rest });
  return (
    <p className="text-sm leading-7">
      {parts.map((part, i) =>
        part.phrase ? (
          <button
            key={i}
            onClick={() => props.onOpen(props.open === part.phrase!.id ? null : part.phrase!.id)}
            title={`${part.phrase.status}${part.phrase.note ? ` · ${part.phrase.note}` : ""}`}
            className={cn(
              "rounded border px-1 py-px",
              phraseTone[part.phrase.status],
              props.open === part.phrase.id && "ring-2 ring-sky-400",
            )}
          >
            {part.text}
            {props.ws.rubric.criteria.some(
              (c) => c.phraseId === part.phrase!.id && c.assumptions.length > 0,
            ) && <span className="ml-0.5 text-amber-600">●</span>}
          </button>
        ) : (
          <Fragment key={i}>{part.text}</Fragment>
        ),
      )}
    </p>
  );
}

function Question(props: {
  ws: Workspace;
  turn: InterviewTurn;
  active: boolean;
  onActivate: () => void;
}) {
  const { turn } = props;
  const ep = turn.anchor ? props.ws.resultById.get(turn.anchor.episodeId)?.episode : undefined;
  return (
    <div
      onClick={props.onActivate}
      className={cn(
        "cursor-pointer rounded-md border p-2.5",
        props.active ? "border-sky-400 bg-sky-50" : "bg-background",
        turn.answered && !props.active && "opacity-70",
      )}
    >
      {turn.anchor && ep && (
        <div className="mb-1.5 flex items-center gap-2">
          {ep.frames.ext1 && <img src={ep.frames.ext1} alt="" className="h-9 rounded" />}
          <div className="text-[11px] text-muted-foreground">
            ▶ Episode {ep.index} · {turn.anchor.clip[0].toFixed(1)}–{turn.anchor.clip[1].toFixed(1)}{" "}
            s
            <br />
            {turn.anchor.value}
          </div>
        </div>
      )}
      <div className="text-sm font-medium">{turn.text}</div>
      {turn.answered ? (
        <div className="mt-1.5 text-xs">
          <span className="rounded bg-foreground px-1.5 py-0.5 text-background">
            {turn.answered}
          </span>
          {turn.effect && <div className="mt-1 text-muted-foreground">→ {turn.effect}</div>}
        </div>
      ) : (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {turn.options?.map((o) => (
            <Button
              key={o}
              size="xs"
              variant="outline"
              onClick={(e) => {
                e.stopPropagation();
                props.ws.answer(turn.id, o);
              }}
            >
              {o}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}

export function DescribeDrawer(props: {
  ws: Workspace;
  activeTurnId: string | null;
  onActivate: (turn: InterviewTurn) => void;
  onClose: () => void;
}) {
  const { ws } = props;
  const [openPhrase, setOpenPhrase] = useState<string | null>(null);
  const project = projects.find((p) => p.id === ws.projectId) ?? projects[0]!;
  const active = ws.interview.find((t) => t.id === props.activeTurnId);
  const shownPhrase = openPhrase ?? active?.target?.phraseId ?? null;
  const left = ws.interview.filter((t) => !t.answered).length;
  return (
    <aside className="fixed top-12 right-0 bottom-0 z-40 flex w-[460px] flex-col border-l bg-background shadow-2xl">
      <div className="border-b p-3">
        <div className="flex items-center">
          <span className="text-xs font-semibold tracking-wide uppercase">
            Describe · Rubric v{ws.rubric.version} draft
          </span>
          <Button size="icon-xs" variant="ghost" className="ml-auto" onClick={props.onClose}>
            <X />
          </Button>
        </div>
        <DescriptionChips ws={ws} open={shownPhrase} onOpen={setOpenPhrase} />
        <div className="mt-1 text-[11px] text-muted-foreground">
          Anchor pool: {project.anchorPool.kind}, {ws.anchorIds.size} Episodes · stats below come
          from it only · Test set held out
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {shownPhrase && (
          <div className="grid gap-2 border-b bg-muted/40 p-3">
            {ws.rubric.criteria
              .filter((c) => c.phraseId === shownPhrase)
              .map((c) => (
                <CriterionCard
                  key={c.id}
                  ws={ws}
                  c={c}
                  highlight={active?.target?.criterionId === c.id}
                />
              ))}
          </div>
        )}
        {(active?.target?.setting ?? shownPhrase === "first-try") && (
          <div className="border-b bg-muted/40 p-3">
            <SettingsEditor ws={ws} highlight={active?.target?.setting} />
          </div>
        )}
        <div className="grid gap-2 p-3">
          <div className="text-[11px] text-muted-foreground">
            Interview · {left} question{left === 1 ? "" : "s"} left · each one plays on its anchor
            Episode in the main pane
          </div>
          {ws.interview.map((t) => (
            <Question
              key={t.id}
              ws={ws}
              turn={t}
              active={t.id === props.activeTurnId}
              onActivate={() => props.onActivate(t)}
            />
          ))}
        </div>
      </div>
      <div className="border-t p-2">
        <Textarea
          placeholder="Or answer in your own words (“only count pauses while holding”)…"
          className="min-h-14 text-xs"
        />
        <div className="mt-1 text-[11px] text-muted-foreground">
          Free text goes to Spark, which recompiles only the affected Phrase.
        </div>
      </div>
    </aside>
  );
}
