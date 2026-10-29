import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "../../api/client";
import type { components } from "../../api/schema";
import { latestJobKey } from "../jobs/useLatestJob";

export type Candidate = components["schemas"]["Candidate"];
export type ExclusionReason = components["schemas"]["Exclude"]["reason"];
type Decision = components["schemas"]["Confirm"] | components["schemas"]["Exclude"];

const selectionKey = ["selection"] as const;

export function useCandidates() {
  return useQuery({
    queryKey: selectionKey,
    queryFn: async () => {
      const { data, response } = await api.GET("/api/selection");
      if (!response.ok || !data) throw new Error(`Selection failed: ${String(response.status)}`);
      return data;
    },
  });
}

export function useDecide() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ episodeId, decision }: { episodeId: string; decision: Decision }) => {
      const { data, response } = await api.PUT("/api/selection/{episode_id}", {
        params: { path: { episode_id: episodeId } },
        body: decision,
      });
      if (!response.ok || !data) throw new Error("The decision couldn't be saved");
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: selectionKey }),
  });
}

export function useIngestConfirmed() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, response } = await api.POST("/api/selection/ingest");
      if (!response.ok || !data) throw new Error("Nothing confirmed to ingest");
      return data.job_id;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: latestJobKey("ingest") }),
  });
}

export function sheetUrl(episodeId: string): string {
  return `/api/selection/${encodeURIComponent(episodeId)}/sheet`;
}
