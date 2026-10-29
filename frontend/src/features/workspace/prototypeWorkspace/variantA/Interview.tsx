// PROTOTYPE (throwaway): Variant A Describe interview: a thread of code-picked, template-worded
// questions, each anchored on an Episode clip trimmed to the measured stretch. Free text is a
// secondary path (the only place Spark comes in).
import { CornerDownLeft } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

import type { Workspace } from "../fixture/useWorkspace";
import type { InterviewTurn } from "../fixture/workspace";

function Anchor(props: { ws: Workspace; turn: InterviewTurn; live: boolean }) {
  const a = props.turn.anchor;
  if (!a) return null;
  const ep = props.ws.resultById.get(a.episodeId)?.episode;
  if (!ep) return null;
  const range = `${a.clip[0].toFixed(1)}–${a.clip[1].toFixed(1)} s`;
  return (
    <div className="mt-2 grid grid-cols-[200px_1fr] gap-3">
      <div className="relative overflow-hidden rounded bg-black">
        {ep.hasClips ? (
          <video
            src={`/prototype/ep42/exterior_image_1_left.mp4#t=${String(a.clip[0])},${String(a.clip[1])}`}
            muted
            preload="none"
            poster={ep.frames.ext1 ?? undefined}
            playsInline
            controls={props.live}
            className="aspect-video w-full"
          />
        ) : (
          <img src={ep.frames.ext1 ?? ""} alt="" className="aspect-video w-full object-cover" />
        )}
        <span className="absolute top-1 left-1 rounded bg-black/60 px-1 text-[10px] text-white">
          clip {range}
        </span>
      </div>
      <div className="text-xs">
        <div className="text-muted-foreground">Anchor Episode</div>
        <div className="font-medium">
          Episode {ep.index}{" "}
          <span className="text-muted-foreground">
            · {ep.split === "dev" ? "Dev set" : "sample"}
          </span>
        </div>
        <div className="mt-1 text-muted-foreground">Measured</div>
        <div className="font-mono text-[11px]">{a.value}</div>
      </div>
    </div>
  );
}

export function Interview(props: { ws: Workspace; onAnswer: (turn: InterviewTurn) => void }) {
  const { ws } = props;
  const [draft, setDraft] = useState("");
  const current = ws.interview.find((t) => t.kind === "question" && !t.answered);
  const remaining = ws.interview.filter((t) => t.kind === "question" && !t.answered).length;
  return (
    <div>
      <div className="mb-3 flex items-baseline gap-2">
        <h2 className="text-sm font-semibold">Describe interview</h2>
        <span className="text-xs text-muted-foreground">
          {remaining
            ? `${String(remaining)} questions left · Run never waits`
            : "every Phrase covered"}
        </span>
      </div>
      <ol className="relative grid gap-3 border-l pl-4">
        {ws.interview.map((t, i) => {
          const live = t === current;
          return (
            <li
              key={t.id}
              className={cn(
                "relative rounded-lg border bg-card p-3",
                live ? "border-sky-400 shadow-sm" : t.answered ? "opacity-80" : "opacity-50",
              )}
            >
              <span
                className={cn(
                  "absolute top-3.5 -left-[21px] size-2.5 rounded-full border-2 border-background",
                  t.answered ? "bg-emerald-600" : live ? "bg-sky-500" : "bg-muted-foreground/40",
                )}
              />
              <div className="flex items-start gap-2">
                <span className="text-xs text-muted-foreground tabular-nums">Q{i + 1}</span>
                <p className="flex-1 text-sm font-medium">{t.text}</p>
                {t.target?.criterionId && (
                  <Badge variant="outline" className="text-[10px]">
                    {ws.rubric.criteria.find((c) => c.id === t.target?.criterionId)?.primitive}
                  </Badge>
                )}
                {t.target?.setting && (
                  <Badge variant="outline" className="text-[10px]">
                    {t.target.setting === "gripperClosed" ? "gripper-closed level" : "grasp rule"}
                  </Badge>
                )}
              </div>
              {live && <Anchor ws={ws} turn={t} live={live} />}
              {t.answered ? (
                <div className="mt-2 text-xs">
                  <span className="rounded bg-muted px-1.5 py-0.5 font-medium">{t.answered}</span>
                  {t.effect && <span className="ml-2 text-muted-foreground">→ {t.effect}</span>}
                </div>
              ) : (
                live && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {t.options?.map((o) => (
                      <Button
                        key={o}
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          ws.answer(t.id, o);
                          props.onAnswer(t);
                        }}
                      >
                        {o}
                      </Button>
                    ))}
                  </div>
                )
              )}
            </li>
          );
        })}
      </ol>
      <div className="mt-4 flex items-center gap-2 pl-4">
        <Input
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
          }}
          placeholder="Or answer in your own words (Spark recompiles just that Phrase)…"
          className="h-8 text-xs"
        />
        <Button size="sm" variant="ghost" disabled={!draft}>
          <CornerDownLeft className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}
