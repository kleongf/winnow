import { useMutation, useQueryClient } from "@tanstack/react-query";

import { api } from "../../api/client";
import { latestJobKey } from "../jobs/useLatestJob";

export function useStartExport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, response } = await api.POST("/api/export");
      if (!response.ok || !data)
        throw new Error(`Export failed to start: ${String(response.status)}`);
      return data.job_id;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: latestJobKey("export") }),
  });
}
