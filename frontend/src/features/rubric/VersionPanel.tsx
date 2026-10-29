// A frozen Rubric version, read only: what Run froze, and how it sorts the anchor pool.
import { CriterionCard } from "./CriterionCard";
import { cm, SettingCard } from "./SettingCard";
import type { AnchorPreview } from "./useDraftEdits";
import type { RubricVersion } from "./useRubric";

export function VersionPanel(props: {
  version: RubricVersion;
  preview?: AnchorPreview | undefined;
}) {
  const { rubric, origin, created_at: createdAt } = props.version;
  const { gripper_closed_level: closed, grasp_rise_m: rise } = rubric.settings;
  return (
    <div>
      <p className="mb-3 text-xs text-muted-foreground">
        {origin === "seed" ? "Seeded" : "Run"} {new Date(createdAt).toLocaleString()} · frozen, so
        nothing here can change. Edits go to the draft.
      </p>
      <div className="rounded-lg border bg-card p-4">
        <div className="mb-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
          Description
        </div>
        <p className="text-[15px] leading-7">{rubric.description}</p>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <SettingCard label="Gripper closed above" shown={closed.value} setting={closed} />
        <SettingCard
          label="Grasp: the last closure that rises"
          shown={cm(rise.value)}
          unit="cm"
          setting={rise}
        />
      </div>
      {rubric.phrases.map((phrase) => {
        const criteria = rubric.criteria.filter((c) => c.phrase === phrase);
        return (
          <section key={phrase} aria-label={`Phrase: ${phrase}`} className="mt-5">
            <span className="rounded bg-muted px-1.5 py-0.5 text-sm">“{phrase}”</span>
            {criteria.length === 0 && (
              <span className="ml-2 text-xs text-muted-foreground">not checked</span>
            )}
            <div className="mt-2 grid gap-2">
              {criteria.map((c) => {
                const preview = props.preview?.criteria.find((p) => p.criterion_id === c.id);
                return (
                  <CriterionCard
                    key={c.id}
                    criterion={c}
                    english={preview?.english ?? c.id}
                    enabled
                    preview={preview}
                  />
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
