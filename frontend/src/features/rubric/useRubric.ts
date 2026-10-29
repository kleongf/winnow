import { useQuery } from "@tanstack/react-query";

import { api } from "../../api/client";
import type { components } from "../../api/schema";

export type RubricVersion = components["schemas"]["RubricVersion"];

export const rubricKey = ["rubric"] as const;

/** The latest Rubric version: the one every Episode is scored against. */
export function useRubric() {
  return useQuery({
    queryKey: rubricKey,
    queryFn: async () => {
      const { data, response } = await api.GET("/api/rubric");
      if (!response.ok || !data) throw new Error(`Rubric failed: ${String(response.status)}`);
      return data;
    },
  });
}

/** Reference lines for the Workstation's plots: the gripper-closed level grasps are read at.
 * None unless `shown` (Reference label mode stays blind to the Rubric). */
export function useSignalLevels(shown: boolean): { gripper?: number } {
  const level = useRubric().data?.rubric.settings.gripper_closed_level.value;
  return level === undefined || !shown ? {} : { gripper: level };
}
