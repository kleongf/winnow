import { pageLabels, type Page } from "./pages";

const coming: Record<Exclude<Page, "prepare">, string> = {
  describe: "Write a Description, compile it into a Rubric, and answer the interview.",
  episodes: "Every Episode with its Triage decision and Reason, opening into the Workstation.",
  review: "The Needs review queue, least confident first.",
  evaluation: "Winnow against Spark alone and length alone, scored on Reference labels.",
};

export function NotBuiltYet(props: { page: Exclude<Page, "prepare"> }) {
  return (
    <div className="mx-auto max-w-3xl p-8">
      <h1 className="text-xl font-semibold">{pageLabels[props.page]}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{coming[props.page]}</p>
      <p className="mt-4 text-sm text-muted-foreground">Not built yet.</p>
    </div>
  );
}
