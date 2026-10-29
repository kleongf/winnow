import { useQuery } from "@tanstack/react-query";

import { api } from "../../api/client";
import type { components } from "../../api/schema";

export type Episode = components["schemas"]["Episode"];
export type Signals = components["schemas"]["Signals"];

export function useEpisodes() {
  return useQuery({
    queryKey: ["episodes"],
    queryFn: async () => {
      const { data, response } = await api.GET("/api/episodes");
      if (!response.ok || !data) throw new Error(`Episodes failed: ${String(response.status)}`);
      return data;
    },
  });
}

export function useSignals(episodeId: string) {
  return useQuery({
    queryKey: ["episodes", episodeId, "signals"],
    queryFn: async () => {
      const { data, response } = await api.GET("/api/episodes/{episode_id}/signals", {
        params: { path: { episode_id: episodeId } },
      });
      if (!response.ok || !data) throw new Error(`Signals failed: ${String(response.status)}`);
      return data;
    },
    staleTime: Infinity, // robot data never changes after ingest
  });
}

export function clipUrl(episodeId: string, camera: string): string {
  return `/api/episodes/${encodeURIComponent(episodeId)}/clips/${camera}`;
}
