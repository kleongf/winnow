import { useQuery } from "@tanstack/react-query";

import { api } from "../../api/client";

export const latestJobKey = (kind: string) => ["jobs", "latest", kind] as const;

/** The most recent job of a kind, polled every second while it runs. */
export function useLatestJob(kind: string) {
  return useQuery({
    queryKey: latestJobKey(kind),
    queryFn: async () => {
      const { data, response } = await api.GET("/api/jobs/latest", {
        params: { query: { kind } },
      });
      if (!response.ok || data === undefined) {
        throw new Error(`Job status failed: ${String(response.status)}`);
      }
      return data;
    },
    refetchInterval: (query) => (query.state.data && !query.state.data.finished ? 1000 : false),
  });
}
