import { pageLabels, type Page } from "./pages";

type Unbuilt = Exclude<Page, "prepare" | "select" | "episodes" | "reference" | "evaluation">;

const coming: Record<Unbuilt, string> = {
  describe: "Write a Description, compile it into a Rubric, and answer the interview.",
  review: "The Needs review queue, least confident first.",
};

export function NotBuiltYet(props: { page: Unbuilt }) {
  return (
    <div className="mx-auto max-w-3xl p-8">
      <h1 className="text-xl font-semibold">{pageLabels[props.page]}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{coming[props.page]}</p>
      <p className="mt-4 text-sm text-muted-foreground">Not built yet.</p>
    </div>
  );
}
