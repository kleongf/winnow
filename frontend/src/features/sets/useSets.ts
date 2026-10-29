import { useQuery } from "@tanstack/react-query";

import { api } from "../../api/client";
import type { components } from "../../api/schema";

export type EpisodeSet = components["schemas"]["EpisodeSet"];
export type SetName = EpisodeSet["name"];

export const SET_LABELS: Record<SetName, string> = { dev: "Dev set", test: "Test set" };

export function useSets() {
  return useQuery({
    queryKey: ["sets"],
    queryFn: async () => {
      const { data, response } = await api.GET("/api/sets");
      if (!response.ok || !data) throw new Error(`Sets failed: ${String(response.status)}`);
      return data;
    },
  });
}

/** Which set each Episode is in; Episodes in neither are absent. */
export function setsByEpisode(sets: EpisodeSet[] | undefined): Map<string, SetName> {
  return new Map((sets ?? []).flatMap((s) => s.episode_ids.map((id) => [id, s.name] as const)));
}
