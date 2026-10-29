import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "../../api/client";
import type { components } from "../../api/schema";

export type RubricDraft = components["schemas"]["RubricDraft"];
export type DraftPhrase = components["schemas"]["DraftPhrase"];
export type Criterion = components["schemas"]["Criterion"];
export type Setting = components["schemas"]["Setting"];
export type PhraseStatus = DraftPhrase["status"];

export const draftKey = ["rubric", "draft"] as const;
const anchorPoolKey = ["anchor-pool"] as const;

/** The Rubric draft on the Describe page; null until a Description is compiled. */
export function useDraft() {
  return useQuery({
    queryKey: draftKey,
    queryFn: async () => {
      const { data, response } = await api.GET("/api/rubric/draft");
      if (!response.ok) throw new Error(`Draft failed: ${String(response.status)}`);
      return data ?? null;
    },
  });
}

/** Compile a Description into the draft: one Spark call, so it takes a while. */
export function useCompile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (description: string) => {
      const { data, error, response } = await api.POST("/api/rubric/draft/compile", {
        body: { description },
      });
      if (!response.ok || !data) {
        const detail = (error as { detail?: unknown } | undefined)?.detail;
        throw new Error(typeof detail === "string" ? detail : "The Description couldn't compile");
      }
      return data;
    },
    onSuccess: async (draft) => {
      queryClient.setQueryData(draftKey, draft);
      // A new draft re-sorts the anchor pool: refetch its preview (keyed under the draft).
      await queryClient.invalidateQueries({ queryKey: [...draftKey, "preview"] });
    },
  });
}

/** The Episodes the Rubric is written against: the Dev set, never the Test set. */
export function useAnchorPool() {
  return useQuery({
    queryKey: anchorPoolKey,
    queryFn: async () => {
      const { data, response } = await api.GET("/api/anchor-pool");
      if (!response.ok || !data) throw new Error(`Anchor pool failed: ${String(response.status)}`);
      return data;
    },
  });
}
