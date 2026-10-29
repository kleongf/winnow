// PROTOTYPE (throwaway): all workspace state, in memory. Every variant drives the same state so the
// comparison is about layout, not behaviour. Nothing persists.
import { useMemo, useState } from "react";

import { episodes, type Episode, type Rect } from "./episodes";
import { evaluateEpisode, type EpisodeResult, type Label } from "./evaluate";
import { initialRubric, type Rubric } from "./rubric";
import { initialLabels, interview, projects, type InterviewTurn } from "./workspace";

export interface Workspace {
  projectId: string;
  setProjectId: (id: string) => void;
  rubric: Rubric;
  setThreshold: (criterionId: string, value: number) => void;
  toggleHard: (criterionId: string) => void;
  toggleEnabled: (criterionId: string) => void;
  setSetting: (key: keyof Rubric["settings"], value: number) => void;
  labels: Label[];
  addLabel: (label: Label) => void;
  removeLabel: (episodeId: string, phraseId: string) => void;
  boxes: Map<string, Episode["box"]>;
  setBox: (episodeId: string, view: "ext1" | "ext2", rect: Rect) => void;
  interview: InterviewTurn[];
  answer: (turnId: string, option: string) => void;
  /** Every Episode in the Project's Dataset, re-evaluated on each change. */
  results: EpisodeResult[];
  resultById: Map<string, EpisodeResult>;
  anchorIds: Set<string>;
  heldOutIds: Set<string>;
}

export function useWorkspace(): Workspace {
  const [projectId, setProjectId] = useState("expert-pnp");
  const [rubric, setRubric] = useState(initialRubric);
  const [labels, setLabels] = useState(initialLabels);
  const [boxes, setBoxes] = useState(() => new Map(episodes.map((e) => [e.id, e.box])));
  const [turns, setTurns] = useState(interview);

  const updateCriterion = (
    id: string,
    f: (c: Rubric["criteria"][number]) => Rubric["criteria"][number],
  ) => setRubric((r) => ({ ...r, criteria: r.criteria.map((c) => (c.id === id ? f(c) : c)) }));

  const results = useMemo(
    () =>
      episodes.map((e) => {
        const box = boxes.get(e.id) ?? null;
        const withBox: Episode =
          box && e.values["final-overlap"] === null
            ? {
                ...e,
                box,
                values: { ...e.values, "final-overlap": 0.4 + ((e.index * 37) % 60) / 100 },
              }
            : { ...e, box };
        return evaluateEpisode(withBox, rubric, labels);
      }),
    [rubric, labels, boxes],
  );

  const project = projects.find((p) => p.id === projectId) ?? projects[0]!;

  return {
    projectId,
    setProjectId,
    rubric,
    setThreshold: (id, value) =>
      updateCriterion(id, (c) => ({
        ...c,
        threshold: value,
        assumptions: c.assumptions.filter((a) => !a.includes("taken as")),
      })),
    toggleHard: (id) => updateCriterion(id, (c) => ({ ...c, hard: !c.hard })),
    toggleEnabled: (id) => updateCriterion(id, (c) => ({ ...c, enabled: !c.enabled })),
    setSetting: (key, value) =>
      setRubric((r) => ({
        ...r,
        settings: { ...r.settings, [key]: { ...r.settings[key], value, assumed: false } },
      })),
    labels,
    addLabel: (label) =>
      setLabels((ls) => [
        ...ls.filter((l) => !(l.episodeId === label.episodeId && l.phraseId === label.phraseId)),
        label,
      ]),
    removeLabel: (episodeId, phraseId) =>
      setLabels((ls) => ls.filter((l) => !(l.episodeId === episodeId && l.phraseId === phraseId))),
    boxes,
    setBox: (episodeId, view, rect) => setBoxes((m) => new Map(m).set(episodeId, { view, rect })),
    interview: turns,
    answer: (turnId, option) => {
      setTurns((ts) =>
        ts.map((t) =>
          t.id === turnId
            ? { ...t, answered: option, effect: "Recorded as a label; Rubric updated." }
            : t,
        ),
      );
      const turn = turns.find((t) => t.id === turnId);
      if (turn?.anchor && turn.target?.phraseId) {
        const pass = turn.passOptions?.includes(option) ?? false;
        setLabels((ls) => [
          ...ls,
          {
            episodeId: turn.anchor!.episodeId,
            phraseId: turn.target!.phraseId!,
            value: pass ? "pass" : "fail",
            source: "interview",
          },
        ]);
      }
    },
    results,
    resultById: new Map(results.map((r) => [r.episode.id, r])),
    anchorIds: new Set(project.anchorPool.episodeIds),
    heldOutIds: new Set(project.heldOut?.episodeIds ?? []),
  };
}
