// The live Rubric: the compiled Description, the two Rubric-level settings, and each Phrase's
// section with its status, restatement and Criterion cards, each sorting the anchor pool.
import { cn } from "@/lib/utils";

import { type CardEditor, CriterionCard } from "./CriterionCard";
import { DescriptionText, phraseAnchor } from "./DescriptionText";
import { PHRASE_LABELS, PHRASE_TONES } from "./phraseTones";
import { cm, SettingCard } from "./SettingCard";
import type { Criterion, DraftPhrase, RubricDraft } from "./useDraft";
import type { AnchorPreview, DraftEdit } from "./useDraftEdits";

export interface DraftEditing {
  preview?: AnchorPreview | undefined;
  editorFor: (criterion: Criterion) => CardEditor;
  onSettings: (edit: Omit<DraftEdit, "criteria">) => void;
}

function PhraseSection(props: {
  draft: RubricDraft;
  phrase: DraftPhrase;
  index: number;
  editing: DraftEditing;
}) {
  const { draft, phrase, editing } = props;
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
          <CriterionCard
            key={c.id}
            criterion={c}
            english={draft.english[c.id] ?? c.id}
            enabled={!draft.disabled.includes(c.id)}
            preview={editing.preview?.criteria.find((p) => p.criterion_id === c.id)}
            editor={editing.editorFor(c)}
          />
        ))}
      </div>
    </section>
  );
}

export function RubricPanel(props: { draft: RubricDraft; editing: DraftEditing }) {
  const { draft, editing } = props;
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
        <SettingCard
          label="Gripper closed above"
          shown={closed.value}
          setting={closed}
          editor={{
            min: 0.05,
            max: 0.95,
            step: 0.05,
            onSave: (value) => {
              editing.onSettings({ gripper_closed_level: value });
            },
          }}
        />
        <SettingCard
          label="Grasp: the last closure that rises"
          shown={cm(rise.value)}
          unit="cm"
          setting={rise}
          editor={{
            min: 0.5,
            max: 20,
            step: 0.5,
            onSave: (value) => {
              editing.onSettings({ grasp_rise_m: value / 100 });
            },
          }}
        />
      </div>
      {draft.phrases.map((phrase, i) => (
        <PhraseSection
          key={phrase.start}
          draft={draft}
          phrase={phrase}
          index={i}
          editing={editing}
        />
      ))}
    </div>
  );
}
