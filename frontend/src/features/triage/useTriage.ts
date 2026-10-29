import { useQuery } from "@tanstack/react-query";

import { api } from "../../api/client";
import type { components } from "../../api/schema";

export type EpisodeTriage = components["schemas"]["EpisodeTriage"];
export type TriageDecision = EpisodeTriage["decision"];
export type CriterionResult = components["schemas"]["CriterionResult"];
export type TextSpan = components["schemas"]["TextSpan"];
export type Status = CriterionResult["status"];

export const triageKey = ["triage"] as const;

export const DECISION_LABELS: Record<TriageDecision, string> = {
  keep: "Keep",
  reject: "Reject",
  needs_review: "Needs review",
};

/** Every Episode's Triage decision and Reason, scored against the latest Rubric version. */
export function useTriageList() {
  return useQuery({
    queryKey: triageKey,
    queryFn: async () => {
      const { data, response } = await api.GET("/api/triage");
      if (!response.ok || !data) throw new Error(`Triage failed: ${String(response.status)}`);
      return data;
    },
  });
}

export function useEpisodeTriage(episodeId: string) {
  return useQuery({
    queryKey: [...triageKey, episodeId],
    queryFn: async () => {
      const { data, response } = await api.GET("/api/episodes/{episode_id}/triage", {
        params: { path: { episode_id: episodeId } },
      });
      if (!response.ok || !data) throw new Error(`Triage failed: ${String(response.status)}`);
      return data;
    },
  });
}
