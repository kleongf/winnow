// The live Rubric: the compiled Description, the two Rubric-level settings, and each Phrase's
// section with its status, restatement and Criterion cards.
import { AlertTriangle } from "lucide-react";

import { cn } from "@/lib/utils";

import { CriterionCard } from "./CriterionCard";
import { DescriptionText, phraseAnchor } from "./DescriptionText";
import { ASSUMED, PHRASE_LABELS, PHRASE_TONES } from "./phraseTones";
import type { DraftPhrase, RubricDraft, Setting } from "./useDraft";

function SettingCard(props: { label: string; value: string; setting: Setting }) {
  const assumption = props.setting.assumption;
  return (
    <div
      className={cn("rounded-lg border bg-card p-3", assumption && ASSUMED)}
      data-testid="rubric-setting"
    >
      <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
        Rubric setting
        {assumption && (
          <span className="ml-auto flex items-center gap-1 text-amber-800 dark:text-amber-300">
            <AlertTriangle className="size-3" /> assumed
          </span>
        )}
      </div>
      <p className="mt-0.5 text-sm">
        {props.label} <span className="font-semibold tabular-nums">{props.value}</span>
      </p>
      {assumption && <p className="mt-1 text-xs">{assumption}</p>}
    </div>
  );
}

function PhraseSection(props: { draft: RubricDraft; phrase: DraftPhrase; index: number }) {
  const { draft, phrase } = props;
  const criteria = draft.criteria.filter((c) => c.phrase === phrase.text);
  return (
    <section
      id={phraseAnchor(props.index)}
      aria-label={`Phrase: ${phrase.text}`}
      className="mt-5 scroll-mt-20"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className={cn("rounded px-1.5 py-0.5 text-sm", PHRASE_TONES[phrase.status])}>
          “{phrase.text}”
        </span>
        <span className="rounded border px-1.5 text-[11px]" data-testid="phrase-status">
          {PHRASE_LABELS[phrase.status]}
        </span>
        {phrase.status === "unsupported" && (
          <span className="text-xs text-muted-foreground">not checked</span>
        )}
      </div>
      <p className="mt-1.5 text-xs text-muted-foreground">{phrase.restatement}</p>
      {phrase.reason && (
        <p className="mt-1 text-xs" data-testid="phrase-reason">
          {phrase.reason}
        </p>
      )}
      <div className="mt-2 grid gap-2">
        {criteria.map((c) => (
          <CriterionCard key={c.id} criterion={c} english={draft.english[c.id] ?? c.id} />
        ))}
      </div>
    </section>
  );
}

export function RubricPanel(props: { draft: RubricDraft }) {
  const { draft } = props;
  const { gripper_closed_level: closed, grasp_rise_m: rise } = draft.settings;
  return (
    <div>
      <div className="rounded-lg border bg-card p-4">
        <div className="mb-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
          Description
        </div>
        <DescriptionText draft={draft} />
        {draft.uncovered.length > 0 && (
          <p className="mt-2 text-xs text-muted-foreground">
            Wavy underlines mark words in no Phrase: nothing checks them.
          </p>
        )}
        {draft.rejected.map((r) => (
          <p key={r.text} className="mt-2 text-xs text-destructive" data-testid="rejected-phrase">
            Spark proposed “{r.text}”, refused: {r.reason}
          </p>
        ))}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <SettingCard label="Gripper closed above" value={String(closed.value)} setting={closed} />
        <SettingCard
          label="Grasp: the last closure that rises"
          value={`${String(Math.round(rise.value * 1000) / 10)} cm`}
          setting={rise}
        />
      </div>
      {draft.phrases.map((phrase, i) => (
        <PhraseSection key={phrase.start} draft={draft} phrase={phrase} index={i} />
      ))}
    </div>
  );
}
