import { NotBuiltYet } from "./features/core/NotBuiltYet";
import { usePage } from "./features/core/pages";
import { Sidebar } from "./features/core/Sidebar";
import { PreparePage } from "./features/dataset/PreparePage";
import { EpisodesPage } from "./features/episodes/EpisodesPage";
import { EvaluationPage } from "./features/evaluation/EvaluationPage";
import { ReferenceLabelsPage } from "./features/referenceLabels/ReferenceLabelsPage";
import { DescribePage } from "./features/rubric/DescribePage";
import { SelectionPage } from "./features/selection/SelectionPage";

export function App() {
  const [page, setPage] = usePage();
  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <Sidebar page={page} onPage={setPage} />
      <main className="flex-1 overflow-y-auto">
        {page === "prepare" && <PreparePage />}
        {page === "select" && <SelectionPage />}
        {page === "episodes" && <EpisodesPage />}
        {page === "reference" && <ReferenceLabelsPage />}
        {page === "evaluation" && <EvaluationPage />}
        {page === "describe" && <DescribePage />}
        {page === "review" && <NotBuiltYet page={page} />}
      </main>
    </div>
  );
}
