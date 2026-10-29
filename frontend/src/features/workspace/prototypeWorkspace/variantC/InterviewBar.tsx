// PROTOTYPE (throwaway): Variant C Describe interview, docked under the matrix. Each question is
// code-picked and template-worded, anchored on one Episode clip trimmed to the measured stretch,
// and lights up the exact (Episode, Phrase) cell its answer will label.
import { ChevronLeft, ChevronRight, MessageSquareText } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

import { episodeById } from "../fixture/episodes";
import type { Workspace } from "../fixture/useWorkspace";
import type { InterviewTurn } from "../fixture/workspace";

export function interviewCell(turn: InterviewTurn | undefined) {
  if (!turn?.anchor) return null;
  const phraseId = turn.target?.phraseId ?? (turn.target?.setting ? "first-try" : null);
  return phraseId ? { episodeId: turn.anchor.episodeId, phraseId } : null;
}

export function InterviewBar(props: {
  ws: Workspace;
  index: number;
  setIndex: (i: number) => void;
}) {
  const { ws, index } = props;
  const turns = ws.interview.filter((t) => t.kind === "question");
  const turn = turns[index];
  const [draft, setDraft] = useState("");
  const [sent, setSent] = useState<string | null>(null);
  if (!turn) return null;
  const answered = turns.filter((t) => t.answered).length;
  const ep = turn.anchor ? episodeById.get(turn.anchor.episodeId) : undefined;
  const go = (d: number) => {
    props.setIndex((index + d + turns.length) % turns.length);
    setSent(null);
  };
  const nextOpen = () => {
    const i = turns.findIndex((t, j) => j > index && !t.answered);
    props.setIndex(i >= 0 ? i : Math.min(turns.length - 1, index + 1));
  };

  return (
    <div className="flex h-44 shrink-0 gap-4 border-t bg-card px-4 py-3 shadow-[0_-4px_16px_rgba(0,0,0,0.06)]">
      <div className="flex w-28 shrink-0 flex-col gap-1 text-xs">
        <span className="font-semibold">Describe interview</span>
        <span className="font-mono text-muted-foreground">
          {answered} of {turns.length} answered
        </span>
        <div className="mt-1 flex gap-1">
          <Button
            size="icon-xs"
            variant="outline"
            onClick={() => go(-1)}
            aria-label="Previous question"
          >
            <ChevronLeft />
          </Button>
          <span className="self-center font-mono">
            Q{index + 1}/{turns.length}
          </span>
          <Button size="icon-xs" variant="outline" onClick={() => go(1)} aria-label="Next question">
            <ChevronRight />
          </Button>
        </div>
        <span className="mt-auto text-[10px] leading-tight text-muted-foreground">
          Run never blocks: unanswered questions stay as amber assumptions.
        </span>
      </div>

      {ep && turn.anchor && <AnchorClip turn={turn} frame={ep.frames.ext1} hasClip={ep.hasClips} />}

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="text-[11px] text-muted-foreground">
          Episode {ep?.index} · clip {turn.anchor?.clip[0].toFixed(1)}–
          {turn.anchor?.clip[1].toFixed(1)} s ·{" "}
          <span className="font-mono">{turn.anchor?.value}</span>
        </div>
        <p className="mt-1 text-[15px] leading-snug font-medium">{turn.text}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {turn.options?.map((o) => (
            <Button
              key={o}
              size="sm"
              variant={turn.answered === o ? "default" : "outline"}
              className={cn(turn.answered && turn.answered !== o && "opacity-50")}
              onClick={() => {
                ws.answer(turn.id, o);
                nextOpen();
              }}
            >
              {o}
            </Button>
          ))}
        </div>
        {turn.effect && turn.answered && (
          <p className="mt-2 text-xs text-emerald-800">
            Answered “{turn.answered}”. {turn.effect}
          </p>
        )}
        <form
          className="mt-auto flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (draft.trim()) setSent(draft.trim());
            setDraft("");
          }}
        >
          <MessageSquareText className="size-3.5 text-muted-foreground" />
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Or answer in your own words (Spark recompiles just this Phrase)"
            className="h-7 max-w-md text-xs"
          />
          {sent && (
            <span className="truncate text-xs text-muted-foreground">
              Sent “{sent}”: recompiling this Phrase…
            </span>
          )}
        </form>
      </div>
    </div>
  );
}

function AnchorClip(props: { turn: InterviewTurn; frame: string | null; hasClip: boolean }) {
  const [a, b] = props.turn.anchor!.clip;
  return (
    <div className="relative aspect-video h-full shrink-0 overflow-hidden rounded bg-black">
      {props.hasClip ? (
        <video
          key={props.turn.id}
          src={`/prototype/ep42/exterior_image_1_left.mp4#t=${a},${b}`}
          muted
          autoPlay
          playsInline
          className="h-full w-full object-cover"
          onTimeUpdate={(e) => {
            if (e.currentTarget.currentTime >= b) e.currentTarget.currentTime = a;
          }}
        />
      ) : (
        props.frame && <img src={props.frame} alt="" className="h-full w-full object-cover" />
      )}
      <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1 font-mono text-[10px] text-white">
        {props.hasClip ? `▶ ${a.toFixed(1)}–${b.toFixed(1)} s` : "frame 0 · clip not loaded"}
      </span>
    </div>
  );
}
