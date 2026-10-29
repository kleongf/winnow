// The Episodes table's Triage tabs, each with its count; the chosen one lives in `?triage=`.
import { Button } from "@/components/ui/button";

import { DECISION_LABELS, type TriageDecision } from "./useTriage";

export type TriageTab = "all" | TriageDecision;

const TABS: TriageTab[] = ["all", "keep", "reject", "needs_review"];

export function parseTriageTab(value: string | null): TriageTab {
  return TABS.find((tab) => tab === value) ?? "all";
}

export function countDecisions(decisions: TriageDecision[]): Record<TriageTab, number> {
  const counts: Record<TriageTab, number> = { all: 0, keep: 0, reject: 0, needs_review: 0 };
  for (const decision of decisions) {
    counts.all += 1;
    counts[decision] += 1;
  }
  return counts;
}

export function TriageTabs(props: {
  tab: TriageTab;
  counts: Record<TriageTab, number>;
  onTab: (tab: TriageTab) => void;
}) {
  return (
    <div className="flex items-center gap-1" role="tablist" aria-label="Triage decision">
      {TABS.map((tab) => (
        <Button
          key={tab}
          size="sm"
          role="tab"
          aria-selected={tab === props.tab}
          variant={tab === props.tab ? "secondary" : "ghost"}
          onClick={() => {
            props.onTab(tab);
          }}
        >
          {tab === "all" ? "All" : DECISION_LABELS[tab]}
          <span className="text-muted-foreground tabular-nums">{props.counts[tab]}</span>
        </Button>
      ))}
    </div>
  );
}
