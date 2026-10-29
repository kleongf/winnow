// Every ingested Episode in a dense table, sorted into Triage tabs with its Reason (only once it
// has a Reference label; until then it's awaiting one and has no Triage decision); a row opens
// the full-page Workstation. The tab, the open Episode and its start time live in `?triage=`,
// `?episode=` and `?t=`; J/K step through the tab's Episodes.
import { navigate, useSearchParams } from "../core/url";
import { setsByEpisode, useSets } from "../sets/useSets";
import { countDecisions, parseTriageTab, TriageTabs, type TriageTab } from "../triage/TriageTabs";
import { useTriageList } from "../triage/useTriage";
import { EpisodePage } from "./EpisodePage";
import { EpisodeTable } from "./EpisodeTable";
import { useEpisodes, type Episode } from "./useEpisodes";

function open(id: string | null) {
  navigate({ episode: id, t: null });
}

function useTriagedEpisodes(tab: TriageTab) {
  const all = useEpisodes().data;
  const triage = useTriageList().data;
  const triageOf = new Map(triage?.rows.map((r) => [r.episode_id, r]));
  const episodes = all ?? [];
  const shown =
    tab === "all" ? episodes : episodes.filter((e) => triageOf.get(e.id)?.decision === tab);
  const decided = countDecisions(triage?.rows.map((r) => r.decision) ?? []);
  const counts = { ...decided, all: episodes.length };
  const awaiting = episodes.filter((e) => !e.reference_labelled).length;
  const summary = triage
    ? [
        `${String(decided.all - decided.needs_review)} of ${String(decided.all)} decided automatically`,
        `${String(decided.needs_review)} Needs review`,
        ...(awaiting > 0 ? [`${String(awaiting)} awaiting Reference label`] : []),
        `Rubric v${String(triage.rubric_version)}`,
      ].join(" · ")
    : `${String(episodes.length)} Episodes in the Dataset.`;
  return { loaded: all !== undefined, episodes, shown, triageOf, counts, summary };
}

function OpenEpisode(props: { episode: Episode; ids: string[]; t: string | null }) {
  const t = Number(props.t ?? 0);
  return (
    <EpisodePage
      key={props.episode.id}
      episode={props.episode}
      ids={props.ids}
      initialT={Number.isFinite(t) ? t : 0}
      onOpen={open}
    />
  );
}

export function EpisodesPage() {
  const params = useSearchParams();
  const tab = parseTriageTab(params.get("triage"));
  const { loaded, episodes, shown, triageOf, counts, summary } = useTriagedEpisodes(tab);
  const setOf = setsByEpisode(useSets().data);

  const openEpisode = episodes.find((e) => e.id === params.get("episode"));
  if (openEpisode) {
    const ids = shown.map((e) => e.id);
    const steps = ids.includes(openEpisode.id) ? ids : episodes.map((e) => e.id);
    return <OpenEpisode episode={openEpisode} ids={steps} t={params.get("t")} />;
  }

  return (
    <div className="mx-auto max-w-6xl p-8">
      <div className="text-xs text-muted-foreground">Project</div>
      <h1 className="text-xl font-semibold">Episodes</h1>
      <p className="mt-1 text-sm text-muted-foreground">{summary}</p>
      {episodes.length === 0 && loaded && (
        <p className="mt-6 text-sm text-muted-foreground">
          No Episodes yet: ingest some on the Prepare page.
        </p>
      )}
      {episodes.length > 0 && (
        <>
          <div className="mt-5">
            <TriageTabs
              tab={tab}
              counts={counts}
              onTab={(next) => {
                navigate({ triage: next === "all" ? null : next });
              }}
            />
          </div>
          <EpisodeTable episodes={shown} triageOf={triageOf} setOf={setOf} onOpen={open} />
          {shown.length === 0 && (
            <p className="mt-4 text-sm text-muted-foreground">No Episodes in this tab.</p>
          )}
        </>
      )}
    </div>
  );
}
