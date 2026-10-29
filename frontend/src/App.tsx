import { NotBuiltYet } from "./features/core/NotBuiltYet";
import { usePage } from "./features/core/pages";
import { Sidebar } from "./features/core/Sidebar";
import { PreparePage } from "./features/dataset/PreparePage";

export function App() {
  const [page, setPage] = usePage();
  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <Sidebar page={page} onPage={setPage} />
      <main className="flex-1 overflow-y-auto">
        {page === "prepare" ? <PreparePage /> : <NotBuiltYet page={page} />}
      </main>
    </div>
  );
}
