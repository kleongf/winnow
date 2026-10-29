import { useQuery } from "@tanstack/react-query";

import { api } from "../../api/client";
import type { components } from "../../api/schema";

export type Track = components["schemas"]["Track"];
export type TrackBox = components["schemas"]["TrackBox"];

export const tracksKey = ["tracks"] as const;

export function useTracks(episodeId: string) {
  return useQuery({
    queryKey: [...tracksKey, episodeId],
    queryFn: async () => {
      const { data, response } = await api.GET("/api/episodes/{episode_id}/tracks", {
        params: { path: { episode_id: episodeId } },
      });
      if (!response.ok || !data) throw new Error(`Tracks failed: ${String(response.status)}`);
      return data;
    },
  });
}
