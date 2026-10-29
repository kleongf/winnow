import { useQuery } from "@tanstack/react-query";

import { api } from "../../api/client";

export const datasetStatusKey = ["dataset"] as const;

export function useDatasetStatus() {
  return useQuery({
    queryKey: datasetStatusKey,
    queryFn: async () => {
      const { data, response } = await api.GET("/api/dataset");
      if (!response.ok || !data)
        throw new Error(`Dataset status failed: ${String(response.status)}`);
      return data;
    },
  });
}
