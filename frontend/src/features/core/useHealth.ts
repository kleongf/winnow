import { useQuery } from "@tanstack/react-query";

import { api } from "../../api/client";

export function useHealth() {
  return useQuery({
    queryKey: ["health"],
    queryFn: async () => {
      const { data, response } = await api.GET("/api/health");
      if (!response.ok || !data) throw new Error(`Health check failed: ${String(response.status)}`);
      return data;
    },
  });
}
