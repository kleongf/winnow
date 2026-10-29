import { useMutation, useQueryClient } from "@tanstack/react-query";

import { api } from "../../api/client";
import { latestJobKey } from "../jobs/useLatestJob";

export function useStartIngest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (indices: number[]) => {
      const { data, response } = await api.POST("/api/episodes/ingest", {
        body: { source: "droid_100", indices },
      });
      if (!response.ok || !data)
        throw new Error(`Ingest failed to start: ${String(response.status)}`);
      return data.job_id;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: latestJobKey("ingest") }),
  });
}
