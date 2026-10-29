// PROTOTYPE (throwaway): Variant B placeholder.
import type { Workspace } from "../fixture/useWorkspace";

export const name = "TBD";

export function VariantB(props: { ws: Workspace }) {
  return <div className="p-8">Variant B · {props.ws.results.length} Episodes</div>;
}
